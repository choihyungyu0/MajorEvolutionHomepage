import type { RateLimitStore } from "@/lib/rate-limit-store";

export const PAPER_PDF_RATE_LIMITS = {
  perMinute: { windowMs: 60_000, max: 4 },
  perHour: { windowMs: 60 * 60_000, max: 20 },
} as const;

type PaperPdfRateLimitScope = "minute" | "hour" | "store";

export type PaperPdfRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number; scope: PaperPdfRateLimitScope };

type CounterStore = Pick<RateLimitStore, "increment" | "kind">;

type PaperPdfRateLimitOptions = {
  store: CounterStore;
  now?: number;
};

function normalizedClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const raw = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return raw
    .slice(0, 120)
    .replace(/[^0-9a-f:.\-]/gi, "_")
    || "unknown";
}

export async function checkPaperPdfRequestLimit(
  request: Request,
  { store, now = Date.now() }: PaperPdfRateLimitOptions,
): Promise<PaperPdfRateLimitResult> {
  const client = normalizedClientKey(request);
  const checks = [
    { scope: "minute" as const, bucket: `paper-pdf:m:${client}`, ...PAPER_PDF_RATE_LIMITS.perMinute },
    { scope: "hour" as const, bucket: `paper-pdf:h:${client}`, ...PAPER_PDF_RATE_LIMITS.perHour },
  ];

  try {
    for (const check of checks) {
      const hit = await store.increment(check.bucket, check.windowMs, now);
      if (hit.count > check.max) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, hit.resetInSec),
          scope: check.scope,
        };
      }
    }
    return { allowed: true };
  } catch {
    // 자동 PDF는 선택 기능이므로 제한 저장소 오류 시 비싼 외부 호출을 안전하게 멈춘다.
    return { allowed: false, retryAfterSec: 60, scope: "store" };
  }
}
