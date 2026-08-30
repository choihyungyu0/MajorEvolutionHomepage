import { NextResponse } from "next/server";
import {
  lookupPublicPaperContent,
  lookupRelatedPublicPaperCandidate,
  type RelatedPaperLookupInput,
} from "@/lib/paper-content-lookup";
import {
  createPaperContentCache,
  PAPER_CONTENT_NEGATIVE_CACHE_TTL_MS,
} from "@/lib/paper-content-cache";
import {
  materializePublicPaperContent,
  type MaterializedPaperContent,
} from "@/lib/paper-content-materializer.server";
import { getOfficialProfessorById } from "@/lib/professor-data.server";
import { checkPaperPdfRequestLimit } from "@/lib/paper-pdf-rate-limit";
import { extractPublicPdfText } from "@/lib/public-pdf-extractor.server";
import { getRateLimitStore } from "@/lib/rate-limit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000;
const MAX_ID_LENGTH = 80;
const LOOKUP_TIMEOUT_MS = 16_000;

type PaperContentRouteResponse = Omit<MaterializedPaperContent, "status"> & {
  status: "found" | "candidate" | "unavailable" | "error";
  paperId: string;
  title: string;
  relatedOfficialPaper: RelatedPaperLookupInput | null;
  fetchedAt: string;
};

const paperContentCache = createPaperContentCache<PaperContentRouteResponse>({ maxEntries: 2_000 });

function readId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_ID_LENGTH) : "";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "논문 조회 요청 데이터가 너무 큽니다." }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "논문 조회 요청 데이터가 너무 큽니다." }, { status: 413 });
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

  const cacheKey = `${professorId}:${paperId}`;
  const cached = paperContentCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Paper-Lookup-Sources": "OpenAlex, Crossref",
        "X-Paper-Cache": "HIT",
      },
    });
  }

  const rateLimit = await checkPaperPdfRequestLimit(request, {
    store: getRateLimitStore(),
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "공개 논문 자동 조회 요청이 잠시 몰렸습니다. 잠시 후 다시 시도해 주세요." },
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": String(rateLimit.retryAfterSec),
        },
      },
    );
  }

  const signal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  ]);
  const lookupOptions = {
    signal,
    openAlexApiKey: process.env.OPENALEX_API_KEY,
    crossrefMailto: process.env.CROSSREF_MAILTO,
  };
  const lookupResult = await lookupPublicPaperContent({
    title: publication.title,
    publishedDate: publication.publishedDate,
    doi: publication.doi,
  }, lookupOptions);

  let result = await materializePublicPaperContent(
    lookupResult,
    signal,
    extractPublicPdfText,
  );
  let relatedOfficialPaper: RelatedPaperLookupInput | null = null;
  let responseStatus: PaperContentRouteResponse["status"] = result.status === "pdf_available"
    ? "unavailable"
    : result.status;

  if (result.status !== "found" && lookupResult.status === "unavailable") {
    const relatedCandidate = await lookupRelatedPublicPaperCandidate(
      professor.publications
        .map((item) => ({ ...item })),
      lookupOptions,
    );
    if (relatedCandidate) {
      const candidateContent = await materializePublicPaperContent(
        relatedCandidate.result,
        signal,
        extractPublicPdfText,
      );
      if (candidateContent.status === "error") {
        result = candidateContent;
        responseStatus = "error";
        relatedOfficialPaper = relatedCandidate.officialPaper;
      } else if (candidateContent.status === "found" && candidateContent.content) {
        result = {
          ...candidateContent,
          message: "같은 교수님의 공식 목록에서 관련 공개 논문 후보를 찾았습니다. 제목·연도·DOI를 확인한 뒤 불러와 주세요.",
        };
        responseStatus = "candidate";
        relatedOfficialPaper = relatedCandidate.officialPaper;
      }
    }
  }

  const responsePayload: PaperContentRouteResponse = {
    ...result,
    status: responseStatus,
    paperId: publication.id,
    title: publication.title,
    relatedOfficialPaper,
    fetchedAt: new Date().toISOString(),
  };
  if (responsePayload.status !== "error") {
    paperContentCache.set(
      cacheKey,
      responsePayload,
      responsePayload.status === "unavailable"
        ? PAPER_CONTENT_NEGATIVE_CACHE_TTL_MS
        : undefined,
    );
  }

  return NextResponse.json(responsePayload, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Paper-Lookup-Sources": "OpenAlex, Crossref",
      "X-Paper-Cache": "MISS",
    },
  });
}
