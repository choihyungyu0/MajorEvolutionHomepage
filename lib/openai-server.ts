import "server-only";

import { randomUUID } from "node:crypto";
import type { AiDnaResult, AiIdeasRequest, AiJourneyRequest, AiJourneyResult } from "@/lib/ai-journey";
import type { ComparisonCriterion, Idea, StudentProfile, Trend } from "@/data/prototype";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const REQUEST_TIMEOUT_MS = 45_000;
const SCORE_KEYS: ComparisonCriterion[] = [
  "personalFit",
  "majorFit",
  "dataAccess",
  "feasibility",
  "careerValue",
  "novelty",
];

type JsonRecord = Record<string, unknown>;

type OpenAiResponse = {
  model?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

export class AiServiceError extends Error {
  constructor(
    public readonly code: "missing_key" | "rate_limited" | "upstream" | "invalid_output" | "timeout",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const shortString = { type: "string", minLength: 1, maxLength: 90 } as const;
const stringList = {
  type: "array",
  minItems: 1,
  maxItems: 5,
  items: { type: "string", minLength: 1, maxLength: 70 },
} as const;

const scoresSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(SCORE_KEYS.map((key) => [key, { type: "integer", minimum: 0, maximum: 100 }])),
  required: SCORE_KEYS,
} as const;

const ideaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["연구형", "프로젝트형", "서비스형"] },
    title: shortString,
    subtitle: { type: "string", minLength: 1, maxLength: 150 },
    problem: { type: "string", minLength: 1, maxLength: 220 },
    question: { type: "string", minLength: 1, maxLength: 220 },
    data: stringList,
    methods: stringList,
    weeks: { type: "integer", enum: [2, 4, 6, 8] },
    scores: scoresSchema,
  },
  required: ["type", "title", "subtitle", "problem", "question", "data", "methods", "weeks", "scores"],
} as const;

const ideasSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ideas: { type: "array", minItems: 3, maxItems: 3, items: ideaSchema },
  },
  required: ["ideas"],
} as const;

const journeySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dna: {
      type: "object",
      additionalProperties: false,
      properties: {
        axes: { type: "array", minItems: 3, maxItems: 3, items: shortString },
        summary: { type: "string", minLength: 1, maxLength: 240 },
        strengths: { type: "array", minItems: 3, maxItems: 4, items: shortString },
        preparation: { type: "array", minItems: 3, maxItems: 4, items: shortString },
        radar: { type: "array", minItems: 6, maxItems: 6, items: { type: "integer", minimum: 0, maximum: 100 } },
        radarLabels: { type: "array", minItems: 6, maxItems: 6, items: shortString },
      },
      required: ["axes", "summary", "strengths", "preparation", "radar", "radarLabels"],
    },
    trends: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: shortString,
          summary: { type: "string", minLength: 1, maxLength: 180 },
          data: stringList,
          methods: stringList,
          fitReason: { type: "string", minLength: 1, maxLength: 200 },
          connection: { type: "string", enum: ["높음", "보통"] },
        },
        required: ["title", "summary", "data", "methods", "fitReason", "connection"],
      },
    },
    ideas: { type: "array", minItems: 3, maxItems: 3, items: ideaSchema },
  },
  required: ["dna", "trends", "ideas"],
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new AiServiceError("invalid_output", `Invalid ${field}`, 502);
  return value.trim();
}

function readStringArray(value: unknown, field: string, expected?: number): string[] {
  if (!Array.isArray(value) || (expected && value.length !== expected)) {
    throw new AiServiceError("invalid_output", `Invalid ${field}`, 502);
  }
  return value.map((item, index) => readString(item, `${field}.${index}`));
}

