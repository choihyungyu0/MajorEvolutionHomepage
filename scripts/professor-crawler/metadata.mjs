import { DEFAULT_USER_AGENT } from "./constants.mjs";
import { decodeHtmlEntities, normalizeSpace } from "./utils.mjs";

const CROSSREF_ENDPOINT = "https://api.crossref.org/works";
const KCI_ENDPOINT = "https://open.kci.go.kr/po/openapi/openApiSearch.kci";

export async function enrichPublicationIdentifiers(
  records,
  {
    crossref = false,
    kciApiKey = process.env.KCI_API_KEY ?? null,
    maxPublications = Number.POSITIVE_INFINITY,
    timeoutMs = 12_000,
    minDelayMs = 1_000,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  const report = {
    policy:
      "Identifier-only enrichment. Metadata APIs may update DOI/KCI IDs for titles already exposed on an official university profile; they never add publications.",
    crossref: crossref ? "ENABLED" : "DISABLED",
    kci: kciApiKey ? "ENABLED" : "DISABLED_NO_KCI_API_KEY",
    queried: 0,
    doi_matched: 0,
    kci_matched: 0,
    ambiguous_or_unmatched: 0,
    errors: [],
  };
  let remaining = maxPublications;
  const enrichedRecords = [];

  for (const record of records) {
    const publications = [];
    for (const publication of record.publications) {
      let enriched = { ...publication };
      if (remaining > 0 && (!publication.doi || !publication.kci_id)) {
        remaining -= 1;
        report.queried += 1;
        try {
          if (crossref && !enriched.doi) {
            const crossrefMatch = await queryCrossref(publication.title, {
              timeoutMs,
              fetchImpl,
            });
            if (crossrefMatch) {
              enriched.doi = crossrefMatch.doi;
              enriched.metadata_source = appendMetadataSource(
                enriched.metadata_source,
                "CROSSREF",
              );
              report.doi_matched += 1;
            }
            await wait(minDelayMs);
          }
          if (kciApiKey && !enriched.kci_id) {
            const kciMatch = await queryKci(publication.title, kciApiKey, {
              timeoutMs,
              fetchImpl,
            });
            if (kciMatch) {
              enriched.kci_id = kciMatch.kciId;
              enriched.doi = enriched.doi ?? kciMatch.doi;
              enriched.metadata_source = appendMetadataSource(enriched.metadata_source, "KCI");
              report.kci_matched += 1;
            }
            await wait(minDelayMs);
          }
          if (
            enriched.doi === publication.doi &&
            enriched.kci_id === publication.kci_id
          ) {
            report.ambiguous_or_unmatched += 1;
          }
        } catch (error) {
          report.errors.push({
            record_id: record.id,
            publication_title: publication.title,
            reason: error.message,
          });
        }
      }
      publications.push(enriched);
    }
    enrichedRecords.push({ ...record, publications });
  }
  return { records: enrichedRecords, report };
}

export async function queryCrossref(
  title,
  { timeoutMs = 12_000, fetchImpl = globalThis.fetch } = {},
) {
  const match = await queryCrossrefMetadata(
    { title },
    { timeoutMs, fetchImpl },
  );
  return match
    ? {
        doi: match.externalId,
        title: match.canonicalTitle,
        similarity: match.titleSimilarity,
      }
    : null;
}

export async function queryCrossrefMetadata(
  publication,
  {
    timeoutMs = 12_000,
    fetchImpl = globalThis.fetch,
    mailto = process.env.CROSSREF_MAILTO ?? null,
  } = {},
) {
  const title = normalizeSpace(publication?.title ?? "");
  if (!title) return null;
  const publicationYear = extractYear(publication?.published_date);
  const url = new URL(CROSSREF_ENDPOINT);
  url.searchParams.set(
    "query.bibliographic",
    publicationYear ? `${title} ${publicationYear}` : title,
  );
  url.searchParams.set("rows", "5");
  if (mailto) url.searchParams.set("mailto", mailto);
  const payload = await fetchWithTimeout(
    url,
    {
      headers: {
        accept: "application/json",
        "user-agent": mailto
          ? `${DEFAULT_USER_AGENT} (mailto:${mailto})`
          : DEFAULT_USER_AGENT,
      },
    },
    timeoutMs,
    fetchImpl,
  );
  const items = payload?.message?.items ?? [];
  const matches = items
    .map((item) => {
      const canonicalTitle = normalizeSpace(item.title?.[0] ?? "");
      const similarity = titleSimilarity(title, canonicalTitle);
      const matchedYear = crossrefYear(item);
      const yearDistance =
        publicationYear && matchedYear
          ? Math.abs(Number(publicationYear) - Number(matchedYear))
          : null;
      const yearScore =
        yearDistance === null ? 0.5 : yearDistance === 0 ? 1 : yearDistance === 1 ? 0.5 : 0;
      return {
        item,
        externalId: normalizeSpace(item.DOI ?? ""),
        canonicalTitle,
        titleSimilarity: similarity,
        matchedYear,
        yearDistance,
        matchScore: 0.9 * similarity + 0.1 * yearScore,
      };
    })
    .filter(
      (match) =>
        match.externalId &&
        match.titleSimilarity >= 0.94 &&
        (match.yearDistance === null || match.yearDistance <= 1),
    )
    .sort((left, right) => right.matchScore - left.matchScore);
  if (!matches.length) return null;
  if (matches[1] && matches[0].matchScore - matches[1].matchScore < 0.015) return null;
  const match = matches[0];
  const item = match.item;
  return {
    provider: "CROSSREF",
    externalId: match.externalId,
    canonicalTitle: match.canonicalTitle,
    journalTitle: normalizeSpace(item["container-title"]?.[0] ?? "") || null,
    authors: (item.author ?? [])
      .map((author) =>
        normalizeSpace([author.given, author.family].filter(Boolean).join(" ")),
      )
      .filter(Boolean),
    abstract: item.abstract ? cleanCrossrefText(item.abstract) : null,
    keywords: [...new Set((item.subject ?? []).map(normalizeSpace).filter(Boolean))],
    citationCount: Number.isInteger(item["is-referenced-by-count"])
      ? item["is-referenced-by-count"]
      : null,
    landingUrl: normalizeSpace(item.URL ?? "") || null,
    licenseUrl: normalizeSpace(item.license?.[0]?.URL ?? "") || null,
    matchedYear: match.matchedYear,
    titleSimilarity: match.titleSimilarity,
    matchScore: match.matchScore,
    matchMethod:
      match.titleSimilarity === 1
        ? match.yearDistance === 0
          ? "TITLE_EXACT_YEAR_EXACT"
          : "TITLE_EXACT"
        : match.yearDistance === 0
          ? "TITLE_FUZZY_YEAR_EXACT"
          : "TITLE_FUZZY",
  };
}

export async function queryKci(
  title,
  apiKey,
  { timeoutMs = 12_000, fetchImpl = globalThis.fetch } = {},
) {
  if (!apiKey) return null;
  const url = new URL(KCI_ENDPOINT);
  url.searchParams.set("apiCode", "articleSearch");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("title", title);
  url.searchParams.set("displayCount", "5");
  const xml = await fetchTextWithTimeout(
    url,
    {
      headers: {
        accept: "application/xml,text/xml",
        "user-agent": DEFAULT_USER_AGENT,
      },
    },
    timeoutMs,
    fetchImpl,
  );
  const matches = [];
  for (const record of xml.matchAll(/<record\b[^>]*>([\s\S]*?)<\/record>/gi)) {
    const articleInfo = /<articleInfo\b([^>]*)>([\s\S]*?)<\/articleInfo>/i.exec(record[1]);
    if (!articleInfo) continue;
    const kciId =
      /\barticle-id\s*=\s*["']([^"']+)["']/i.exec(articleInfo[1])?.[1] ?? null;
    const titles = [
      ...articleInfo[2].matchAll(/<article-title\b[^>]*>([\s\S]*?)<\/article-title>/gi),
    ].map((match) => xmlText(match[1]));
    const matchedTitle = titles
      .map((candidate) => ({ candidate, similarity: titleSimilarity(title, candidate) }))
      .sort((left, right) => right.similarity - left.similarity)[0];
    if (!kciId || !matchedTitle || matchedTitle.similarity < 0.96) continue;
    matches.push({
      kciId: decodeHtmlEntities(kciId),
      doi: xmlTag(articleInfo[2], "doi"),
      similarity: matchedTitle.similarity,
    });
  }
  matches.sort((left, right) => right.similarity - left.similarity);
  if (!matches.length) return null;
  if (matches[1] && matches[0].similarity - matches[1].similarity < 0.01) return null;
  return matches[0];
}

export function titleSimilarity(left, right) {
  const normalize = (value) =>
    normalizeSpace(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const leftTokens = new Set(a.split(" "));
  const rightTokens = new Set(b.split(" "));
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

async function fetchWithTimeout(url, options, timeoutMs, fetchImpl) {
  const text = await fetchTextWithTimeout(url, options, timeoutMs, fetchImpl);
  return JSON.parse(text);
}

async function fetchTextWithTimeout(url, options, timeoutMs, fetchImpl) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...options,
        redirect: "error",
        signal: controller.signal,
      });
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < 2
      ) {
        const retryAfter = retryAfterMilliseconds(
          response.headers.get("retry-after"),
        );
        await wait(retryAfter ?? 1_000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Metadata API returned HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt >= 2 || error?.name !== "AbortError") throw error;
      await wait(1_000 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error("Metadata API request failed");
}

function xmlTag(xml, name) {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(xml);
  return match ? xmlText(match[1]) || null : null;
}

function xmlText(value) {
  return normalizeSpace(decodeHtmlEntities(String(value).replace(/<[^>]+>/g, " ")));
}

function appendMetadataSource(current, source) {
  const values = new Set(normalizeSpace(current || "OFFICIAL_PROFILE").split("+"));
  values.add(source);
  return [...values].join("+");
}

function extractYear(value) {
  return /(?:19|20)\d{2}/.exec(normalizeSpace(value ?? ""))?.[0] ?? null;
}

function crossrefYear(item) {
  for (const key of ["published-print", "published-online", "published", "issued"]) {
    const year = item?.[key]?.["date-parts"]?.[0]?.[0];
    if (Number.isInteger(year)) return String(year);
  }
  return null;
}

function cleanCrossrefText(value) {
  return normalizeSpace(
    decodeHtmlEntities(
      String(value)
        .replace(/<\/?jats:[^>]+>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  ) || null;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
}
