import { NextResponse } from "next/server";
import { AiServiceError, generateGrowthProfessorReply } from "@/lib/openai-server";
import type { GrowthProfessorRequest } from "@/lib/ai-growth-professor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRIENDLY_ERROR_MESSAGES: Record<AiServiceError["code"], string> = {
  missing_key: "AI 교수님 연결 설정을 확인해 주세요. 작성한 내용은 그대로 남아 있어요.",
  rate_limited: "지금 대화 요청이 잠시 몰렸어요. 작성한 내용은 그대로 남아 있으니 잠깐 뒤 다시 보내 주세요.",
  timeout: "답변을 정리하는 데 시간이 조금 더 걸리고 있어요. 작성한 내용은 그대로 남아 있으니 다시 보내 주세요.",
  invalid_output: "답변을 읽기 좋게 정리하지 못했어요. 작성한 내용은 그대로 남아 있으니 한 번 더 보내 주세요.",
  upstream: "AI 교수님과 잠시 연결이 어렵습니다. 작성한 내용은 그대로 남아 있으니 잠깐 뒤 다시 보내 주세요.",
};

export async function POST(request: Request) {
  let body: GrowthProfessorRequest;
  try {
    body = await request.json() as GrowthProfessorRequest;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "대화 요청 형식이 올바르지 않습니다." } },
      { status: 400 },
    );
  }

  if (!body?.context || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "대화에 필요한 성장 맥락을 확인해 주세요." } },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await generateGrowthProfessorReply(body),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const serviceError = error instanceof AiServiceError
      ? error
      : new AiServiceError("upstream", "AI 성장 대화를 이어가지 못했습니다.", 502);
    console.error("[ai/growth-professor]", serviceError.code);
    return NextResponse.json(
      { error: { code: serviceError.code, message: FRIENDLY_ERROR_MESSAGES[serviceError.code] } },
      { status: serviceError.status },
    );
  }
}