function clampScore(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new AiServiceError("invalid_output", `Invalid ${field}`, 502);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeProfile(profile: StudentProfile): StudentProfile {
  const trim = (value: string, max = 160) => String(value ?? "").trim().slice(0, max);
  const list = (value: string[], maxItems: number) => (Array.isArray(value) ? value : []).slice(0, maxItems).map((item) => trim(item, 50)).filter(Boolean);
  return {
    name: trim(profile.name, 40),
    school: trim(profile.school, 80),
    major: trim(profile.major, 80),
    minor: trim(profile.minor, 80),
    grade: trim(profile.grade, 30),
    interests: list(profile.interests, 5),
    careers: list(profile.careers, 2),
    skills: list(profile.skills, 8),
    experience: trim(profile.experience, 500),
    noExperience: Boolean(profile.noExperience),
    availableWeeks: [2, 4, 8].includes(profile.availableWeeks) ? profile.availableWeeks : 4,
    outputGoal: trim(profile.outputGoal, 100),
    difficulty: ["starter", "project", "advanced", "research"].includes(profile.difficulty) ? profile.difficulty : "project",
  };
}

function normalizeIdea(value: unknown, prefix: string): Idea {
  if (!isRecord(value)) throw new AiServiceError("invalid_output", "Invalid idea", 502);
  const rawScores = value.scores;
  if (!isRecord(rawScores)) throw new AiServiceError("invalid_output", "Invalid idea scores", 502);
  const type = readString(value.type, "idea.type");
  if (!["연구형", "프로젝트형", "서비스형"].includes(type)) throw new AiServiceError("invalid_output", "Invalid idea type", 502);
  const weeks = Number(value.weeks);
  if (![2, 4, 6, 8].includes(weeks)) throw new AiServiceError("invalid_output", "Invalid idea weeks", 502);
  const scores = Object.fromEntries(SCORE_KEYS.map((key) => [key, clampScore(rawScores[key], `scores.${key}`)])) as Record<ComparisonCriterion, number>;
  return {
    id: `${prefix}-${randomUUID()}`,
    type: type as Idea["type"],
    title: readString(value.title, "idea.title"),
    subtitle: readString(value.subtitle, "idea.subtitle"),
    problem: readString(value.problem, "idea.problem"),
    question: readString(value.question, "idea.question"),
    data: readStringArray(value.data, "idea.data"),
    methods: readStringArray(value.methods, "idea.methods"),
    weeks,
    scores,
  };
}

function normalizeDna(value: unknown): AiDnaResult {
  if (!isRecord(value)) throw new AiServiceError("invalid_output", "Invalid DNA", 502);
  if (!Array.isArray(value.radar)) throw new AiServiceError("invalid_output", "Invalid radar", 502);
  return {
    axes: readStringArray(value.axes, "dna.axes", 3),
    summary: readString(value.summary, "dna.summary"),
    strengths: readStringArray(value.strengths, "dna.strengths"),
    preparation: readStringArray(value.preparation, "dna.preparation"),
    radar: value.radar.map((score, index) => clampScore(score, `dna.radar.${index}`)),
    radarLabels: readStringArray(value.radarLabels, "dna.radarLabels", 6),
  };
}

function normalizeTrend(value: unknown): Trend {
  if (!isRecord(value)) throw new AiServiceError("invalid_output", "Invalid trend", 502);
  const connection = readString(value.connection, "trend.connection");
  if (!["높음", "보통"].includes(connection)) throw new AiServiceError("invalid_output", "Invalid connection", 502);
  return {
    id: `ai-trend-${randomUUID()}`,
    title: readString(value.title, "trend.title"),
    summary: readString(value.summary, "trend.summary"),
    data: readStringArray(value.data, "trend.data"),
    methods: readStringArray(value.methods, "trend.methods"),
    fitReason: readString(value.fitReason, "trend.fitReason"),
    sourceCount: 0,
    verifiedAt: "AI 생성",
    connection: connection as Trend["connection"],
  };
}

function extractOutputText(response: OpenAiResponse): string {
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" && typeof content.text === "string")
    ?.text ?? "";
}

async function requestStructured<T>(name: string, schema: JsonRecord, prompt: string): Promise<{ data: T; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AiServiceError("missing_key", "AI 연결 설정이 필요합니다.", 503);

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
        input: prompt,
        reasoning: { effort: "minimal" },
        text: { format: { type: "json_schema", name, strict: true, schema }, verbosity: "low" },
        max_output_tokens: 5000,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AiServiceError("timeout", "AI 응답 시간이 길어지고 있습니다.", 504);
    }
    throw new AiServiceError("upstream", "AI 서비스에 연결하지 못했습니다.", 502);
  }

  if (!response.ok) {
    if (response.status === 429) throw new AiServiceError("rate_limited", "요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
    throw new AiServiceError("upstream", "AI 분석을 완료하지 못했습니다.", response.status === 401 ? 503 : 502);
  }

  const payload = await response.json() as OpenAiResponse;
  const outputText = extractOutputText(payload);
  if (!outputText) throw new AiServiceError("invalid_output", "AI 결과를 읽지 못했습니다.", 502);
  try {
    return { data: JSON.parse(outputText) as T, model: payload.model || DEFAULT_MODEL };
  } catch {
    throw new AiServiceError("invalid_output", "AI 결과 형식이 올바르지 않습니다.", 502);
  }
}

