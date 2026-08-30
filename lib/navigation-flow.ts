const BACK_LABELS: Record<string, string> = {
  "/home": "홈으로 돌아가기",
  "/quest": "교수 만남 준비로 돌아가기",
  "/professors": "교수 매칭으로 돌아가기",
  "/research": "AI 프로젝트 설계로 돌아가기",
  "/project-professors": "맞춤 교수 추천으로 돌아가기",
  "/project-execution": "프로젝트 실행 홈으로 돌아가기",
  "/project-meeting": "프로젝트 자문 준비로 돌아가기",
  "/portfolio": "나의 성장과정으로 돌아가기",
};

export const PROFESSOR_DETAIL_ORIGINS = [
  "home",
  "quest",
  "portfolio",
  "result",
  "project",
  "project-execution",
  "project-meeting",
  "pitch",
] as const;

export type ProfessorDetailOrigin = (typeof PROFESSOR_DETAIL_ORIGINS)[number];

function normalizeProfessorDetailOrigin(value?: string | null): ProfessorDetailOrigin | null {
  return PROFESSOR_DETAIL_ORIGINS.includes(value as ProfessorDetailOrigin)
    ? value as ProfessorDetailOrigin
    : null;
}

export function professorDetailNavigation(from?: string | null, journey?: string | null) {
  const origin = normalizeProfessorDetailOrigin(from);
  const projectOrigin = origin === "result"
    || origin === "project"
    || origin === "project-execution"
    || origin === "project-meeting";
  const matchBucket = journey === "project" || projectOrigin ? "project" : "student";
  const backByOrigin = {
    home: "/home",
    quest: "/quest",
    portfolio: "/portfolio",
    result: "/result/compare",
    project: "/project-professors",
    "project-execution": "/project-execution",
    "project-meeting": "/project-meeting",
    pitch: "/professors/pitch",
  } as const satisfies Record<ProfessorDetailOrigin, string>;
  const backHref = origin ? backByOrigin[origin] : "/professors";

  return {
    origin,
    backHref,
    matchBucket,
    nextHref: matchBucket === "project" ? "/project-execution" : "/quest",
  } as const;
}

export function professorDetailQuery(from?: string | null, journey?: string | null): string {
  const origin = normalizeProfessorDetailOrigin(from);
  if (!origin) return "";
  const query = new URLSearchParams({ from: origin });
  if (journey === "project") query.set("journey", "project");
  return `?${query.toString()}`;
}

export function growthProjectRecordHref({
  recordTopicId,
  selectedTopicId,
  currentResultTopicIds,
}: {
  recordTopicId: string;
  selectedTopicId: string | null;
  currentResultTopicIds: readonly string[];
}): string {
  return recordTopicId === selectedTopicId && currentResultTopicIds.includes(recordTopicId)
    ? "/result"
    : `/portfolio/builder?topic=${encodeURIComponent(recordTopicId)}`;
}

export function pdfReaderBackHref(from?: string): string {
  return from === "card"
    ? "/paper/reader?mode=bite&source=favorites&step=card"
    : "/quest";
}

export function portfolioManageReturnHref(from?: string): string {
  return from === "professors" ? "/professors" : "/profile";
}

export type BackNavigation =
  | { mode: "back" }
  | { mode: "replace"; href: string };

export function resolveBackNavigation(backHref?: string): BackNavigation | null {
  if (!backHref) return null;
  return backHref === "back"
    ? { mode: "back" }
    : { mode: "replace", href: backHref };
}

export function backLabelForDestination(destination?: string): string {
  if (!destination || destination === "back") return "이전 화면으로 돌아가기";
  if (destination.startsWith("/paper/reader") && destination.includes("step=card")) {
    return "3분 카드로 돌아가기";
  }
  if (destination.startsWith("/paper/reader") && destination.includes("mode=pdf")) {
    return "PDF 해설로 돌아가기";
  }
  if (destination.startsWith("/quest/first-line")) return "첫 질문으로 돌아가기";
  const cleanPath = destination.split(/[?#]/, 1)[0];
  return BACK_LABELS[cleanPath] ?? "이전 화면으로 돌아가기";
}
