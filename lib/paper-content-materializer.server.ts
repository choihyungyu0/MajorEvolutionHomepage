import type { PaperContentLookupResult } from "@/lib/paper-content-lookup";

export type MaterializedPaperContent = PaperContentLookupResult & {
  contentSourceType: "abstract" | "pdf_text" | null;
  pageCount: number | null;
};

type PublicPdfTextExtractor = (
  url: string,
  options: { signal: AbortSignal },
) => Promise<{ text: string; sourceUrl: string; pageCount: number }>;

export async function materializePublicPaperContent(
  lookupResult: PaperContentLookupResult,
  signal: AbortSignal,
  extractPdfText: PublicPdfTextExtractor,
): Promise<MaterializedPaperContent> {
  if (lookupResult.status !== "pdf_available" || !lookupResult.pdfUrl) {
    return {
      ...lookupResult,
      contentSourceType: lookupResult.status === "found" ? "abstract" : null,
      pageCount: null,
    };
  }

  try {
    const extracted = await extractPdfText(lookupResult.pdfUrl, { signal });
    return {
      ...lookupResult,
      status: "found",
      content: extracted.text,
      pdfUrl: extracted.sourceUrl,
      contentSourceType: "pdf_text",
      pageCount: extracted.pageCount,
      message: `${lookupResult.license?.toUpperCase() ?? "오픈"} 라이선스 공개 PDF에서 텍스트를 가져왔습니다.`,
    };
  } catch {
    return {
      ...lookupResult,
      status: "error",
      content: null,
      contentSourceType: null,
      pageCount: null,
      message: "공개 PDF를 읽는 중 잠시 문제가 생겼습니다. 잠시 후 다시 시도하거나 직접 입력해 주세요.",
    };
  }
}
