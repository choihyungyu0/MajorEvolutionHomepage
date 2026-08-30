export type ResultPageView = "summary" | "compare";

export const RESULT_PAGE_STEPS = [
  { id: "summary", label: "후보 선택", href: "/result" },
  { id: "compare", label: "근거 더보기", href: "/result/compare" },
  { id: "professors", label: "교수 연결", href: "/project-professors" },
] as const;

export function resultPagePrimaryAction(
  view: ResultPageView,
  hasSelection: boolean,
  professorScopeReady = true,
) {
  if (!hasSelection) {
    return { label: "연결할 후보를 먼저 선택해 주세요", href: null, disabled: true } as const;
  }
  if (view === "summary") {
    return {
      label: "선택한 후보 자세히 보기",
      href: "/result/compare",
      disabled: false,
    } as const;
  }
  if (!professorScopeReady) {
    return {
      label: "학교 확인하고 교수 찾기",
      href: "/research/conditions?view=review",
      disabled: false,
    } as const;
  }
  return {
    label: "선택한 주제로 교수 찾기",
    href: "/project-professors",
    disabled: false,
  } as const;
}

export function projectProfessorRequestCompleted({
  requestedTopicId,
  selectedTopicId,
  matchTopicId,
  status,
}: {
  requestedTopicId: string;
  selectedTopicId: string | null;
  matchTopicId: string | null;
  status: "idle" | "loading" | "success" | "error";
}): boolean {
  return selectedTopicId === requestedTopicId
    && matchTopicId === requestedTopicId
    && status === "success";
}
