import { NextResponse } from "next/server";
import {
  lookupPublicPaperContent,
  lookupRelatedPublicPaperCandidate,
  type PaperContentLookupResult,
} from "@/lib/paper-content-lookup";
import { getOfficialProfessorById } from "@/lib/professor-data.server";
import { checkPaperPdfRequestLimit } from "@/lib/paper-pdf-rate-limit";
import { downloadVerifiedPublicPdf } from "@/lib/public-pdf-extractor.server";
import { resolvePublicPdfDownloadUrl } from "@/lib/public-pdf-source.server";
import { getRateLimitStore } from "@/lib/rate-limit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000;
const MAX_ID_LENGTH = 80;
const DOWNLOAD_TIMEOUT_MS = 25_000;

function readId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_ID_LENGTH) : "";
}

function encodedHeader(value: string | null | undefined): string {
  return encodeURIComponent(value?.trim() || "");
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "PDF 조회 요청 데이터가 너무 큽니다." }, { status: 413 });
  }
  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "PDF 조회 요청 데이터가 너무 큽니다." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "요청 형식을 확인해 주세요." }, { status: 400 });
  }
  const raw = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
  const professorId = readId(raw?.professorId);
  const paperId = readId(raw?.paperId);
  const relatedPaperId = readId(raw?.relatedPaperId);
  if (!professorId || !paperId) {
    return NextResponse.json({ error: "교수님과 논문을 다시 선택해 주세요." }, { status: 400 });
  }
  const professor = getOfficialProfessorById(professorId);
  const publication = professor?.publications.find((item) => item.id === paperId);
  if (!professor || !publication) {
    return NextResponse.json(
      { error: "현재 공식 교수 데이터에서 논문을 확인하지 못했습니다." },
      { status: 404 },
    );
  }
  const relatedPublication = relatedPaperId
    ? professor.publications.find((item) => item.id === relatedPaperId)
    : null;
  if (relatedPaperId && !relatedPublication) {
    return NextResponse.json(
      { error: "확인한 관련 논문이 현재 교수님의 공식 목록에 없습니다." },
      { status: 404 },
    );
  }

  const rateLimit = await checkPaperPdfRequestLimit(request, {
    store: getRateLimitStore(),
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "공개 PDF 자동 열기 요청이 잠시 몰렸습니다. 잠시 후 다시 시도해 주세요." },
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": String(rateLimit.retryAfterSec),
        },
      },
    );
  }

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)]);
  const options = {
    signal,
    openAlexApiKey: process.env.OPENALEX_API_KEY,
    crossrefMailto: process.env.CROSSREF_MAILTO,
  };
  try {
    let publicPaper: PaperContentLookupResult = await lookupPublicPaperContent({
      title: publication.title,
      publishedDate: publication.publishedDate,
      doi: publication.doi,
    }, options);
    if (!publicPaper.pdfUrl) {
      const related = relatedPublication
        ? await lookupRelatedPublicPaperCandidate([{ ...relatedPublication }], options)
        : null;
      if (related?.result.pdfUrl) publicPaper = related.result;
    }
    if (!publicPaper.pdfUrl || !publicPaper.license) {
      return NextResponse.json(
        { error: "자동으로 열 수 있는 공개 PDF를 찾지 못했습니다. 관련 후보를 3분 카드에서 확인하거나 직접 업로드해 주세요." },
        { status: 404 },
      );
    }
    const downloadUrl = await resolvePublicPdfDownloadUrl({
      pdfUrl: publicPaper.pdfUrl,
      doi: publicPaper.matchedDoi ?? publication.doi,
    }, { signal });
    const downloaded = await downloadVerifiedPublicPdf(downloadUrl, { signal });
    const title = publicPaper.matchedTitle ?? publication.title;
    const responseBody = Uint8Array.from(downloaded.bytes).buffer;
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/pdf",
        "Content-Length": String(downloaded.bytes.byteLength),
        "Content-Disposition": 'attachment; filename="public-paper.pdf"',
        "X-Paper-Title": encodedHeader(title),
        "X-Paper-Source-Url": encodedHeader(downloaded.sourceUrl),
        "X-Paper-License": encodedHeader(publicPaper.license),
      },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "공개 PDF를 자동으로 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: signal.aborted ? 504 : 422 });
  }
}
