import type {
  ProfessorMatch,
  ProfessorMatchResponse,
  ProfessorMatchRole,
  ProfessorPaperSelection,
} from "@/lib/professor-domain";
import type { RecommendResult } from "@/lib/recommend";

export type GrowthDirectionSnapshot = {
  major: string;
  interests: string[];
  careerConcerns: string[];
  capturedAt: string;
};

export type GrowthProjectRecord = {
  topicId: string;
  title: string;
  question: string;
  selectedAt: string;
};

export type GrowthProfessorConnectionSource = "student" | "project" | "paper";

export type GrowthProfessorRecord = {
  professorId: string;
  name: string;
  title: string;
  college: string;
  department: string;
  role: ProfessorMatchRole;
  reason: string;
  source: GrowthProfessorConnectionSource;
  connectedAt: string;
  selectedAt: string | null;
};

const MAX_PROJECT_HISTORY = 8;
const MAX_PROFESSOR_HISTORY = 18;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTextList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item, maxLength)).filter(Boolean))).slice(0, maxItems);
}

export function createGrowthDirectionSnapshot(input: {
  major?: string | null;
  interests?: string[];
  careerConcerns?: string[];
  capturedAt?: string;
}): GrowthDirectionSnapshot | null {
  const major = cleanText(input.major, 80);
  const interests = cleanTextList(input.interests, 6, 60);
  const careerConcerns = cleanTextList(input.careerConcerns, 6, 80);
  if (!major && interests.length === 0 && careerConcerns.length === 0) return null;
  return {
    major,
    interests,
    careerConcerns,
    capturedAt: cleanText(input.capturedAt, 40) || new Date().toISOString(),
  };
}

export function normalizeGrowthDirectionSnapshot(value: unknown): GrowthDirectionSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return createGrowthDirectionSnapshot({
    major: cleanText(raw.major, 80),
    interests: cleanTextList(raw.interests, 6, 60),
    careerConcerns: cleanTextList(raw.careerConcerns, 6, 80),
    capturedAt: cleanText(raw.capturedAt, 40),
  });
}

function selectedTopic(result: RecommendResult | null, topicId: string | null) {
  if (!result || !topicId || result.kind === "empty") return null;
  if (result.kind === "insufficient") {
    return result.candidate.topic.id === topicId ? result.candidate.topic : null;
  }
  return result.candidates.find((candidate) => candidate.topic.id === topicId)?.topic ?? null;
}

export function appendGrowthProjectRecord(
  history: GrowthProjectRecord[],
  result: RecommendResult | null,
  topicId: string,
  selectedAt = new Date().toISOString(),
): GrowthProjectRecord[] {
  const topic = selectedTopic(result, topicId);
  if (!topic) return history;
  const record: GrowthProjectRecord = {
    topicId: topic.id,
    title: topic.title.slice(0, 240),
    question: topic.question.slice(0, 360),
    selectedAt,
  };
  return [...history.filter((item) => item.topicId !== record.topicId), record].slice(-MAX_PROJECT_HISTORY);
}

export function normalizeGrowthProjectHistory(value: unknown): GrowthProjectRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const topicId = cleanText(raw.topicId, 120);
    const title = cleanText(raw.title, 240);
    const question = cleanText(raw.question, 360);
    if (!topicId || !title) return [];
    return [{
      topicId,
      title,
      question,
      selectedAt: cleanText(raw.selectedAt, 40) || new Date().toISOString(),
    }];
  }).slice(-MAX_PROJECT_HISTORY);
}

export function mergeGrowthProfessorHistory(
  history: GrowthProfessorRecord[],
  response: ProfessorMatchResponse,
): GrowthProfessorRecord[] {
  const source: GrowthProfessorConnectionSource = response.rankingSource === "ai-reranked" ? "project" : "student";
  const incoming = createGrowthProfessorRecords(response.matches, source, response.generatedAt);
  const keys = new Set(incoming.map((item) => `${item.source}:${item.professorId}`));
  const preserved = history.filter((item) => !keys.has(`${item.source}:${item.professorId}`));
  return [...preserved, ...incoming].slice(-MAX_PROFESSOR_HISTORY);
}

export function createGrowthProfessorRecords(
  matches: ProfessorMatch[],
  source: GrowthProfessorConnectionSource,
  connectedAt = new Date().toISOString(),
): GrowthProfessorRecord[] {
  return matches.map<GrowthProfessorRecord>((match) => ({
    professorId: match.professor.id,
    name: match.professor.name,
    title: match.professor.title,
    college: match.professor.college,
    department: match.professor.department,
    role: match.role,
    reason: match.mentorFitReason ?? match.reason,
    source,
    connectedAt,
    selectedAt: null,
  }));
}

export function normalizeGrowthProfessorHistory(value: unknown): GrowthProfessorRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const professorId = cleanText(raw.professorId, 64);
    const name = cleanText(raw.name, 80);
    const department = cleanText(raw.department, 120);
    const role = raw.role === "TOPIC" || raw.role === "METHOD" || raw.role === "CONTEXT"
      ? raw.role
      : "CONTEXT";
    const source = raw.source === "project" || raw.source === "paper" ? raw.source : "student";
    if (!professorId || !name) return [];
    return [{
      professorId,
      name,
      title: cleanText(raw.title, 40) || "교수",
      college: cleanText(raw.college, 120),
      department,
      role,
      reason: cleanText(raw.reason, 360),
      source,
      connectedAt: cleanText(raw.connectedAt, 40) || new Date().toISOString(),
      selectedAt: cleanText(raw.selectedAt, 40) || null,
    } satisfies GrowthProfessorRecord];
  }).slice(-MAX_PROFESSOR_HISTORY);
}

export function markGrowthProfessorSelected(
  history: GrowthProfessorRecord[],
  professorId: string,
  selectedAt = new Date().toISOString(),
): GrowthProfessorRecord[] {
  return history.map((record) => record.professorId === professorId
    ? { ...record, selectedAt }
    : record);
}

export function rememberPaperProfessor(
  history: GrowthProfessorRecord[],
  selection: ProfessorPaperSelection,
): GrowthProfessorRecord[] {
  const selected = markGrowthProfessorSelected(history, selection.professorId, selection.selectedAt);
  if (selected.some((record) => record.professorId === selection.professorId)) return selected;
  const paperRecord: GrowthProfessorRecord = {
    professorId: selection.professorId,
    name: selection.professorName,
    title: "교수",
    college: "",
    department: selection.professorDepartment,
    role: "CONTEXT",
    reason: "논문 읽기와 첫 대화 준비로 이어간 교수님이에요.",
    source: "paper",
    connectedAt: selection.selectedAt,
    selectedAt: selection.selectedAt,
  };
  return [...selected, paperRecord].slice(-MAX_PROFESSOR_HISTORY);
}
