import type { AiIdeasRequest, AiJourneyRequest, AiJourneyResult } from "@/lib/ai-journey";
import type { Idea } from "@/data/prototype";

type ApiErrorPayload = { error?: { message?: string } };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as T & ApiErrorPayload;
  if (!response.ok) throw new Error(payload.error?.message || "AI 요청을 완료하지 못했습니다.");
  return payload;
}

export function requestAiJourney(body: AiJourneyRequest): Promise<AiJourneyResult> {
  return postJson<AiJourneyResult>("/api/ai/journey", body);
}

export function requestAiIdeas(body: AiIdeasRequest): Promise<{ ideas: Idea[]; generatedAt: string; model: string }> {
  return postJson<{ ideas: Idea[]; generatedAt: string; model: string }>("/api/ai/ideas", body);
}

