import { NextResponse } from "next/server";
import { AiServiceError, generateIdeas } from "@/lib/openai-server";
import type { AiIdeasRequest } from "@/lib/ai-journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: AiIdeasRequest;
  try {
    body = await request.json() as AiIdeasRequest;
  } catch {
    return NextResponse.json({ error: { code: "invalid_request", message: "요청 형식이 올바르지 않습니다." } }, { status: 400 });
  }

  if (!body?.profile?.major?.trim() || !body?.selectedTrend?.title?.trim()) {
    return NextResponse.json({ error: { code: "invalid_request", message: "프로필과 탐색 방향을 확인해 주세요." } }, { status: 400 });
  }

  try {
    const result = await generateIdeas(body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const serviceError = error instanceof AiServiceError
      ? error
      : new AiServiceError("upstream", "새 아이디어를 만들지 못했습니다.", 502);
    console.error("[ai/ideas]", serviceError.code);
    return NextResponse.json({ error: { code: serviceError.code, message: serviceError.message } }, { status: serviceError.status });
  }
}

