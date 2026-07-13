import { NextResponse } from "next/server";
import { AiServiceError, generateJourney } from "@/lib/openai-server";
import type { AiJourneyRequest } from "@/lib/ai-journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: AiJourneyRequest;
  try {
    body = await request.json() as AiJourneyRequest;
  } catch {
    return NextResponse.json({ error: { code: "invalid_request", message: "요청 형식이 올바르지 않습니다." } }, { status: 400 });
  }

  if (!body?.profile || typeof body.profile.major !== "string" || !body.profile.major.trim()) {
    return NextResponse.json({ error: { code: "invalid_request", message: "전공 정보를 확인해 주세요." } }, { status: 400 });
  }

  try {
    const result = await generateJourney(body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const serviceError = error instanceof AiServiceError
      ? error
      : new AiServiceError("upstream", "AI 분석을 완료하지 못했습니다.", 502);
    console.error("[ai/journey]", serviceError.code);
    return NextResponse.json({ error: { code: serviceError.code, message: serviceError.message } }, { status: serviceError.status });
  }
}

