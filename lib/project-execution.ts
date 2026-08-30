export const PROJECT_EXECUTION_MATERIALS = [
  {
    id: "project-brief",
    label: "프로젝트 한 장 요약",
    description: "문제·대상·방법·범위를 한눈에 볼 수 있게 정리해요.",
  },
  {
    id: "evidence",
    label: "선택 근거와 참고 자료",
    description: "후보 비교에서 확인한 근거와 출처를 준비해요.",
  },
  {
    id: "sample-data",
    label: "샘플 데이터 또는 예시 3개",
    description: "교수님이 방법의 현실성을 빠르게 판단할 수 있게 해요.",
  },
  {
    id: "decision-log",
    label: "결정이 필요한 쟁점",
    description: "혼자 정하기 어려운 선택지를 짧게 적어 가요.",
  },
] as const;

export type ProjectExecutionMaterialId = (typeof PROJECT_EXECUTION_MATERIALS)[number]["id"];

export type ProjectExecutionDraft = {
  topicId: string;
  professorId: string;
  meetingGoal: string;
  executionPlan: string;
  questions: [string, string, string];
  materials: Record<ProjectExecutionMaterialId, boolean>;
  reflection: string;
  updatedAt: string;
};

export type ProjectExecutionSaveState = {
  status: "idle" | "saved" | "error";
  error: string | null;
};

type ProjectExecutionStorage = {
  setItem(key: string, value: string): void;
};

type DraftSeed = {
  topicId: string;
  professorId: string;
  topicTitle: string;
  topicQuestion: string;
  methodDetail: string;
};

export function projectExecutionStorageKey(topicId: string, professorId: string): string {
  return `project-execution:${topicId}:${professorId}`;
}

export function persistProjectExecutionDraft(
  storage: ProjectExecutionStorage,
  storageKey: string,
  draft: ProjectExecutionDraft,
): ProjectExecutionSaveState {
  try {
    storage.setItem(storageKey, JSON.stringify(draft));
    return { status: "saved", error: null };
  } catch {
    return {
      status: "error",
      error: "이 브라우저에 저장하지 못했어요. 입력 내용은 현재 화면에만 남아 있어요.",
    };
  }
}

export function createProjectExecutionDraft({
  topicId,
  professorId,
  topicTitle,
  topicQuestion,
  methodDetail,
}: DraftSeed): ProjectExecutionDraft {
  return {
    topicId,
    professorId,
    meetingGoal: "",
    executionPlan: "",
    questions: [
      `‘${topicTitle}’에서 가장 먼저 좁혀야 할 연구 범위는 무엇인가요?`,
      `현재 생각한 ‘${methodDetail}’ 방법으로 질문을 검증할 수 있을까요?`,
      `‘${topicQuestion}’이라는 질문을 실행할 때 놓치기 쉬운 위험이나 기준은 무엇인가요?`,
    ],
    materials: {
      "project-brief": false,
      evidence: false,
      "sample-data": false,
      "decision-log": false,
    },
    reflection: "",
    updatedAt: new Date(0).toISOString(),
  };
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 2000) : fallback;
}

export function normalizeProjectExecutionDraft(
  value: unknown,
  fallback: ProjectExecutionDraft,
): ProjectExecutionDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : fallback.questions;
  const rawMaterials = raw.materials && typeof raw.materials === "object" && !Array.isArray(raw.materials)
    ? raw.materials as Record<string, unknown>
    : {};

  return {
    ...fallback,
    meetingGoal: text(raw.meetingGoal),
    executionPlan: text(raw.executionPlan),
    questions: [0, 1, 2].map((index) => text(rawQuestions[index], fallback.questions[index])) as [string, string, string],
    materials: {
      "project-brief": rawMaterials["project-brief"] === true,
      evidence: rawMaterials.evidence === true,
      "sample-data": rawMaterials["sample-data"] === true,
      "decision-log": rawMaterials["decision-log"] === true,
    },
    reflection: text(raw.reflection),
    updatedAt: text(raw.updatedAt, fallback.updatedAt),
  };
}

export function getProjectExecutionProgress(draft: ProjectExecutionDraft) {
  const steps = {
    brief: Boolean(draft.topicId && draft.professorId),
    advisory: Boolean(draft.meetingGoal.trim() && draft.questions.every((question) => question.trim())),
    evidence: Object.values(draft.materials).filter(Boolean).length >= 2,
    reflection: Boolean(draft.reflection.trim()),
  };
  const completed = Object.values(steps).filter(Boolean).length;
  const total = Object.keys(steps).length;
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    steps,
  };
}

export function getProjectExecutionCurrentStep(steps: {
  brief: boolean;
  advisory: boolean;
  evidence: boolean;
  reflection: boolean;
}): number | null {
  const current = [steps.brief, steps.advisory, steps.evidence, steps.reflection]
    .findIndex((done) => !done);
  return current === -1 ? null : current;
}
