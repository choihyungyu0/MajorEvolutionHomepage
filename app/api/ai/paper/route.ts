import { NextResponse } from "next/server";
import { AiServiceError, analyzePaper } from "@/lib/openai-server";
import type { PaperAnalysisRequest } from "@/lib/paper-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: PaperAnalysisRequest;
  try {
    body = await request.json() as PaperAnalysisRequest;
  } catch {
    return NextResponse.json({ error: { code: "invalid_request", message: "요청 형식이 올바르지 않습니다." } }, { status: 400 });
  }

  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (content.length < 80) {
    return NextResponse.json({ error: { code: "invalid_request", message: "논문 초록이나 본문을 80자 이상 입력해 주세요." } }, { status: 400 });
  }
  if (content.length > 12_000) {
    return NextResponse.json({ error: { code: "invalid_request", message: "한 번에 분석할 내용은 12,000자 이하로 줄여 주세요." } }, { status: 400 });
  }

  try {
    const result = await analyzePaper(body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const serviceError = error instanceof AiServiceError
      ? error
      : new AiServiceError("upstream", "논문 분석을 완료하지 못했습니다.", 502);
    console.error("[ai/paper]", serviceError.code);
    return NextResponse.json({ error: { code: serviceError.code, message: serviceError.message } }, { status: serviceError.status });
  }
}
