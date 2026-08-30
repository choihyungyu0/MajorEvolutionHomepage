import { NextResponse } from "next/server";
import {
  AiServiceError,
  generateCoDesignFollowUpQuestions,
} from "@/lib/openai-server";
import type { CoDesignFollowUpRequest } from "@/lib/co-design-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: CoDesignFollowUpRequest;
  try {
    body = await request.json() as CoDesignFollowUpRequest;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "맞춤 질문 요청 형식이 올바르지 않습니다." } },
      { status: 400 },
    );
  }

  if (!body?.mode || !body?.conditions || !Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "맞춤 질문에 필요한 맥락을 확인해 주세요." } },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await generateCoDesignFollowUpQuestions(body),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const serviceError = error instanceof AiServiceError
      ? error
      : new AiServiceError("upstream", "맞춤 후속 질문을 만들지 못했습니다.", 502);
    console.error("[ai/co-design/questions]", serviceError.code);
    return NextResponse.json(
      { error: { code: serviceError.code, message: serviceError.message } },
      { status: serviceError.status },
    );
  }
}
