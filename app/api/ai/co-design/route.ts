import { NextResponse } from "next/server";
import { AiServiceError, generateCoDesignCandidates } from "@/lib/openai-server";
import type { CoDesignRequest } from "@/lib/co-design-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: CoDesignRequest;
  try {
    body = await request.json() as CoDesignRequest;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "공동설계 요청 형식이 올바르지 않습니다." } },
      { status: 400 },
    );
  }

  if (!body?.mode || !body?.conditions || !Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "공동설계 맥락과 답변을 확인해 주세요." } },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await generateCoDesignCandidates(body),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const serviceError = error instanceof AiServiceError
      ? error
      : new AiServiceError("upstream", "AI 공동설계를 완료하지 못했습니다.", 502);
    console.error("[ai/co-design]", serviceError.code);
    return NextResponse.json(
      { error: { code: serviceError.code, message: serviceError.message } },
      { status: serviceError.status },
    );
  }
}
