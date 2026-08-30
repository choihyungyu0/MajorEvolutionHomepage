import type { ProfessorMatch, ProfessorPaperSelection } from "@/lib/professor-domain";

/** 학생 탐색과 프로젝트 자문 추천을 같은 배열에 섞지 않기 위한 순수 상태 계약입니다. */
export type ProfessorMatchStatus = "idle" | "loading" | "success" | "error";

export type ProfessorMatchBucket<TMatch = unknown, TCoverage = unknown> = {
  matches: TMatch[];
  coverage: TCoverage | null;
  status: ProfessorMatchStatus;
  error: string | null;
  topicId: string | null;
  rejectedIds: string[];
  selectedProfessorId: string | null;
};

export function emptyProfessorMatchBucket<TMatch = unknown, TCoverage = unknown>(): ProfessorMatchBucket<TMatch, TCoverage> {
  return { matches: [], coverage: null, status: "idle", error: null, topicId: null, rejectedIds: [], selectedProfessorId: null };
}

export function isProjectProfessorMatchTopic(topicId: string | null | undefined, selectedTopicId: string | null | undefined): boolean {
  return Boolean(topicId && selectedTopicId && topicId === selectedTopicId && !topicId.startsWith("discovery:") && !topicId.startsWith("context:"));
}

export function clearStudentProfessorMatchBucket<TMatch, TCoverage>({
  projectBucket,
}: {
  studentBucket: ProfessorMatchBucket<TMatch, TCoverage>;
  projectBucket: ProfessorMatchBucket<TMatch, TCoverage>;
}) {
  return { studentBucket: emptyProfessorMatchBucket<TMatch, TCoverage>(), projectBucket };
}

export function resolveActiveProfessorMatch<
  TMatch extends { professor: { id: string } },
>({
  studentMatches,
  selectedStudentProfessorId,
  projectMatches,
  selectedProjectProfessorId,
  favoriteStudentProfessorIds = [],
}: {
  studentMatches: readonly TMatch[];
  selectedStudentProfessorId: string | null | undefined;
  projectMatches: readonly TMatch[];
  selectedProjectProfessorId: string | null | undefined;
  favoriteStudentProfessorIds?: readonly string[];
}): { source: "student" | "project"; match: TMatch } | null {
  const studentMatch = selectedStudentProfessorId
    ? studentMatches.find((match) => match.professor.id === selectedStudentProfessorId)
    : null;
  if (studentMatch) return { source: "student", match: studentMatch };

  const projectMatch = selectedProjectProfessorId
    ? projectMatches.find((match) => match.professor.id === selectedProjectProfessorId)
    : null;
  if (projectMatch) return { source: "project", match: projectMatch };

  const favoriteIds = new Set(favoriteStudentProfessorIds);
  const favoriteMatch = studentMatches.find((match) => favoriteIds.has(match.professor.id));
  return favoriteMatch ? { source: "student", match: favoriteMatch } : null;
}

/** 일반 교수 연결의 만남 준비는 프로젝트 자문 교수를 대신 사용하지 않습니다. */
export function resolveStudentProfessorMatch<
  TMatch extends { professor: { id: string } },
>({
  studentMatches,
  selectedStudentProfessorId,
  favoriteStudentProfessorIds = [],
}: {
  studentMatches: readonly TMatch[];
  selectedStudentProfessorId: string | null | undefined;
  favoriteStudentProfessorIds?: readonly string[];
}): TMatch | null {
  const selected = selectedStudentProfessorId
    ? studentMatches.find((match) => match.professor.id === selectedStudentProfessorId)
    : null;
  if (selected) return selected;
  const favoriteIds = new Set(favoriteStudentProfessorIds);
  return studentMatches.find((match) => favoriteIds.has(match.professor.id)) ?? null;
}

/**
 * 명시적으로 선택한 프로젝트 교수의 논문은 해당 논문의 질문·이메일 맥락에서
 * 우선합니다. 그 외에는 일반 만남에서 고른 학생 교수 맥락을 유지합니다.
 */
export function resolveQuestProfessorMatch<
  TMatch extends { professor: { id: string } },
