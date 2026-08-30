import type { PaperAnalysisRequest, PaperAnalysisResult } from "@/lib/paper-analysis";
import type {
  CoDesignFollowUpRequest,
  CoDesignFollowUpResponse,
  CoDesignRequest,
  CoDesignResponse,
} from "@/lib/co-design-ai";
import type {
  GrowthProfessorRequest,
  GrowthProfessorResponse,
} from "@/lib/ai-growth-professor";

type ApiErrorPayload = { error?: { message?: string } };

async function postJson<T>(
  url: string,
  body: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  const payload = await response.json() as T & ApiErrorPayload;
  if (!response.ok) throw new Error(payload.error?.message || "AI 요청을 완료하지 못했습니다.");
  return payload;
}

export function requestPaperAnalysis(
  body: PaperAnalysisRequest,
  options: { signal?: AbortSignal } = {},
): Promise<PaperAnalysisResult> {
  return postJson<PaperAnalysisResult>("/api/ai/paper", body, options);
}

export function requestCoDesignCandidates(body: CoDesignRequest): Promise<CoDesignResponse> {
  return postJson<CoDesignResponse>("/api/ai/co-design", body);
}

export function requestCoDesignFollowUpQuestions(
  body: CoDesignFollowUpRequest,
): Promise<CoDesignFollowUpResponse> {
  return postJson<CoDesignFollowUpResponse>("/api/ai/co-design/questions", body);
}

export function requestGrowthProfessorReply(
  body: GrowthProfessorRequest,
): Promise<GrowthProfessorResponse> {
  return postJson<GrowthProfessorResponse>("/api/ai/growth-professor", body);
}
