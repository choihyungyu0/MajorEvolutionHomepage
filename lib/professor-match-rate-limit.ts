import { createHash } from "node:crypto";
import type { RateLimitStore } from "@/lib/rate-limit-store";

export const PROFESSOR_MATCH_AI_RATE_LIMITS = {
  perMinute: { windowMs: 60_000, max: 4 },
  perHour: { windowMs: 60 * 60_000, max: 20 },
} as const;

type ProfessorMatchAiRateLimitScope = "minute" | "hour" | "store";

export type ProfessorMatchAiRateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterSec: number;
      scope: ProfessorMatchAiRateLimitScope;
    };

type CounterStore = Pick<RateLimitStore, "increment" | "kind">;

type ProfessorMatchAiRateLimitOptions = {
  store: CounterStore;
  now?: number;
};

function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const identifier = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256")
    .update(identifier.slice(0, 256))
    .digest("hex")
    .slice(0, 32);
}

export async function checkProfessorMatchAiRequestLimit(
  request: Request,
  { store, now = Date.now() }: ProfessorMatchAiRateLimitOptions,
): Promise<ProfessorMatchAiRateLimitResult> {
  try {
    const client = clientFingerprint(request);
    const checks = [
      {
        scope: "minute" as const,
        bucket: `professor-match-ai:m:${client}`,
        ...PROFESSOR_MATCH_AI_RATE_LIMITS.perMinute,
      },
      {
        scope: "hour" as const,
        bucket: `professor-match-ai:h:${client}`,
        ...PROFESSOR_MATCH_AI_RATE_LIMITS.perHour,
      },
    ];

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
    return { allowed: false, retryAfterSec: 60, scope: "store" };
  }
}