>({
  studentMatches,
  selectedStudentProfessorId,
  favoriteStudentProfessorIds = [],
  projectMatches,
  selectedProjectProfessorId,
  selectedPaperProfessorId,
}: {
  studentMatches: readonly TMatch[];
  selectedStudentProfessorId: string | null | undefined;
  favoriteStudentProfessorIds?: readonly string[];
  projectMatches: readonly TMatch[];
  selectedProjectProfessorId: string | null | undefined;
  selectedPaperProfessorId: string | null | undefined;
}): TMatch | null {
  if (selectedPaperProfessorId && selectedProjectProfessorId === selectedPaperProfessorId) {
    const explicitProjectPaper = projectMatches.find(
      (match) => match.professor.id === selectedPaperProfessorId,
    );
    if (explicitProjectPaper) return explicitProjectPaper;
  }
  return resolveStudentProfessorMatch({
    studentMatches,
    selectedStudentProfessorId,
    favoriteStudentProfessorIds,
  });
}

/**
 * 현재 추천 배열이 새 검색으로 교체된 뒤에도, 학생이 대학 공식 프로필에서 직접
 * 고른 논문 교수의 최소 퀘스트 맥락을 선택 스냅샷만으로 복원합니다.
 */
export function createProfessorPaperQuestMatch(
  selection: ProfessorPaperSelection,
): ProfessorMatch {
  return {
    professor: {
      id: selection.professorId,
      university: "단국대학교",
      college: "",
      department: selection.professorDepartment,
      departments: [selection.professorDepartment],
      associationStatuses: [],
      name: selection.professorName,
      title: "교수",
      researchFields: [],
      publications: [{
        id: selection.paperId,
        title: selection.title,
        publicationType: selection.publicationType,
        publishedDate: selection.publishedDate,
        doi: selection.doi,
        kciId: selection.kciId,
        officialProfileUrl: selection.officialProfileUrl,
      }],
      publicationCount: 1,
      officialProfileUrl: selection.officialProfileUrl,
      sourceUrl: selection.officialProfileUrl,
      collectedAt: selection.selectedAt,
      status: "FOUND",
      researchFieldsStatus: "NOT_LISTED_ON_OFFICIAL_PROFILE",
      publicationsStatus: "FOUND",
      failureReason: null,
      profileEvidenceId: `paper-selection:${selection.professorId}`,
    },
    role: "CONTEXT",
    strength: "DIRECT",
    reason: "학생이 대학 공식 프로필에서 이 교수님의 논문을 직접 선택했습니다.",
    evidenceIds: [selection.paperId],
    matchedTerms: [selection.title],
    doesNotEstablish: ["논문 선택만으로 지도·면담 가능 여부를 판단할 수 없습니다."],
    decisionBasis: {
      matchedConcepts: [selection.title],
      departmentMatchesMajor: false,
      roleMatches: { topic: false, method: false, context: true },
      sources: {
        officialProfile: true,
        researchFields: false,
        matchedPublication: true,
      },
    },
  };
}

/**
 * 논문에서 시작한 퀘스트의 교수와 출처를 한 번에 결정합니다. 동일 교수가 두
 * 버킷에 있어도 실제 활성 선택과 같은 버킷을 우선해 질문과 이메일이 갈라지지 않습니다.
 */
export function resolveQuestProfessorContextMatch({
  studentMatches,
  selectedStudentProfessorId,
  favoriteStudentProfessorIds = [],
  projectMatches,
  selectedProjectProfessorId,
  selectedProfessorPaper,
}: {
  studentMatches: readonly ProfessorMatch[];
  selectedStudentProfessorId: string | null | undefined;
  favoriteStudentProfessorIds?: readonly string[];
  projectMatches: readonly ProfessorMatch[];
  selectedProjectProfessorId: string | null | undefined;
  selectedProfessorPaper: ProfessorPaperSelection | null | undefined;
}): { source: "student" | "project" | "paper"; match: ProfessorMatch } | null {
  const paperProfessorId = selectedProfessorPaper?.professorId ?? null;
  if (paperProfessorId && selectedProfessorPaper) {
    const studentPaperMatch = studentMatches.find(
      (match) => match.professor.id === paperProfessorId,
    ) ?? null;
    const projectPaperMatch = projectMatches.find(
      (match) => match.professor.id === paperProfessorId,
    ) ?? null;

    if (selectedStudentProfessorId === paperProfessorId && studentPaperMatch) {
      return { source: "student", match: studentPaperMatch };
    }
    if (selectedProjectProfessorId === paperProfessorId && projectPaperMatch) {
      return { source: "project", match: projectPaperMatch };
    }
    if (studentPaperMatch) return { source: "student", match: studentPaperMatch };
    if (projectPaperMatch) return { source: "project", match: projectPaperMatch };
    return { source: "paper", match: createProfessorPaperQuestMatch(selectedProfessorPaper) };
  }

  const studentMatch = resolveStudentProfessorMatch({
    studentMatches,
    selectedStudentProfessorId,
    favoriteStudentProfessorIds,
  });
  return studentMatch ? { source: "student", match: studentMatch } : null;
}

