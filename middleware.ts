import { NextResponse } from "next/server";
import { checkAiRateLimit, rateLimitMessage } from "@/lib/rate-limit";

/**
 * AI 엔드포인트 앞단 가드.
 *
 * 라우트마다 붙이지 않고 한곳에서 막습니다. 새로 추가되는 /api/ai/* 도
 * 자동으로 같은 제한을 받습니다.
 */
export async function middleware(request: Request) {
  const result = await checkAiRateLimit(request);
  if (result.allowed) return NextResponse.next();

  console.warn("[ai] rate limited", result.scope, `(${result.store})`);
  return NextResponse.json(
    { error: { code: "rate_limited", message: rateLimitMessage(result.scope) } },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}

export const config = {
  matcher: "/api/ai/:path*",
  runtime: "nodejs",
};
