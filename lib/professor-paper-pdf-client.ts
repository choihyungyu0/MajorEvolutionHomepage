const MAX_PUBLIC_PDF_BYTES = 10 * 1024 * 1024;

type RequestOptions = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

function safeFileName(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${cleaned || "공개 논문"}.pdf`;
}

function decodedHeader(response: Response, name: string): string {
  const value = response.headers.get(name);
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export async function requestProfessorPaperPdf(
  selection: { professorId: string; paperId: string; relatedPaperId?: string | null },
  options: RequestOptions = {},
): Promise<{ file: File; sourceUrl: string }> {
  const professorId = selection.professorId.trim();
  const paperId = selection.paperId.trim();
  const relatedPaperId = selection.relatedPaperId?.trim() || null;
  if (!professorId || !paperId) throw new Error("교수님과 논문을 다시 선택해 주세요.");
  const response = await (options.fetcher ?? fetch)("/api/professors/paper-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      professorId,
      paperId,
      ...(relatedPaperId ? { relatedPaperId } : {}),
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    let message = "공개 PDF를 자동으로 불러오지 못했습니다.";
    try {
      const data = await response.json() as { error?: unknown };
      if (typeof data.error === "string") message = data.error;
    } catch {
      // JSON 오류 본문이 아니면 기본 안내를 사용합니다.
    }
    throw new Error(message);
  }
  const contentType = response.headers.get("content-type")?.toLocaleLowerCase("en-US") ?? "";
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (!contentType.includes("pdf") || (Number.isFinite(declaredLength) && declaredLength > MAX_PUBLIC_PDF_BYTES)) {
    throw new Error("자동 다운로드 응답이 확인 가능한 PDF 형식이 아닙니다.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PUBLIC_PDF_BYTES) {
    throw new Error("자동으로 가져올 PDF는 10MB 이하만 지원합니다.");
  }
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") throw new Error("자동 다운로드 응답이 확인 가능한 PDF 형식이 아닙니다.");
  const title = decodedHeader(response, "X-Paper-Title");
  const sourceUrl = decodedHeader(response, "X-Paper-Source-Url");
  return {
    file: new File([bytes], safeFileName(title), { type: "application/pdf" }),
    sourceUrl,
  };
}
