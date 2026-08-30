type ResolveOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function crossrefContainerTitle(message: JsonRecord): string | null {
  const value = message["container-title"];
  return readString(Array.isArray(value) ? value[0] : value);
}

function safeAssetSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 80);
}

export async function resolvePublicPdfDownloadUrl(
  input: { pdfUrl: string; doi: string | null },
  options: ResolveOptions = {},
): Promise<string> {
  const url = new URL(input.pdfUrl);
  if (url.hostname.toLocaleLowerCase("en-US") !== "www.mdpi.com") return url.toString();
  const doi = input.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  if (!doi || !doi.toLocaleLowerCase("en-US").startsWith("10.3390/")) return url.toString();

  const response = await (options.fetcher ?? fetch)(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "MajorEvolutionHomepage/0.1 public-pdf-resolver",
      },
      cache: "no-store",
      signal: options.signal,
    },
  );
  if (!response.ok) return url.toString();
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return url.toString();
  }
  if (!isRecord(data) || !isRecord(data.message)) return url.toString();
  const journal = crossrefContainerTitle(data.message);
  const volume = readString(data.message.volume);
  const articleNumber = readString(data.message["article-number"]) ?? readString(data.message.page);
  if (!journal || !volume || !articleNumber) return url.toString();
  const journalSlug = safeAssetSlug(journal);
  const article = articleNumber.replace(/\D/g, "").padStart(5, "0");
  if (!journalSlug || !article) return url.toString();
  const fileBase = `${journalSlug}-${volume}-${article}`;
  return `https://mdpi-res.com/d_attachment/${journalSlug}/${fileBase}/article_deploy/${fileBase}-v2.pdf`;
}
