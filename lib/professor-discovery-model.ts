import type { ResearchTopic } from "@/data/research-mvp";
import type { ProfessorMatchTopic } from "@/lib/professor-domain";

export const MAX_DISCOVERY_INTERESTS = 5;
export const MAX_CAREER_INTERESTS = 3;
export const MAX_CAREER_CONCERNS = 2;
export const DIRECT_ACADEMIC_ENTRY = "직접 입력";

export const STUDENT_STAGE_OPTIONS = [
  "전공을 고르는 중",
  "전공 기초를 배우는 중",
  "전공을 심화하는 중",
  "취업을 준비하는 중",
  "연구·대학원을 준비하는 중",
  "진로를 다시 탐색하는 중",
] as const;

export const GOAL_OPTIONS = [
  "전공·진로 방향 찾기",
  "수업·연구 주제 탐색",
  "프로젝트·학부연구 참여",
  "취업·직무 조언 받기",
  "대학원·연구실 탐색",
] as const;

export const INTEREST_OPTIONS = [
  "AI·데이터",
  "SW·보안",
  "공학·반도체·제조",
  "경영·마케팅",
  "경제·금융",
  "공공·정책",
  "교육·학습",
  "심리·상담",
  "미디어·콘텐츠·디자인",
  "예술·공연",
  "바이오·헬스",
  "식품·농업",
  "환경·ESG",
  "건축·도시·부동산",
  "스포츠",
  "언어·국제",
  "법·제도",
  "창업·신사업",
] as const;

export const CAREER_INTEREST_OPTIONS = [
  "데이터·AI 직무",
  "소프트웨어 개발",
  "서비스기획·PM",
  "마케팅·브랜딩",
  "금융·회계",
  "컨설팅·리서치",
  "연구개발·실험",
  "공공정책·행정",
  "교육·상담",
  "콘텐츠·디자인",
  "바이오·헬스",
  "영업·사업개발",
] as const;

export const CAREER_CONCERN_OPTIONS = [
  "전공이 나와 맞는지",
  "어떤 직무가 맞는지",
  "취업시장·전망",
  "필요한 역량·포트폴리오",
  "인턴·프로젝트 경험",
  "부전공·복수전공 선택",
  "취업과 대학원 사이",
  "비전공 분야 진입",
  "교수님께 무엇을 물을지",
  "아직 잘 모르겠어요",
] as const;

export const CAREER_GOAL_OPTIONS = [
  "민간기업 취업",
  "스타트업·테크 취업",
  "공공기관·공무원",
  "대학원·연구직",
  "전문직·자격",
  "창업·프리랜서",
  "아직 탐색 중",
] as const;

export const SECONDARY_MAJOR_TYPES = [
  "없음",
  "부전공",
  "복수전공",
  "연계·융합전공",
] as const;

export const MEETING_OPTIONS = [
  "수업 후 질문",
  "오피스아워",
  "이메일",
  "연구실 방문",
] as const;

export const SUPPORT_STYLE_OPTIONS = [
  "큰 방향과 선택지를 듣고 싶어요",
  "구체적인 피드백을 받고 싶어요",
  "수업·논문을 추천받고 싶어요",
  "프로젝트·연구에 참여하고 싶어요",
  "진로 경험과 준비법을 듣고 싶어요",
] as const;

export type ProfessorDiscoveryContext = {
  university: string;
  college: string;
  major: string;
  studentStage: string;
  goal: string;
  interests: string[];
  careerInterests: string[];
  careerConcerns: string[];
  secondaryMajorType: string;
  secondaryCollege: string;
  secondaryMajor: string;
  topic: string;
  careerGoal: string;
  meetingSituation: string;
  preferredSupport: string;
  experience: string;
  additionalContext: string;
};

export const EMPTY_PROFESSOR_DISCOVERY_CONTEXT: ProfessorDiscoveryContext = {
  university: "",
  college: "",
  major: "",
  studentStage: "",
  goal: "",
  interests: [],
  careerInterests: [],
  careerConcerns: [],
  secondaryMajorType: "없음",
  secondaryCollege: "",
  secondaryMajor: "",
  topic: "",
  careerGoal: "",
  meetingSituation: "",
  preferredSupport: "",
  experience: "",
  additionalContext: "",
};

