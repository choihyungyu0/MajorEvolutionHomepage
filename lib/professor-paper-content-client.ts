export type ProfessorPaperContentResponse = {
  status: "found" | "candidate" | "unavailable" | "error";
  paperId: string;
  title: string;
  content: string | null;
  provider: "openalex" | "crossref" | null;
  sourceUrl: string | null;
  pdfUrl: string | null;
  license: string | null;
  matchedTitle: string | null;
  matchedPublishedDate: string | null;
  matchedDoi: string | null;
  matchedBy: "doi" | "title" | "related-title" | null;
  isOpenAccess: boolean | null;
  contentSourceType: "abstract" | "pdf_text" | null;
  pageCount: number | null;
  relatedOfficialPaper?: {
    id: string;
    title: string;
    publicationType: string;
    publishedDate: string | null;
    doi: string | null;
    kciId: string | null;
    officialProfileUrl: string;
  } | null;
  message: string;
  fetchedAt: string;
};

type RequestOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRelatedOfficialPaper(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.publicationType === "string"
    && isNullableString(value.publishedDate)
    && isNullableString(value.doi)
    && isNullableString(value.kciId)
    && typeof value.officialProfileUrl === "string"
  );
}

function isPaperContentResponse(value: unknown): value is ProfessorPaperContentResponse {
  if (!isRecord(value)) return false;
  const status = value.status;
  const provider = value.provider;
  const matchedBy = value.matchedBy;
  return (
    ["found", "candidate", "unavailable", "error"].includes(String(status))
    && typeof value.paperId === "string"
    && typeof value.title === "string"
    && isNullableString(value.content)
    && (provider === null || provider === "openalex" || provider === "crossref")
    && isNullableString(value.sourceUrl)
    && isNullableString(value.pdfUrl)
    && isNullableString(value.license)
    && isNullableString(value.matchedTitle)
    && isNullableString(value.matchedPublishedDate)
    && isNullableString(value.matchedDoi)
    && (matchedBy === null || matchedBy === "doi" || matchedBy === "title" || matchedBy === "related-title")
    && (value.isOpenAccess === null || typeof value.isOpenAccess === "boolean")
    && (
      value.contentSourceType === null
      || value.contentSourceType === "abstract"
      || value.contentSourceType === "pdf_text"
    )
    && (value.pageCount === null || typeof value.pageCount === "number")
    && isRelatedOfficialPaper(value.relatedOfficialPaper)
    && typeof value.message === "string"
    && typeof value.fetchedAt === "string"
    && ((status !== "found" && status !== "candidate") || (
      typeof value.content === "string"
      && (value.contentSourceType === "abstract" || value.contentSourceType === "pdf_text")
    ))
  );
}

export async function requestProfessorPaperContent(
  selection: { professorId: string; paperId: string },
  options: RequestOptions = {},
): Promise<ProfessorPaperContentResponse> {
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const professorId = selection.professorId.trim();
  const paperId = selection.paperId.trim();
  if (!professorId || !paperId) {
    throw new Error("교수님과 논문을 다시 선택해 주세요.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20_000);

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)("/api/professors/paper-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professorId, paperId }),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new Error("공개 초록을 20초 안에 찾지 못했습니다. 다시 시도해 주세요.");
    if (options.signal?.aborted || controller.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    throw error instanceof Error
      ? error
      : new Error("공개 초록 조회 서버에 연결하지 못했습니다.");
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`공개 초록 응답을 확인하지 못했습니다. (${response.status})`);
  }
  if (!response.ok) {
    const message = isRecord(data) && typeof data.error === "string"
      ? data.error
      : "공개 초록을 불러오지 못했습니다.";
    throw new Error(message);
  }
  if (!isPaperContentResponse(data) || data.paperId !== paperId) {
    throw new Error("공개 초록 응답 구성이 올바르지 않습니다.");
  }
  return data;
}