/** 프로젝트 실행 화면은 프로젝트 버킷에서 선택한 자문 교수만 사용합니다. */
export function resolveProjectProfessorMatch<
  TMatch extends { professor: { id: string } },
>({
  projectMatches,
  selectedProjectProfessorId,
}: {
  projectMatches: readonly TMatch[];
  selectedProjectProfessorId: string | null | undefined;
}): TMatch | null {
  return selectedProjectProfessorId
    ? projectMatches.find((match) => match.professor.id === selectedProjectProfessorId) ?? null
    : null;
}

export function removeProfessorFromMatchBuckets<
  TMatch extends { professor: { id: string } },
>({
  source,
  professorId,
  studentMatches,
  selectedStudentProfessorId,
  projectMatches,
  selectedProjectProfessorId,
}: {
  source: "student" | "project" | "paper";
  professorId: string;
  studentMatches: readonly TMatch[];
  selectedStudentProfessorId: string | null;
  projectMatches: readonly TMatch[];
  selectedProjectProfessorId: string | null;
}) {
  const nextStudentMatches = source === "student"
    ? studentMatches.filter((match) => match.professor.id !== professorId)
    : [...studentMatches];
  const nextProjectMatches = source === "project"
    ? projectMatches.filter((match) => match.professor.id !== professorId)
    : [...projectMatches];

  return {
    studentMatches: nextStudentMatches,
    selectedStudentProfessorId: source === "student" && selectedStudentProfessorId === professorId
      ? null
      : selectedStudentProfessorId,
    projectMatches: nextProjectMatches,
    selectedProjectProfessorId: source === "project" && selectedProjectProfessorId === professorId
      ? null
      : selectedProjectProfessorId,
  };
}

export function activateProfessorSelection({
  source,
  professorId,
  selectedStudentProfessorId,
  selectedProjectProfessorId,
}: {
  source: "student" | "project";
  professorId: string;
  selectedStudentProfessorId: string | null;
  selectedProjectProfessorId: string | null;
}) {
  return source === "project"
    ? {
        selectedStudentProfessorId,
        selectedProjectProfessorId: professorId,
      }
    : {
        selectedStudentProfessorId: professorId,
        selectedProjectProfessorId,
      };
}

export function professorMatchSourceForId<
  TMatch extends { professor: { id: string } },
>({
  professorId,
  studentMatches,
  projectMatches,
}: {
  professorId: string;
  studentMatches: readonly TMatch[];
  projectMatches: readonly TMatch[];
}): "student" | "project" | null {
  if (studentMatches.some((match) => match.professor.id === professorId)) return "student";
  if (projectMatches.some((match) => match.professor.id === professorId)) return "project";
  return null;
}

export function migrateProfessorMatchBuckets<TMatch = unknown, TCoverage = unknown>(legacy: {
  selectedTopicId: string | null | undefined;
  professorMatchTopicId: string | null | undefined;
  professorMatches: TMatch[] | null | undefined;
  professorCoverage: TCoverage | null | undefined;
  professorMatchStatus: ProfessorMatchStatus | null | undefined;
  professorMatchError: string | null | undefined;
  professorRejectedIds: string[] | null | undefined;
  selectedProfessorId: string | null | undefined;
}) {
  const bucket: ProfessorMatchBucket<TMatch, TCoverage> = {
    matches: Array.isArray(legacy.professorMatches) ? legacy.professorMatches : [],
    coverage: legacy.professorCoverage ?? null,
    status: legacy.professorMatchStatus ?? "idle",
    error: legacy.professorMatchError ?? null,
    topicId: legacy.professorMatchTopicId ?? null,
    rejectedIds: Array.isArray(legacy.professorRejectedIds) ? legacy.professorRejectedIds : [],
    selectedProfessorId: legacy.selectedProfessorId ?? null,
  };
  return isProjectProfessorMatchTopic(bucket.topicId, legacy.selectedTopicId)
    ? { studentBucket: emptyProfessorMatchBucket<TMatch, TCoverage>(), projectBucket: bucket }
    : { studentBucket: bucket, projectBucket: emptyProfessorMatchBucket<TMatch, TCoverage>() };
}
