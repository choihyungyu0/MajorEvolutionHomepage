export type PublicPdfExtractionResult = {
  text: string;
  pageCount: number;
  sourceUrl: string;
};

type PdfParser = (bytes: Uint8Array) => Promise<{ text: string; pageCount: number }>;

type ExtractOptions = {
  fetcher?: typeof fetch;
  parser?: PdfParser;
  signal?: AbortSignal;
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 40;
const MAX_EXTRACTED_TEXT = 12_000;
const MAX_REDIRECTS = 3;
const ALLOWED_PDF_HOSTS = new Set([
  "arxiv.org",
  "export.arxiv.org",
  "pmc.ncbi.nlm.nih.gov",
  "www.ncbi.nlm.nih.gov",
  "europepmc.org",
  "www.ebi.ac.uk",
  "zenodo.org",
  "hal.science",
  "osf.io",
  "mdpi-res.com",
]);

export function isAllowedPublicPdfUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:"
      && (url.port === "" || url.port === "443")
      && !url.username
      && !url.password
      && ALLOWED_PDF_HOSTS.has(url.hostname.toLocaleLowerCase("en-US"))
    );
  } catch {
    return false;
  }
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES) {
    throw new Error("자동으로 가져올 PDF는 10MB 이하만 지원합니다.");
  }
  if (!response.body) throw new Error("공개 PDF 응답 본문이 비어 있습니다.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PDF_BYTES) {
        await reader.cancel();
        throw new Error("자동으로 가져올 PDF는 10MB 이하만 지원합니다.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes;
}

export async function downloadVerifiedPublicPdf(
  initialUrl: string,
  options: ExtractOptions,
): Promise<{ bytes: Uint8Array; sourceUrl: string }> {
  const fetcher = options.fetcher ?? fetch;
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!isAllowedPublicPdfUrl(currentUrl)) {
      throw new Error("검증된 공개 학술 저장소의 HTTPS PDF만 자동으로 가져올 수 있습니다.");
    }
    const response = await fetcher(currentUrl, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        "User-Agent": "MajorEvolutionHomepage/0.1 licensed-public-pdf-reader",
      },
      cache: "no-store",
      redirect: "manual",
      signal: options.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount >= MAX_REDIRECTS) {
        throw new Error("공개 PDF 리디렉션을 안전하게 확인하지 못했습니다.");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`공개 PDF를 내려받지 못했습니다. (${response.status})`);
    }
    const contentType = response.headers.get("content-type")?.toLocaleLowerCase("en-US") ?? "";
    const bytes = await readLimitedBody(response);
    const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
    if (!contentType.includes("pdf") || signature !== "%PDF-") {
      throw new Error("응답이 확인 가능한 PDF 형식이 아닙니다.");
    }
    return { bytes, sourceUrl: currentUrl };
  }
  throw new Error("공개 PDF 리디렉션을 안전하게 확인하지 못했습니다.");
}

async function parseWithPdfJs(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
  });
  const document = await loadingTask.promise;
  const pageCount = Math.min(document.numPages, MAX_PDF_PAGES);
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push(text);
      if (pages.join("\n\n").length >= MAX_EXTRACTED_TEXT) break;
    }
  } finally {
    await document.destroy();
  }
  return {
    pageCount,
    text: pages.join("\n\n").slice(0, MAX_EXTRACTED_TEXT).trim(),
  };
}

export async function extractPublicPdfText(
  url: string,
  options: ExtractOptions = {},
): Promise<PublicPdfExtractionResult> {
  const { bytes, sourceUrl } = await downloadVerifiedPublicPdf(url, options);
  const parsed = await (options.parser ?? parseWithPdfJs)(bytes);
  const text = parsed.text
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT);
  if (!text) {
    throw new Error("PDF에서 분석할 텍스트를 찾지 못했습니다. 스캔 문서는 직접 입력해 주세요.");
  }
  return {
    text,
    pageCount: Math.min(Math.max(0, parsed.pageCount), MAX_PDF_PAGES),
    sourceUrl,
  };
}
