export type PaperContentLookupInput = {
  title: string;
  publishedDate: string | null;
  doi: string | null;
};

export type PaperContentLookupResult = {
  status: "found" | "pdf_available" | "unavailable" | "error";
  content: string | null;
  provider: "openalex" | "crossref" | null;
  sourceUrl: string | null;
  pdfUrl: string | null;
  license: string | null;
  matchedTitle: string | null;
  matchedBy: "doi" | "title" | "related-title" | null;
  matchedPublishedDate?: string | null;
  matchedDoi?: string | null;
  isOpenAccess: boolean | null;
  message: string;
};

export type RelatedPaperLookupInput = PaperContentLookupInput & {
  id: string;
  publicationType: string;
  kciId: string | null;
  officialProfileUrl: string;
};

export type RelatedPaperLookupCandidate = {
  officialPaper: RelatedPaperLookupInput;
  result: PaperContentLookupResult;
};

type LookupOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  openAlexApiKey?: string;
  crossrefMailto?: string;
};

type JsonRecord = Record<string, unknown>;

const OPENALEX_URL = "https://api.openalex.org/works";
const CROSSREF_URL = "https://api.crossref.org/works";
const MAX_CONTENT_LENGTH = 12_000;
const REUSABLE_PDF_LICENSES = new Set(["cc-by", "cc-by-sa", "public-domain"]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeHtmlText(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLocaleLowerCase("en-US")] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePaperTitle(value: string): string {
  return decodeHtmlText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/gu, "")
    .trim();
}

export function reconstructOpenAlexAbstract(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const positionedWords: Array<{ position: number; word: string }> = [];
  Object.entries(value).forEach(([word, positions]) => {
    if (!Array.isArray(positions)) return;
    positions.forEach((position) => {
      if (typeof position === "number" && Number.isInteger(position) && position >= 0) {
        positionedWords.push({ position, word });
      }
    });
  });
  if (positionedWords.length === 0) return null;
  const content = positionedWords
    .sort((left, right) => left.position - right.position)
    .map((item) => item.word)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return content ? content.slice(0, MAX_CONTENT_LENGTH) : null;
}

function publicationYear(value: string | null): number | null {
  const matched = value?.match(/^(\d{4})/);
  return matched ? Number(matched[1]) : null;
}

function normalizedDoi(value: string | null): string | null {
  return value?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim() || null;
}

function hasMatchingPaperIdentity(
  paper: PaperContentLookupInput,
  candidateTitle: string,
  candidateDate: string | null,
): boolean {
  if (normalizePaperTitle(paper.title) !== normalizePaperTitle(candidateTitle)) return false;
  const expectedYear = publicationYear(paper.publishedDate);
  const candidateYear = publicationYear(candidateDate);
  return expectedYear === null || candidateYear === null || expectedYear === candidateYear;
}

async function fetchJson(
  url: string,
  options: LookupOptions,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await (options.fetcher ?? fetch)(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MajorEvolutionHomepage/0.1 paper-content-lookup",
    },
    cache: "no-store",
    signal: options.signal,
  });
  if (!response.ok) {
    if (response.status !== 404) {
      throw new Error(`paper provider temporarily unavailable (${response.status})`);
    }
    return { ok: false, status: response.status, data: null };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("paper provider returned invalid JSON", { cause: error });
  }
  return { ok: true, status: response.status, data };
}

function openAlexSourceUrl(work: JsonRecord): string | null {
  const bestLocation = isRecord(work.best_oa_location) ? work.best_oa_location : null;
  const openAccess = isRecord(work.open_access) ? work.open_access : null;
  return readString(bestLocation?.landing_page_url)
    ?? readString(bestLocation?.pdf_url)
    ?? readString(openAccess?.oa_url)
    ?? readString(work.doi)
    ?? readString(work.id);
}

function parseOpenAlexWork(
  paper: PaperContentLookupInput,
  value: unknown,
  matchedBy: "doi" | "title",
): PaperContentLookupResult | null {
  if (!isRecord(value)) return null;
  const matchedTitle = readString(value.display_name) ?? readString(value.title);
  if (!matchedTitle) return null;
  const publishedDate = readString(value.publication_date);
  if (!hasMatchingPaperIdentity(paper, matchedTitle, publishedDate)) return null;
  const bestLocation = isRecord(value.best_oa_location) ? value.best_oa_location : null;
  const license = readString(bestLocation?.license)?.toLocaleLowerCase("en-US") ?? null;
  const pdfUrl = readString(bestLocation?.pdf_url);
  const reusablePdfUrl = pdfUrl && license && REUSABLE_PDF_LICENSES.has(license)
    ? pdfUrl
    : null;
  const content = reconstructOpenAlexAbstract(value.abstract_inverted_index);
  const openAccess = isRecord(value.open_access) ? value.open_access : null;
  if (!content && !reusablePdfUrl) return null;
  return {
    status: content ? "found" : "pdf_available",
    content,
    provider: "openalex",
    sourceUrl: openAlexSourceUrl(value),
    pdfUrl: reusablePdfUrl,
    license: reusablePdfUrl ? license : null,
    matchedTitle,
    matchedBy,
    matchedPublishedDate: publishedDate,
    matchedDoi: normalizedDoi(readString(value.doi)),
    isOpenAccess: typeof openAccess?.is_oa === "boolean" ? openAccess.is_oa : null,
    message: content
      ? "공개 학술 메타데이터에서 확인한 초록을 불러왔습니다."
      : "재사용 가능한 오픈 라이선스의 공개 PDF를 찾았습니다.",
  };
}