function profilePrompt(profile: StudentProfile, goal: string | null): string {
  return JSON.stringify({ goal, profile: normalizeProfile(profile) });
}

export async function generateJourney(request: AiJourneyRequest): Promise<AiJourneyResult> {
  const prompt = `당신은 대학생의 전공 탐색을 돕는 한국어 연구·프로젝트 기획자입니다.\n입력 프로필을 근거로 전공 DNA, 탐색 방향 5개, 실행 가능한 아이디어 3개를 만드세요.\n모든 문장은 자연스럽고 구체적인 한국어로 작성하세요. 입력에 없는 경력이나 사실을 지어내지 마세요.\n탐색 방향은 최신 동향이나 검증된 출처라고 주장하지 말고, 학생에게 적합한 연구 방향으로 제안하세요.\n아이디어 3개는 서로 겹치지 않게 연구형·프로젝트형·서비스형을 각각 하나씩 포함하세요.\n기간은 학생의 availableWeeks를 우선 따르고, 데이터와 방법은 학생 수준에서 실제 확보·실행 가능해야 합니다.\n레이더 축은 서로 다른 역량 6개이며 점수는 입력 근거에 맞게 보수적으로 매기세요.\n입력:\n${profilePrompt(request.profile, request.goal)}`;
  const { data, model } = await requestStructured<JsonRecord>("major_evolution_journey", journeySchema as unknown as JsonRecord, prompt);
  if (!isRecord(data) || !Array.isArray(data.trends) || data.trends.length !== 5 || !Array.isArray(data.ideas) || data.ideas.length !== 3) {
    throw new AiServiceError("invalid_output", "AI 결과 구성이 올바르지 않습니다.", 502);
  }
  return {
    dna: normalizeDna(data.dna),
    trends: data.trends.map(normalizeTrend),
    ideas: data.ideas.map((idea) => normalizeIdea(idea, "ai-idea")),
    generatedAt: new Date().toISOString(),
    model,
  };
}

export async function generateIdeas(request: AiIdeasRequest): Promise<{ ideas: Idea[]; generatedAt: string; model: string }> {
  const safeTrend = {
    title: String(request.selectedTrend?.title ?? "").slice(0, 90),
    summary: String(request.selectedTrend?.summary ?? "").slice(0, 180),
    data: (request.selectedTrend?.data ?? []).slice(0, 5),
    methods: (request.selectedTrend?.methods ?? []).slice(0, 5),
  };
  const previousTitles = (request.previousIdeaTitles ?? []).slice(0, 8).map((title) => String(title).slice(0, 90));
  const prompt = `당신은 대학생의 전공 기반 프로젝트를 설계하는 한국어 기획자입니다.\n학생 프로필과 선택한 탐색 방향을 바탕으로 이전 제목과 겹치지 않는 새 아이디어 3개를 만드세요.\n연구형·프로젝트형·서비스형을 각각 하나씩 포함하고, 입력에 없는 사실이나 외부 검증을 주장하지 마세요.\n학생의 기간과 현재 기술로 시작할 수 있도록 데이터 범위와 방법을 구체적으로 제한하세요.\n입력:\n${JSON.stringify({ ...JSON.parse(profilePrompt(request.profile, request.goal)), selectedTrend: safeTrend, previousIdeaTitles: previousTitles })}`;
  const { data, model } = await requestStructured<JsonRecord>("major_evolution_ideas", ideasSchema as unknown as JsonRecord, prompt);
  if (!isRecord(data) || !Array.isArray(data.ideas) || data.ideas.length !== 3) {
    throw new AiServiceError("invalid_output", "AI 아이디어 구성이 올바르지 않습니다.", 502);
  }
  return {
    ideas: data.ideas.map((idea) => normalizeIdea(idea, "ai-idea")),
    generatedAt: new Date().toISOString(),
    model,
  };
}
