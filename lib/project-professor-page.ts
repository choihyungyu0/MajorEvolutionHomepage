import type { ProfessorMatch, ProfessorMatchRole } from "@/lib/professor-domain";

export type ProjectProfessorStepState = "pending" | "current" | "complete" | "error";

export type ProjectProfessorPagePresentationState =
  | "missing-result"
  | "missing-selection"
  | "loading"
  | "error"
  | "idle"
  | "success";

export const PROJECT_PROFESSOR_ROLE_META = {
  TOPIC: {
    label: "연구주제 멘토",
    focus: "연구질문과 범위",
    consultation: "연구질문에서 먼저 좁혀야 할 범위와 꼭 확인할 배경은 무엇인지 자문해 보세요.",
  },
  METHOD: {
    label: "연구방법 멘토",
    focus: "데이터와 분석 방법",
    consultation: "현재 구할 수 있는 데이터와 방법으로 질문을 검증할 수 있는지 자문해 보세요.",
  },
  CONTEXT: {
    label: "응용·확장 멘토",
    focus: "현장 적용과 전공 확장",
    consultation: "프로젝트를 어떤 분야와 연결하면 의미 있는 결과로 확장할 수 있는지 자문해 보세요.",
  },
} as const satisfies Record<ProfessorMatchRole, {
  label: string;
  focus: string;
  consultation: string;
}>;

const ROLE_ORDER: ProfessorMatchRole[] = ["TOPIC", "METHOD", "CONTEXT"];

export function buildProjectProfessorRoleSlots(matches: ProfessorMatch[]) {
  return ROLE_ORDER.map((role) => ({
    role,
    ...PROJECT_PROFESSOR_ROLE_META[role],
    match: matches.find((match) => match.role === role) ?? null,
  }));
}

export function projectProfessorNextAction(selectedProfessorId: string | null) {
  if (!selectedProfessorId) {
    return {
      label: "면담할 교수님을 선택해 주세요",
      href: null,
      disabled: true,
    } as const;
  }
  return {
    label: "선택한 교수님과 프로젝트 시작하기",
    href: "/project-execution",
    disabled: false,
  } as const;
}

export function projectProfessorPagePresentation({
  hasResult,
  hasSelectedTopic,
  matchStatus,
  hasMatches,
}: {
  hasResult: boolean;
  hasSelectedTopic: boolean;
  matchStatus: "idle" | "loading" | "success" | "error";
  hasMatches: boolean;
}): {
  state: ProjectProfessorPagePresentationState;
  eyebrow: string;
  title: string;
  description: string;
  steps: [ProjectProfessorStepState, ProjectProfessorStepState, ProjectProfessorStepState];
} {
  if (!hasResult) {
    return {
      state: "missing-result",
      eyebrow: "프로젝트 실행 · 준비 전",
      title: "프로젝트를 먼저 설계해 볼까요?",
      description: "프로젝트의 문제·방법·범위를 정한 뒤 자문 교수를 연결할 수 있어요.",
      steps: ["pending", "pending", "pending"],
    };
  }
  if (!hasSelectedTopic) {
    return {
      state: "missing-selection",
      eyebrow: "프로젝트 실행 · 1단계",
      title: "프로젝트 후보를 먼저 선택해 주세요",
      description: "후보를 고르고 상세 근거를 확인하면 프로젝트에 필요한 자문 역할을 연결해요.",
      steps: ["current", "pending", "pending"],
    };
  }
  if (matchStatus === "loading") {
    return {
      state: "loading",
      eyebrow: "프로젝트 실행 · 3단계",
      title: "프로젝트에 맞는 자문 교수를 찾고 있어요",
      description: "연구주제·방법·응용 확장 역할을 나눠 공식 근거 후보를 확인하고 있습니다.",
      steps: ["complete", "complete", "current"],
    };
  }
  if (matchStatus === "error") {
    return {
      state: "error",
      eyebrow: "프로젝트 실행 · 3단계",
      title: "교수 추천을 완료하지 못했어요",
      description: "선택한 프로젝트는 그대로 두고 상세 근거 화면에서 교수 연결을 다시 시도할 수 있어요.",
      steps: ["complete", "complete", "error"],
    };
  }
  if (matchStatus === "idle") {
    return {
      state: "idle",
      eyebrow: "프로젝트 실행 · 2단계",
      title: "선택한 프로젝트의 상세 근거를 확인해 주세요",
      description: "데이터·방법·범위의 근거를 확인한 뒤 프로젝트에 필요한 자문 역할을 연결할 수 있어요.",
      steps: ["complete", "current", "pending"],
    };
  }
  if (matchStatus === "success" && hasMatches) {
    return {
      state: "success",
      eyebrow: "프로젝트 실행 · 3단계",
      title: "이 프로젝트에 맞는 자문 교수를 연결했어요",
      description: "선택한 프로젝트를 발전시키는 데 필요한 연구주제·방법·응용 확장 역할을 공식 근거로 나눠 확인합니다.",
      steps: ["complete", "complete", "current"],
    };
  }
  return {
    state: "idle",
    eyebrow: "프로젝트 실행 · 3단계",
    title: "교수 추천 결과를 다시 확인해 주세요",
    description: "선택한 프로젝트는 그대로 두고 상세 근거 화면에서 교수 연결을 다시 시작할 수 있어요.",
    steps: ["complete", "complete", "current"],
  };
}

export function projectEntryRecoveryAction({
  hasCandidateResult,
  hasSelectedTopic,
}: {
  hasCandidateResult: boolean;
  hasSelectedTopic: boolean;
}) {
  if (!hasCandidateResult) {
    return {
      state: "missing-result",
      href: "/research",
      label: "프로젝트 설계 시작하기",
    } as const;
  }
  if (!hasSelectedTopic) {
    return {
      state: "missing-selection",
      href: "/result",
      label: "프로젝트 후보 선택하기",
    } as const;
  }
  return null;
}

export function projectProfessorSelectionButton(selected: boolean) {
  return selected
    ? { label: "선택한 교수님", disabled: true } as const
    : { label: "이 교수님 선택", disabled: false } as const;
}