async function lookupOpenAlex(
  paper: PaperContentLookupInput,
  options: LookupOptions,
): Promise<PaperContentLookupResult | null> {
  const apiKey = options.openAlexApiKey?.trim();
  if (paper.doi) {
    const doi = paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
    const query = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : "";
    const url = `${OPENALEX_URL}/https://doi.org/${encodeURIComponent(doi)}${query}`;
    const response = await fetchJson(url, options);
    if (response.ok) {
      const found = parseOpenAlexWork(paper, response.data, "doi");
      if (found) return found;
    }
  }

  const params = new URLSearchParams({
    search: `"${paper.title}"`,
    per_page: "5",
    select: [
      "id",
      "display_name",
      "publication_date",
      "doi",
      "abstract_inverted_index",
      "open_access",
      "best_oa_location",
    ].join(","),
  });
  if (apiKey) params.set("api_key", apiKey);
  const response = await fetchJson(`${OPENALEX_URL}?${params.toString()}`, options);
  if (!response.ok || !isRecord(response.data) || !Array.isArray(response.data.results)) {
    return null;
  }
  for (const candidate of response.data.results) {
    const found = parseOpenAlexWork(paper, candidate, "title");
    if (found) return found;
  }
  return null;
}

function crossrefDate(item: JsonRecord): string | null {
  const dateParts = isRecord(item.published) && Array.isArray(item.published["date-parts"])
    ? item.published["date-parts"]
    : null;
  const first = Array.isArray(dateParts?.[0]) ? dateParts?.[0] : null;
  if (!first || typeof first[0] !== "number") return null;
  const [year, month = 1, day = 1] = first;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCrossrefItem(
  paper: PaperContentLookupInput,
  value: unknown,
  matchedBy: "doi" | "title",
): PaperContentLookupResult | null {
  if (!isRecord(value)) return null;
  const titleValue = Array.isArray(value.title) ? value.title[0] : value.title;
  const matchedTitle = readString(titleValue);
  if (!matchedTitle || !hasMatchingPaperIdentity(paper, matchedTitle, crossrefDate(value))) return null;
  const rawAbstract = readString(value.abstract);
  const content = rawAbstract ? decodeHtmlText(rawAbstract).slice(0, MAX_CONTENT_LENGTH) : null;
  if (!content) return null;
  const doi = readString(value.DOI);
  return {
    status: "found",
    content,
    provider: "crossref",
    sourceUrl: readString(value.URL) ?? (doi ? `https://doi.org/${doi}` : null),
    pdfUrl: null,
    license: null,
    matchedTitle,
    matchedBy,
    matchedPublishedDate: crossrefDate(value),
    matchedDoi: normalizedDoi(doi),
    isOpenAccess: null,
    message: "Crossref 공개 메타데이터에서 확인한 초록을 불러왔습니다.",
  };
}

function hasRelatedPaperIdentity(
  paper: RelatedPaperLookupInput,
  candidateTitle: string,
  candidateDate: string | null,
): boolean {
  const officialTitle = normalizePaperTitle(paper.title);
  const publicTitle = normalizePaperTitle(candidateTitle);
  if (officialTitle.length < 20 || publicTitle.length < 20) return false;
  if (!publicTitle.startsWith(officialTitle) && !officialTitle.startsWith(publicTitle)) return false;
  const officialYear = publicationYear(paper.publishedDate);
  const publicYear = publicationYear(candidateDate);
  return officialYear === null || publicYear === null || Math.abs(officialYear - publicYear) <= 2;
}

function parseRelatedOpenAlexCandidate(
  papers: RelatedPaperLookupInput[],
  value: unknown,
): (RelatedPaperLookupCandidate & { rank: number }) | null {
  if (!isRecord(value)) return null;
  const matchedTitle = readString(value.display_name) ?? readString(value.title);
  const matchedPublishedDate = readString(value.publication_date);
  if (!matchedTitle) return null;
  const officialPaper = papers.find((paper) => (
    hasRelatedPaperIdentity(paper, matchedTitle, matchedPublishedDate)
  ));
  if (!officialPaper) return null;

  const bestLocation = isRecord(value.best_oa_location) ? value.best_oa_location : null;
  const license = readString(bestLocation?.license)?.toLocaleLowerCase("en-US") ?? null;
  const pdfUrl = readString(bestLocation?.pdf_url);
  const reusablePdfUrl = pdfUrl && license && REUSABLE_PDF_LICENSES.has(license)
    ? pdfUrl
    : null;
  const content = reconstructOpenAlexAbstract(value.abstract_inverted_index);
  if (!content && !reusablePdfUrl) return null;
  const openAccess = isRecord(value.open_access) ? value.open_access : null;
  const workType = readString(value.type);
  const doi = normalizedDoi(readString(value.doi));
  const isPublishedArticle = workType === "article" && !doi?.includes("preprint");

  return {
    officialPaper,
    rank: isPublishedArticle ? 0 : workType === "article" ? 1 : 2,
    result: {
      status: content ? "found" : "pdf_available",
      content,
      provider: "openalex",
      sourceUrl: openAlexSourceUrl(value),
      pdfUrl: reusablePdfUrl,
      license: reusablePdfUrl ? license : null,
      matchedTitle,
      matchedBy: "related-title",
      matchedPublishedDate,
      matchedDoi: doi,
      isOpenAccess: typeof openAccess?.is_oa === "boolean" ? openAccess.is_oa : null,
      message: "같은 교수님의 공식 목록에서 제목이 확장된 공개 논문 후보를 찾았습니다.",
    },
  };
}

export async function lookupRelatedPublicPaperCandidate(
  papers: RelatedPaperLookupInput[],
  options: LookupOptions = {},
): Promise<RelatedPaperLookupCandidate | null> {
  const usablePapers = papers
    .filter((paper) => paper.title.trim().length >= 8)
    .slice(0, 12);
  if (usablePapers.length === 0) return null;
  const search = usablePapers
    .map((paper) => `"${paper.title.replace(/"/g, "").trim()}"`)
    .join(" OR ");
  const params = new URLSearchParams({
    search: usablePapers.length > 1 ? `(${search})` : search,
    per_page: "25",
    select: [
      "id",
      "type",
      "display_name",
      "publication_date",
      "doi",
      "abstract_inverted_index",
      "open_access",
      "best_oa_location",
    ].join(","),
  });
  const apiKey = options.openAlexApiKey?.trim();
  if (apiKey) params.set("api_key", apiKey);
  const response = await fetchJson(`${OPENALEX_URL}?${params.toString()}`, options);
  if (!response.ok || !isRecord(response.data) || !Array.isArray(response.data.results)) {
    return null;
  }
  const candidates = response.data.results
    .map((value) => parseRelatedOpenAlexCandidate(usablePapers, value))
    .filter((candidate): candidate is RelatedPaperLookupCandidate & { rank: number } => Boolean(candidate))
    .sort((left, right) => left.rank - right.rank);
  const best = candidates[0];
  return best ? { officialPaper: best.officialPaper, result: best.result } : null;
}

async function lookupCrossref(
  paper: PaperContentLookupInput,
  options: LookupOptions,
): Promise<PaperContentLookupResult | null> {
  if (paper.doi) {
    const doi = paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
    const response = await fetchJson(`${CROSSREF_URL}/${encodeURIComponent(doi)}`, options);
    if (response.ok && isRecord(response.data) && isRecord(response.data.message)) {
      const found = parseCrossrefItem(paper, response.data.message, "doi");
      if (found) return found;
    }
  }

  const params = new URLSearchParams({
    "query.title": paper.title,
    rows: "5",
    select: "DOI,title,published,abstract,URL,score",
  });
  if (options.crossrefMailto?.trim()) params.set("mailto", options.crossrefMailto.trim());
  const response = await fetchJson(`${CROSSREF_URL}?${params.toString()}`, options);
  if (!response.ok || !isRecord(response.data) || !isRecord(response.data.message)) return null;
  const items = response.data.message.items;
  if (!Array.isArray(items)) return null;
  for (const candidate of items) {
    const found = parseCrossrefItem(paper, candidate, "title");
    if (found) return found;
  }
  return null;
}

export async function lookupPublicPaperContent(
  paper: PaperContentLookupInput,
  options: LookupOptions = {},
): Promise<PaperContentLookupResult> {
  const normalizedPaper = {
    title: paper.title.trim().slice(0, 300),
    publishedDate: paper.publishedDate,
    doi: paper.doi?.trim() || null,
  };
  if (!normalizedPaper.title) {
    return {
      status: "unavailable",
      content: null,
      provider: null,
      sourceUrl: null,
      pdfUrl: null,
      license: null,
      matchedTitle: null,
      matchedBy: null,
      isOpenAccess: null,
      message: "논문 제목이 없어 공개 초록을 조회할 수 없습니다.",
    };
  }

  let failedProviders = 0;
  try {
    const openAlex = await lookupOpenAlex(normalizedPaper, options);
    if (openAlex) return openAlex;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    failedProviders += 1;
  }
  try {
    const crossref = await lookupCrossref(normalizedPaper, options);
    if (crossref) return crossref;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    failedProviders += 1;
  }

  return {
    status: failedProviders > 0 ? "error" : "unavailable",
    content: null,
    provider: null,
    sourceUrl: null,
    pdfUrl: null,
    license: null,
    matchedTitle: null,
    matchedBy: null,
    isOpenAccess: null,
    message: failedProviders > 0
      ? "공개 학술 데이터 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
      : "제목과 발행 정보가 일치하는 공개 초록을 찾지 못했습니다. 직접 붙여 넣어 주세요.",
  };
}
