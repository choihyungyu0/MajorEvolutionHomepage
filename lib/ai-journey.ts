import {
  allIdeas,
  dnaResult,
  ideaSets,
  trends,
  type Idea,
  type EditablePassport,
  type StudentProfile,
  type Trend,
} from "@/data/prototype";

export type AiDnaResult = {
  axes: string[];
  summary: string;
  strengths: string[];
  preparation: string[];
  radar: number[];
  radarLabels: string[];
};

export type AiJourneyResult = {
  dna: AiDnaResult;
  trends: Trend[];
  ideas: Idea[];
  generatedAt: string;
  model: string;
};

export type AiGenerationStatus = "idle" | "loading" | "success" | "fallback" | "error";

export type AiJourneyRequest = {
  profile: StudentProfile;
  goal: string | null;
};

export type AiIdeasRequest = AiJourneyRequest & {
  selectedTrend: Trend;
  previousIdeaTitles: string[];
};

export function createFallbackJourney(): AiJourneyResult {
  return {
    dna: dnaResult,
    trends,
    ideas: ideaSets[0],
    generatedAt: new Date().toISOString(),
    model: "sample-fallback",
  };
}

export function getAvailableIdeas(journey: AiJourneyResult | null): Idea[] {
  return journey ? [...journey.ideas, ...allIdeas] : allIdeas;
}

export function createPassportFromIdea(idea: Idea): EditablePassport {
  return {
    problem: idea.problem,
    question: idea.question,
    data: idea.data.join(", "),
    methods: idea.methods.join(" → "),
    output: `${idea.title}의 분석 결과와 실행 과정을 정리한 보고서 또는 프로토타입`,
    risks: "데이터 접근 범위, 개인정보·연구윤리, 기간 안에 검증 가능한 평가 기준을 확인해야 해요.",
    professorQuestions: `연구 질문의 범위, ${idea.methods.slice(0, 2).join("·")} 적용 방법, ${idea.weeks}주 실행 범위를 확인해 주세요.`,
  };
}