export function discoveryContextToMatchTopic(
  context: ProfessorDiscoveryContext,
  savedTopic?: ResearchTopic | null,
): ProfessorMatchTopic {
  const interests = [...new Set(context.interests.map((item) => item.trim()).filter(Boolean))]
    .slice(0, MAX_DISCOVERY_INTERESTS);
  const careerInterests = [
    ...new Set(context.careerInterests.map((item) => item.trim()).filter(Boolean)),
  ].slice(0, MAX_CAREER_INTERESTS);
  const careerConcerns = [
    ...new Set(context.careerConcerns.map((item) => item.trim()).filter(Boolean)),
  ].slice(0, MAX_CAREER_CONCERNS);
  const topic = context.topic.trim()
    || savedTopic?.title.trim()
    || interests[0]
    || careerInterests[0]
    || "";
  const careerGoal = context.careerGoal.trim();
  const meetingSituation = context.meetingSituation.trim();
  const additionalContext = context.additionalContext.trim();
  const goal = context.goal.trim();
  const secondaryMajor = context.secondaryMajorType === "없음"
    ? ""
    : context.secondaryMajor.trim();

  return {
    id: savedTopic?.id
      ?? `discovery:${[context.major, secondaryMajor, topic, goal].join(":")}`,
    title: topic,
    question: savedTopic?.question
      ?? `‘${topic}’ 주제를 ${context.major.trim()} 전공 관점에서 어떻게 탐색할 수 있을까?`,
    methodDetail: savedTopic?.methodDetail ?? "",
    scope: [
      savedTopic?.scope,
      context.college && `단과대: ${context.college}`,
      context.studentStage && `현재 단계: ${context.studentStage}`,
      goal && `원하는 도움: ${goal}`,
      secondaryMajor && `${context.secondaryMajorType}: ${secondaryMajor}`,
      careerGoal && `진로 목표: ${careerGoal}`,
      careerConcerns.length > 0 && `진로 고민: ${careerConcerns.join(", ")}`,
      meetingSituation && `만남 상황: ${meetingSituation}`,
      context.preferredSupport && `원하는 도움 방식: ${context.preferredSupport}`,
      context.experience.trim() && `경험·역량: ${context.experience.trim()}`,
      additionalContext,
    ].filter(Boolean).join(" · "),
    interests,
    methods: savedTopic?.methods ?? [],
    major: context.major.trim(),
    university: context.university.trim(),
    college: context.college.trim(),
    goal,
    studentStage: context.studentStage.trim(),
    secondaryMajorType: context.secondaryMajorType,
    secondaryCollege: context.secondaryCollege.trim(),
    secondaryMajor,
    careerInterests,
    careerConcerns,
    careerGoal,
    meetingSituation,
    preferredSupport: context.preferredSupport.trim(),
    experience: context.experience.trim(),
    additionalContext,
  };
}

/**
 * 새로고침 뒤 저장된 교수 매칭 요청을 찾다 폼과 피칭 카드 맥락으로 복원합니다.
 *
 * 서버가 판단에 사용한 요청만 되살리며, 교수에 대한 새 정보는 만들지 않습니다.
 */
export function professorMatchTopicToDiscoveryContext(
  topic: ProfessorMatchTopic,
): ProfessorDiscoveryContext {
  return {
    university: topic.university ?? "",
    college: topic.college ?? "",
    major: topic.major,
    studentStage: topic.studentStage ?? "",
    goal: topic.goal ?? "",
    interests: [...topic.interests],
    careerInterests: [...(topic.careerInterests ?? [])],
    careerConcerns: [...(topic.careerConcerns ?? [])],
    secondaryMajorType: topic.secondaryMajorType || "없음",
    secondaryCollege: topic.secondaryCollege ?? "",
    secondaryMajor: topic.secondaryMajor ?? "",
    topic: topic.title,
    careerGoal: topic.careerGoal ?? "",
    meetingSituation: topic.meetingSituation ?? "",
    preferredSupport: topic.preferredSupport ?? "",
    experience: topic.experience ?? "",
    additionalContext: topic.additionalContext ?? "",
  };
}

export type ProfessorDiscoveryBasicField =
  | "university"
  | "college"
  | "major"
  | "studentStage"
  | "goal"
  | "interests"
  | "careerConcerns";

export type ProfessorDiscoveryValidationIssue = {
  field: ProfessorDiscoveryBasicField;
  message: string;
};

/**
 * 빠른 교수 매칭에 필요한 최소 설정만 확인합니다.
 *
 * 전공과 관심 분야는 공식 교수 연구 정보와 직접 비교하는 값입니다. 현재 단계,
 * 원하는 도움, 진로 고민은 상세 질문 개인화에 쓰이므로 기본 설정에서는 강제하지 않습니다.
 */
export function validateProfessorDiscoverySetup(
  context: ProfessorDiscoveryContext,
): ProfessorDiscoveryValidationIssue | null {
  if (!context.university.trim()) {
    return { field: "university", message: "단국대학교를 선택해 주세요." };
  }
  if (!context.college.trim()) {
    return { field: "college", message: "단과대를 선택해 주세요." };
  }
  if (!context.major.trim()) {
    return { field: "major", message: "주전공을 선택하거나 직접 입력해 주세요." };
  }
  if (context.interests.length === 0) {
    return { field: "interests", message: "관심 연구·산업 분야를 하나 이상 선택해 주세요." };
  }
  return null;
}

