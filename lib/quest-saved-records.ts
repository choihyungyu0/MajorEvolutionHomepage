import type {
  ProfessorKnockKitDraft,
  ProfessorMentorLoopEntry,
} from "@/lib/professor-domain";
import type { SavedQuestCard } from "@/store/quest-store";

export type ProfessorConnectionSavedPhase = "before" | "during" | "after";

export type ProfessorConnectionSavedRecord = {
  id: string;
  phase: ProfessorConnectionSavedPhase;
  kind: "quest-card" | "email-draft" | "mentor-entry";
  label: string;
  title: string;
  body: string;
  detail: string | null;
  href: string;
  professorId: string;
  topicId: string;
  updatedAt: string;
};

export type ProfessorConnectionSavedSection = {
  id: ProfessorConnectionSavedPhase;
  label: string;
  description: string;
  records: ProfessorConnectionSavedRecord[];
};

type QuestCardRecord = Pick<
  SavedQuestCard,
  "id" | "tool" | "title" | "body" | "professorId" | "topicId" | "updatedAt"
>;

type KnockKitRecord = Pick<
  ProfessorKnockKitDraft,
  "topicId" | "professorId" | "introduction" | "questions" | "agenda" | "emailDraft" | "updatedAt"
>;

type MentorRecord = Pick<
  ProfessorMentorLoopEntry,
  "topicId" | "professorId" | "meetingDate" | "feedbackSummary" | "commitment" | "updatedAt"
>;

const PHASE_COPY: Array<Omit<ProfessorConnectionSavedSection, "records">> = [
  {
    id: "before",
    label: "만나기 전",
    description: "논문 요약, 첫 질문과 교수님께 보낼 연락 문장을 모았어요.",
  },
  {
    id: "during",
    label: "대화 중",
    description: "대화가 잠시 멈췄을 때 확인할 질문을 모았어요.",
  },
  {
    id: "after",
    label: "만난 후",
    description: "교수님 피드백과 다음 행동, 후속 기록을 모았어요.",
  },
];

const TOOL_META = {
  "paper-bite": { phase: "before", label: "논문 한입", href: "/paper/reader?mode=bite&source=favorites" },
  "first-line": { phase: "before", label: "첫마디 랜덤박스", href: "/quest/first-line" },
  "silence-rescue": { phase: "during", label: "침묵 구조대", href: "/quest/silence-rescue" },
  "email-guard": { phase: "before", label: "메일 흑역사 방지기", href: "/quest/email-guard" },
  "next-seed": { phase: "after", label: "다음 만남 씨앗", href: "/mentor-loop" },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isQuestCardRecord(value: unknown): value is QuestCardRecord {
  if (!isRecord(value) || !isString(value.tool) || !(value.tool in TOOL_META)) return false;
  return isString(value.id)
    && isString(value.title)
    && isString(value.body)
    && isString(value.professorId)
    && isString(value.topicId)
    && isString(value.updatedAt);
}

function isKnockKitRecord(value: unknown): value is KnockKitRecord {
  if (!isRecord(value) || !Array.isArray(value.questions)) return false;
  return isString(value.topicId)
    && isString(value.professorId)
    && isString(value.introduction)
    && value.questions.every(isString)
    && isString(value.agenda)
    && isString(value.emailDraft)
    && isString(value.updatedAt);
}

function isMentorRecord(value: unknown): value is MentorRecord {
  if (!isRecord(value)) return false;
  return isString(value.topicId)
    && isString(value.professorId)
    && isString(value.meetingDate)
    && isString(value.feedbackSummary)
    && isString(value.commitment)
    && isString(value.updatedAt);
}

function recordKeyPrefix(topicId: string, professorId: string): string | null {
  if (!topicId || !professorId) return null;
  return `${topicId}:${professorId}`;
}

function matchesEmailRecordKey(key: string, draft: KnockKitRecord): boolean {
  const prefix = recordKeyPrefix(draft.topicId, draft.professorId);
  return Boolean(prefix && (key === prefix || key.startsWith(`${prefix}:email:`)));
}

function matchesMentorRecordKey(key: string, entry: MentorRecord): boolean {
  const prefix = recordKeyPrefix(entry.topicId, entry.professorId);
  return Boolean(prefix && key === prefix);
}

/** 프로젝트 실행의 자문 교수 기록과 학생 고민 기반 교수 연결 기록을 분리합니다. */
export function isProfessorConnectionTopicId(topicId: string | null | undefined): topicId is string {
  return Boolean(
    topicId
    && (
      topicId.startsWith("discovery:")
      || topicId.startsWith("context:")
      || topicId.startsWith("paper:")
    ),
  );
}

function latestFirst(
  left: ProfessorConnectionSavedRecord,
  right: ProfessorConnectionSavedRecord,
): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

export function buildProfessorConnectionSavedSections(input: {
  cards: QuestCardRecord[];
  emailDrafts: Record<string, KnockKitRecord>;
  mentorEntries: Record<string, MentorRecord>;
}): ProfessorConnectionSavedSection[] {
  const records: ProfessorConnectionSavedRecord[] = [];
  const cardValues: unknown[] = Array.isArray(input.cards) ? input.cards : [];
  const emailValues: Array<[string, unknown]> = isRecord(input.emailDrafts)
    ? Object.entries(input.emailDrafts)
    : [];
  const mentorValues: Array<[string, unknown]> = isRecord(input.mentorEntries)
    ? Object.entries(input.mentorEntries)
    : [];

  for (const card of cardValues) {
    if (!isQuestCardRecord(card)) continue;
    if (!card.professorId || !isProfessorConnectionTopicId(card.topicId)) continue;
    const meta = TOOL_META[card.tool];
    records.push({
      id: `card:${card.id}`,
      phase: meta.phase,
      kind: "quest-card",
      label: meta.label,
      title: card.title,
      body: card.body,
      detail: null,
      href: meta.href,
      professorId: card.professorId,
      topicId: card.topicId,
      updatedAt: card.updatedAt,
    });
  }

  for (const [key, draft] of emailValues) {
    if (!isKnockKitRecord(draft)) continue;
    if (!matchesEmailRecordKey(key, draft)) continue;
    if (!isProfessorConnectionTopicId(draft.topicId)) continue;
    records.push({
      id: `email:${key}`,
      phase: "before",
      kind: "email-draft",
      label: "연락 메일 초안",
      title: draft.agenda || "교수님께 드릴 메일",
      body: draft.emailDraft || draft.introduction,
      detail: draft.questions.filter(Boolean).slice(0, 3).join(" · ") || null,
      href: "/quest/email-guard",
      professorId: draft.professorId,
      topicId: draft.topicId,
      updatedAt: draft.updatedAt,
    });
  }

  for (const [key, entry] of mentorValues) {
    if (!isMentorRecord(entry)) continue;
    if (!matchesMentorRecordKey(key, entry)) continue;
    if (!isProfessorConnectionTopicId(entry.topicId)) continue;
    records.push({
      id: `mentor:${key}`,
      phase: "after",
      kind: "mentor-entry",
      label: "다음 만남 씨앗",
      title: entry.meetingDate ? `${entry.meetingDate} 면담 기록` : "교수님 면담 기록",
      body: entry.feedbackSummary || entry.commitment || "저장한 면담 후 기록",
      detail: entry.commitment || null,
      href: "/mentor-loop",
      professorId: entry.professorId,
      topicId: entry.topicId,
      updatedAt: entry.updatedAt,
    });
  }

  return PHASE_COPY.map((phase) => ({
    ...phase,
    records: records.filter((record) => record.phase === phase.id).sort(latestFirst),
  }));
}
