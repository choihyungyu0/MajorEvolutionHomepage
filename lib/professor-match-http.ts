import type {
  ProfessorMatchResponse,
  ProfessorMatchTopic,
} from "@/lib/professor-domain";

const PROFESSOR_MATCH_TIMEOUT_MS = 25_000;

type ErrorPayload = { error?: string };

export type ProfessorMatchHttpOptions = {
  excludeIds?: string[];
  signal?: AbortSignal;
};

export class ProfessorMatchRequestAbortedError extends Error {
  constructor() {
    super("교수 연결 요청이 취소되었습니다.");
    this.name = "ProfessorMatchRequestAbortedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isProfessorMatchResponse(
  value: unknown,
  expectedTopicId: string,
): value is ProfessorMatchResponse {
  if (!isRecord(value)) return false;
  if (
    value.topicId !== expectedTopicId
    || !Array.isArray(value.matches)
    || typeof value.officialRecordCount !== "number"
    || !["SAMPLE", "PARTIAL", "COMPLETE"].includes(String(value.scopeStatus))
    || !Array.isArray(value.coverageGaps)
    || typeof value.note !== "string"
    || !["ai-reranked", "official-rules"].includes(String(value.rankingSource))
    || (value.rankingModel !== null && typeof value.rankingModel !== "string")
  ) {
    return false;
  }

  return value.matches.every((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.professor)) return false;
    return (
      ["TOPIC", "METHOD", "CONTEXT"].includes(String(candidate.role))
      && ["DIRECT", "RELATED", "LIMITED"].includes(String(candidate.strength))
      && typeof candidate.reason === "string"
      && (candidate.mentorFitReason === undefined || typeof candidate.mentorFitReason === "string")
      && isStringArray(candidate.evidenceIds)
      && isStringArray(candidate.matchedTerms)
      && isStringArray(candidate.doesNotEstablish)
      && typeof candidate.professor.id === "string"
      && typeof candidate.professor.name === "string"
      && typeof candidate.professor.officialProfileUrl === "string"
      && Array.isArray(candidate.professor.researchFields)
      && Array.isArray(candidate.professor.publications)
    );
  });
}

export async function postProfessorMatch(
  topic: ProfessorMatchTopic,
  university: string,
  options: ProfessorMatchHttpOptions = {},
): Promise<ProfessorMatchResponse> {
  if (options.signal?.aborted) throw new ProfessorMatchRequestAbortedError();

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PROFESSOR_MATCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("/api/professors/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        university,
        topic,
        excludeIds: options.excludeIds ?? [],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error("교수 연결이 25초 안에 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }
    if (options.signal?.aborted || controller.signal.aborted) {
      throw new ProfessorMatchRequestAbortedError();
    }
    throw error instanceof Error
      ? error
      : new Error("교수 연결 서버에 접속하지 못했습니다.");
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "교수 연결 응답 형식을 확인하지 못했습니다."
        : `교수 연결 서버가 오류 응답을 보냈습니다. (${response.status})`,
    );
  }
  if (!response.ok) {
    const errorPayload = isRecord(data) ? data as ErrorPayload : null;
    throw new Error(
      errorPayload?.error || "공식 교수 데이터를 연결하지 못했습니다.",
    );
  }
  if (!isProfessorMatchResponse(data, topic.id)) {
    throw new Error("교수 연결 응답 구성이 올바르지 않습니다.");
  }
  return data;
}