export function validateProfessorDiscoveryBasics(
  context: ProfessorDiscoveryContext,
): ProfessorDiscoveryValidationIssue | null {
  const setupIssue = validateProfessorDiscoverySetup(context);
  if (setupIssue) return setupIssue;
  if (!context.studentStage.trim()) {
    return { field: "studentStage", message: "현재 진로 단계를 선택해 주세요." };
  }
  if (!context.goal.trim()) {
    return { field: "goal", message: "교수님에게 받고 싶은 도움을 선택해 주세요." };
  }
  if (context.careerConcerns.length === 0) {
    return { field: "careerConcerns", message: "현재 진로 고민을 하나 이상 선택해 주세요." };
  }
  return null;
}

export function toggleLimitedValue(
  values: string[],
  value: string,
  limit: number,
): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= limit) return values;
  return [...values, value];
}

export function normalizeSecondaryMajor(
  context: ProfessorDiscoveryContext,
): ProfessorDiscoveryContext {
  if (context.secondaryMajorType !== "없음") return context;
  return {
    ...context,
    secondaryCollege: "",
    secondaryMajor: "",
  };
}

export function validateProfessorDiscoverySecondary(
  context: ProfessorDiscoveryContext,
): string | null {
  if (context.secondaryMajorType === "없음") return null;
  if (!context.secondaryMajor.trim()) {
    return `${context.secondaryMajorType} 학과·전공을 선택하거나 직접 입력해 주세요.`;
  }
  if (
    context.secondaryMajor.trim().toLocaleLowerCase("ko-KR")
    === context.major.trim().toLocaleLowerCase("ko-KR")
  ) {
    return "주전공과 다른 부·복수전공을 선택해 주세요.";
  }
  return null;
}

function contextExcerpt(value: string, maxLength = 70): string {
  const normalized = value
    .replace(/\[redacted-[^\]]+\]/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}…`
    : normalized;
}

export function buildProfessorContextQuestions(
  context: ProfessorDiscoveryContext,
  professorResearchField: string,
): string[] {
  const questions: string[] = [];
  const readableResearchField = professorResearchField
    .replace(/\[redacted-[^\]]+\]/giu, "")
    .replace(/^[\s:·-]+/u, "")
    .trim()
    .slice(0, 100);
  const researchSubject = readableResearchField
    ? `‘${readableResearchField}’ 분야`
    : "교수님의 연구 분야";
  const stageAndGoal = [
    context.studentStage.trim() && `현재 단계는 ‘${context.studentStage.trim()}’`,
    context.goal.trim() && `원하는 도움은 ‘${context.goal.trim()}’`,
  ].filter(Boolean).join(", ");
  const concerns = context.careerConcerns
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" · ");
  const concernSentence = concerns
    ? ` ‘${concerns}’ 고민을 풀기 위해`
    : "";
  questions.push(
    `${stageAndGoal ? `${stageAndGoal}입니다. ` : ""}${researchSubject}를 탐색하며${concernSentence} 먼저 해볼 경험은 무엇인가요?`,
  );

  const academicCareerConditions = [
    context.major.trim() && `주전공 ‘${context.major.trim()}’`,
    context.secondaryMajorType !== "없음" && context.secondaryMajor.trim()
      ? `${context.secondaryMajorType} ‘${context.secondaryMajor.trim()}’`
      : "",
    context.careerInterests.length > 0
      ? `관심 직무 ‘${context.careerInterests.join(" · ")}’`
      : "",
    context.careerGoal.trim() && `진로 목표 ‘${context.careerGoal.trim()}’`,
  ].filter(Boolean);
  if (academicCareerConditions.length > 1) {
    questions.push(
      `${academicCareerConditions.join(", ")} 조건을 함께 살릴 수 있는 수업·프로젝트·역량의 시작점은 무엇인가요?`,
    );
  }

  const preparationContext = [
    context.meetingSituation.trim() && `만날 상황은 ‘${context.meetingSituation.trim()}’`,
    context.preferredSupport.trim() && `원하는 도움 방식은 ‘${context.preferredSupport.trim()}’`,
  ].filter(Boolean).join(", ");
  const experienceExcerpt = contextExcerpt(context.experience);
  const additionalExcerpt = contextExcerpt(context.additionalContext);
  const preparationSources = [
    experienceExcerpt && `제가 해본 경험은 ‘${experienceExcerpt}’`,
    additionalExcerpt && `추가 배경·제약은 ‘${additionalExcerpt}’`,
  ].filter(Boolean).join(", ");
  if (preparationContext || preparationSources) {
    questions.push(
      `${preparationContext ? `${preparationContext}입니다. ` : ""}${preparationSources ? `${preparationSources}입니다. ` : ""}이 상황을 바탕으로 어떤 자료와 질문을 준비하면 좋을까요?`,
    );
  }

  return questions.slice(0, 3);
}
