"use client";

/**
 * 브라우저에서 PDF 텍스트를 뽑아냅니다.
 *
 * 파일은 서버로 보내지 않습니다. 학생 기기 안에서만 열고, 필요한 부분만
 * AI 요청에 실어 보냅니다. 텍스트가 없는 스캔 PDF는 만들어 내지 않고 실패로 알립니다.
 */

export type PdfPage = {
  page: number;
  text: string;
  /** 문장 단위로 나눈 것. 문장을 골라 근거로 남기기 위해 씁니다. */
  sentences: string[];
};

export type PdfDocument = {
  fileName: string;
  pageCount: number;
  pages: PdfPage[];
  /** 텍스트 레이어가 거의 없으면 스캔본으로 봅니다. */
  looksScanned: boolean;
  /**
   * 페이지를 다시 그릴 때 쓰는 원본 바이트.
   * 파일은 이 브라우저 안에만 있고 서버로 보내지 않습니다.
   */
  bytes: ArrayBuffer;
};

/** 캔버스에 그린 페이지. 원본 레이아웃을 그대로 보여주거나 비전 입력으로 씁니다. */
export type RenderedPage = {
  page: number;
  dataUrl: string;
  width: number;
  height: number;
};

/**
 * 지정한 페이지를 이미지로 그립니다.
 *
 * scale은 화면 표시용(1.5 안팎)과 비전 입력용(1.0 안팎)을 나눠 쓰라고 열어 둡니다.
 * 큰 배율은 토큰과 메모리를 함께 키웁니다.
 */
export async function renderPdfPage(
  bytes: ArrayBuffer,
  pageNumber: number,
  scale = 1.5,
): Promise<RenderedPage> {
  if (bytes.byteLength === 0) {
    throw new PdfReadError("parse-failed", "원본 데이터를 더 이상 읽을 수 없습니다.");
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  // getDocument가 버퍼를 소유하므로 복사본을 넘겨 원본을 재사용할 수 있게 합니다.
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new PdfReadError("parse-failed", "페이지를 그리지 못했습니다.");
  /*
   * pdfjs의 렌더 루프는 requestAnimationFrame으로 다음 조각을 예약합니다.
   * 탭이 배경으로 내려가거나 창이 화면에 합성되지 않으면 rAF가 발동하지 않아
   * 렌더가 끝나지 않습니다. 그동안 화면이 계속 로딩으로 남는 것을 막기 위해
   * 시간이 지나면 실패로 돌리고, 화면은 텍스트 읽기로 계속 진행합니다.
   */
  const task = page.render({ canvas, canvasContext: context, viewport } as unknown as Parameters<typeof page.render>[0]);
  const RENDER_TIMEOUT_MS = 8_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task.promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new PdfReadError("parse-failed", "원본 이미지를 그리지 못했습니다.")),
          RENDER_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    task.cancel();
  }
  return {
    page: pageNumber,
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
    width: canvas.width,
    height: canvas.height,
  };
}

export class PdfReadError extends Error {
  constructor(readonly code: "encrypted" | "scanned" | "parse-failed" | "too-many-pages", message: string) {
    super(message);
  }
}

const MAX_READER_PAGES = 40;

export function assertSupportedPdfPageCount(pageCount: number): void {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_READER_PAGES) {
    throw new PdfReadError(
      "too-many-pages",
      `논문 리더는 ${MAX_READER_PAGES}쪽 이하 PDF를 지원합니다. 필요한 부분만 나눠 다시 열어 주세요.`,
    );
  }
}

/** 한국어·영어 문장 끝을 기준으로 자릅니다. 약어 뒤 마침표는 완벽히 거르지 못합니다. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!。])\s+|(?<=[다요음])\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

export async function extractPdfText(file: File): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  let doc;
  try {
    // 원본 버퍼는 나중에 페이지를 그릴 때 다시 쓰므로 복사본을 넘깁니다.
    doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") {
      throw new PdfReadError("encrypted", "암호가 걸린 PDF는 열 수 없습니다. 암호를 푼 파일로 다시 올려 주세요.");
    }
    throw new PdfReadError("parse-failed", "PDF를 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.");
  }

  assertSupportedPdfPageCount(doc.numPages);

  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page: n, text, sentences: splitSentences(text) });
  }

  const totalChars = pages.reduce((sum, page) => sum + page.text.length, 0);
  const looksScanned = totalChars < doc.numPages * 40;
  if (looksScanned) {
    throw new PdfReadError(
      "scanned",
      "텍스트 레이어가 없는 스캔본으로 보입니다. 글자를 선택할 수 있는 PDF를 올리거나 OCR을 거친 파일을 사용해 주세요.",
    );
  }

  return { fileName: file.name, pageCount: doc.numPages, pages, looksScanned, bytes: buffer };
}
