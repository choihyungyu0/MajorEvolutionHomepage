import { NextResponse } from "next/server";
import { AiServiceError, generateCoachResponse } from "@/lib/openai-server";
import type { AiCoachRequest, AiCoachTask } from "@/lib/ai-coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tasks: AiCoachTask[] = ["simplify-trend", "major-focus", "interview-question", "idea-summary"];

export async function POST(request: Request) {
  let body: AiCoachRequest;
  try {
    body = await request.json() as AiCoachRequest;
  } catch {
    return NextResponse.json({ error: { code: "invalid_request", message: "요청 형식이 올바르지 않습니다." } }, { status: 400 });
  }
  if (!tasks.includes(body?.task) || !body?.context || typeof body.context !== "object") {
    return NextResponse.json({ error: { code: "invalid_request", message: "AI 도움 요청의 맥락을 확인해 주세요." } }, { status: 400 });
  }
  try {
    return NextResponse.json(await generateCoachResponse(body), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const serviceError = error instanceof AiServiceError ? error : new AiServiceError("upstream", "AI 도움을 완료하지 못했습니다.", 502);
    console.error("[ai/coach]", serviceError.code);
    return NextResponse.json({ error: { code: serviceError.code, message: serviceError.message } }, { status: serviceError.status });
  }
}
