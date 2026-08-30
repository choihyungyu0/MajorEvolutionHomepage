export type ProjectDesignHomeStage = "conditions" | "co-design" | "candidates" | "selected" | "execution";

export function projectDesignHomeAction({
  hasDraft,
  hasCompleteSetup,
  hasResult,
  hasSelectedTopic,
  hasProjectProfessor,
}: {
  hasDraft: boolean;
  hasCompleteSetup: boolean;
  hasResult: boolean;
  hasSelectedTopic: boolean;
  hasProjectProfessor: boolean;
}): { label: string; href: string; stage: ProjectDesignHomeStage } {
  if (hasSelectedTopic && hasProjectProfessor) {
    return { label: "프로젝트 실행 이어가기", href: "/project-execution", stage: "execution" };
  }
  if (hasSelectedTopic) {
    return { label: "선택한 프로젝트 근거 보기", href: "/result/compare", stage: "selected" };
  }
  if (hasResult) {
    return { label: "프로젝트 후보 이어보기", href: "/result", stage: "candidates" };
  }
  if (hasCompleteSetup) {
    return { label: "AI 공동설계 시작하기", href: "/co-design", stage: "co-design" };
  }
  if (hasDraft) {
    return { label: "이어서 설계하기", href: "/research/tutorial", stage: "conditions" };
  }
  return { label: "프로젝트 설계 시작하기", href: "/research/tutorial", stage: "conditions" };
}

export function projectDesignHomeProgress({
  hasCompleteSetup,
  hasCoDesignAnswers,
  hasResult,
  hasSelectedTopic,
}: {
  hasCompleteSetup: boolean;
  hasCoDesignAnswers: boolean;
  hasResult: boolean;
  hasSelectedTopic: boolean;
}) {
  const steps = {
    conditions: hasCompleteSetup,
    coDesign: hasCoDesignAnswers,
    candidates: hasResult,
    selected: hasSelectedTopic,
  };
  const completed = Object.values(steps).filter(Boolean).length;
  const total = Object.keys(steps).length;
  return { completed, total, percent: Math.round((completed / total) * 100), steps };
}
