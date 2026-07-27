import type { IdeaMode, ConfirmedAnswer } from "@/data/co-design";
import {
  periodWeeks,
  type CheckStatus,
  type ResearchTopic,
} from "@/data/research-mvp";
import type { Conditions } from "@/lib/recommend";

export type CoDesignCandidate = {
  variant: "안전 축소형" | "차별 심화형";
  title: string;
  problem: string;
  question: string;
  reason: string;
  userConfirmed: string[];
  aiProposed: string[];
  dataOptions: { name: string; status: CheckStatus }[];
  methodDetail: string;
  scope: string;
  uncertainties: string[];
  firstAction: string;
  evidence: {
    title: string;
    type: "사용자 확인" | "공식 프로필" | "공식 논문 목록" | "확인 필요";
    status: CheckStatus;
    sourceId: string;
    verifiedAt: string;
  }[];
};

export type CoDesignRequest = {
  mode: IdeaMode;
  conditions: Conditions;
  answers: ConfirmedAnswer[];
};

export type CoDesignResponse = {
  candidates: [CoDesignCandidate, CoDesignCandidate];
  generatedAt: string;
  model: string;
  grounding: {
    officialSourceCount: number;
    blockedSourceCount: number;
    note: string;
  };
};

export function candidatesToTopics(
  response: CoDesignResponse,
  conditions: Conditions,
): [ResearchTopic, ResearchTopic] {
  const pairId = `co-design-${Date.now()}`;
  const major = conditions.major;
  if (!major) throw new Error("전공 정보가 없습니다.");

  const topics = response.candidates.map((candidate, index): ResearchTopic => ({
    id: `${pairId}-${index === 0 ? "safe" : "deep"}`,
    pairId,
    variant: candidate.variant,
    title: candidate.title,
    majors: [major],
    interests: [...conditions.interests],
    methods: conditions.methods.includes("아직 정하지 못함")
      ? []
      : [...conditions.methods],
    minWeeks: conditions.period ? periodWeeks(conditions.period) : 4,
    goodDataAccess: conditions.dataAccess ? [conditions.dataAccess] : ["아직 모름"],
    avoidTags: [...conditions.avoid],
    problem: candidate.problem,
    question: candidate.question,
    reason: candidate.reason,
    userConfirmed: candidate.userConfirmed,
    aiProposed: candidate.aiProposed,
    dataOptions: candidate.dataOptions,
    methodDetail: candidate.methodDetail,
    scope: candidate.scope,
    uncertainties: candidate.uncertainties,
    firstAction: candidate.firstAction,
    evidence: candidate.evidence.map((source) => ({
      id: source.sourceId,
      title: source.title,
      type: source.type,
      verifiedAt: source.verifiedAt,
    })),
    professorIds: [],
  }));

  return [topics[0], topics[1]];
}
