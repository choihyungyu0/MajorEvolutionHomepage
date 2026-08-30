import type { ProfessorDiscoveryContext } from "@/lib/professor-discovery-model";
import type {
  ProfessorMatch,
  ProfessorMatchRole,
} from "@/lib/professor-domain";

export type ProfessorPitchViewModel = {
  roleLabel: string;
  roleNickname: string;
  pitchLine: string;
  studentConnections: string[];
  officialConnections: string[];
  potentialLearning: string[];
  mentorRole: string;
  firstQuestion: string;
  verificationItems: string[];
  hasOfficialPublications: boolean;
};

type RoleCopy = {
  label: string;
  nickname: string;
  learning: [string, string, string];
  mentorRole: string;
  pitch: (interest: string, evidence: string) => string;
};

const ROLE_COPY: Record<ProfessorMatchRole, RoleCopy> = {
  TOPIC: {
    label: "주제 연결형",
    nickname: "주제 길잡이",
    learning: [
      "관심사를 더 선명한 연구 질문으로 좁히는 과정",
      "해당 분야의 핵심 쟁점과 선행연구를 살펴보는 관점",
      "막연한 아이디어를 수업·프로젝트 주제로 연결하는 방법",
    ],
    mentorRole: "내 관심사를 실제 연구주제로 구체화해 볼 ‘주제 길잡이’",
    pitch: (interest, evidence) =>
      `‘${interest}’에 대한 관심을 더 선명한 연구 질문으로 키워보고 싶다면, 공식 프로필의 ‘${evidence}’ 연구를 출발점으로 살펴볼 수 있어요.`,
  },
  METHOD: {
    label: "방법 연결형",
    nickname: "방법 코치",
    learning: [
      "아이디어를 검증 가능한 계획으로 바꾸는 과정",
      "데이터·분석·실험 접근법의 실마리를 찾는 방법",
      "결과를 해석하고 한계를 질문하는 관점",
    ],
    mentorRole: "내 아이디어를 검증 가능한 계획으로 바꿔 볼 ‘방법 코치’",
    pitch: (interest, evidence) =>
      `‘${interest}’ 아이디어를 실제 데이터와 방법으로 검증해보고 싶다면, 공식 프로필의 ‘${evidence}’ 연구에서 접근법의 실마리를 찾아볼 수 있어요.`,
  },
  CONTEXT: {
    label: "확장 관점형",
    nickname: "확장 탐험가",
    learning: [
      "전공 지식을 다른 산업·학문에 적용해 보는 관점",
      "익숙한 문제를 다른 시선으로 다시 해석하는 과정",
      "후속 수업·프로젝트·진로 질문을 만드는 방법",
    ],
    mentorRole: "내 전공의 쓰임을 다른 분야까지 넓혀 볼 ‘확장 탐험가’",
    pitch: (interest, evidence) =>
      `‘${interest}’ 관심을 다른 산업·학문·진로로 넓혀보고 싶다면, 공식 프로필의 ‘${evidence}’ 관점으로 문제를 새롭게 볼 수 있어요.`,
  },
};

export function professorMatchRoleLabel(match: ProfessorMatch): string {
  if (match.role !== "CONTEXT" || !match.decisionBasis.departmentMatchesMajor) {
    return ROLE_COPY[match.role].label;
  }
  const affiliation = match.decisionBasis.matchedAcademicAffiliation;
  return affiliation?.label ? `${affiliation.label} 연결` : "같은 학과 연결";
}

function homeDepartmentCopy(match: ProfessorMatch): RoleCopy {
  const affiliation = match.decisionBasis.matchedAcademicAffiliation;
  const affiliationLabel = affiliation?.label || "같은 학과";
  const affiliationMajor = affiliation?.major || match.professor.department;
  return {
    label: professorMatchRoleLabel(match),
    nickname: "가까운 시작점",
    learning: [
      `${affiliationLabel} 학과의 수업·프로젝트 흐름을 질문하는 방법`,
      "전공 안에서 세부 분야와 진로 방향을 구분하는 관점",
      `막연한 고민을 ${affiliationLabel} 맥락의 첫 질문으로 바꾸는 과정`,
    ],
    mentorRole: `${affiliationLabel} 맥락에서 첫 대화의 문턱을 낮춰 볼 ‘가까운 시작점’`,
    pitch: (interest, evidence) =>
      `입력한 ${affiliationLabel} ‘${affiliationMajor}’와 공식 소속이 연결된 교수님이라, ‘${interest}’ 고민을 학과 수업과 전공 흐름 안에서 어디서부터 질문할지 살펴보기 좋은 시작점이에요. 공식 연결 근거는 ‘${evidence}’입니다.`,
  };
}

function compactUnique(values: Array<string | undefined>, limit: number): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(
    (value): value is string => Boolean(value),
  ))].slice(0, limit);
}

function normalizeConcern(concern: string): string {
  return concern.endsWith("고민") ? concern : `${concern} 고민`;
}

/**
 * 학생 입력, 대학 공식 근거, 서비스가 제안한 표현을 섞지 않고 피칭 카드용으로 나눕니다.
 * 이 결과는 교수의 실제 발언·성격·지도 가능성을 뜻하지 않습니다.
 */
export function buildProfessorPitch(
  match: ProfessorMatch,
  context: ProfessorDiscoveryContext,
  firstQuestion: string,
): ProfessorPitchViewModel {
  const copy = match.role === "CONTEXT" && match.decisionBasis.departmentMatchesMajor
    ? homeDepartmentCopy(match)
    : ROLE_COPY[match.role];
  const professor = match.professor;
  const matchedOfficialConnections = compactUnique(match.matchedTerms, 3);
  const officialConnections = matchedOfficialConnections.length > 0
    ? matchedOfficialConnections
    : compactUnique(professor.researchFields, 3);
  const evidence = officialConnections[0] ?? professor.department;
  const interest = compactUnique([
    ...context.interests,
    ...context.careerInterests,
    context.topic,
    context.major,
  ], 1)[0] ?? "내 관심 분야";
  const studentConnections = compactUnique([
    context.major && `${context.major} 전공`,
    context.secondaryMajor && `${context.secondaryMajorType} ${context.secondaryMajor}`,
    ...context.interests.map((item) => `${item} 관심`),
    ...context.careerInterests.map((item) => `${item} 관심`),
    ...context.careerConcerns.map(normalizeConcern),
  ], 4);

  return {
    roleLabel: copy.label,
    roleNickname: copy.nickname,
    pitchLine: copy.pitch(interest, evidence),
    studentConnections,
    officialConnections,
    potentialLearning: [...copy.learning],
    mentorRole: copy.mentorRole,
    firstQuestion: firstQuestion.trim()
      || `교수님, ‘${evidence}’ 분야를 이해하려면 어떤 수업이나 작은 프로젝트부터 시작하면 좋을까요?`,
    verificationItems: compactUnique(match.doesNotEstablish, 5),
    hasOfficialPublications:
      professor.publicationsStatus === "FOUND" && professor.publications.length > 0,
  };
}
