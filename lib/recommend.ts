// 추천 결정 규칙 — USER_FLOW.md §8
// 검수된 로컬 데이터 필터링. 실시간 AI 생성·순위·0~100 점수 없음.
// 각 후보는 조건별로 확인됨 / 조건부 / 확인 필요 상태와 근거 문장을 가진다.

import {
  MAJORS,
  TOPICS,
  periodWeeks,
  type CheckStatus,
  type DataAccess,
  type ExperienceLevel,
  type Major,
  type PeriodLabel,
  type ResearchTopic,
} from "@/data/research-mvp";

export type Conditions = {
  major: Major | null;
  interests: string[]; // 1~3
  experience: ExperienceLevel | null;
  methods: string[]; // 1~2
  period: PeriodLabel | null;
  dataAccess: DataAccess | null;
  avoid: string[]; // 선택
};

export const emptyConditions: Conditions = {
  major: null,
  interests: [],
  experience: null,
  methods: [],
  period: null,
  dataAccess: null,
  avoid: [],
};

export type CriterionKey = "personalLink" | "dataAccess" | "method" | "period" | "uncertainty";

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  personalLink: "개인 경험 연결",
  dataAccess: "데이터 접근",
  method: "방법 준비",
  period: "기간·범위",
  uncertainty: "확인할 위험",
};

export type Check = { status: CheckStatus; note: string };

export type TopicWithChecks = {
  topic: ResearchTopic;
  matchedInterests: string[];
  matchedMethods: string[];
  checks: Record<CriterionKey, Check>;
};

export type RecommendResult =
  | { kind: "ok"; candidates: [TopicWithChecks, TopicWithChecks] }
  | { kind: "insufficient"; candidate: TopicWithChecks } // 유효 후보 1개
  | { kind: "empty" } // 0개
  | { kind: "unsupported-major" }; // 지원하지 않는 전공

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

// 필수값이 모두 채워졌는지
export function missingRequired(c: Conditions): CriterionKey[] | string[] {
  const missing: string[] = [];
  if (!c.major) missing.push("major");
  if (c.interests.length === 0) missing.push("interests");
  if (!c.experience) missing.push("experience");
  if (c.methods.length === 0) missing.push("methods");
  if (!c.period) missing.push("period");
  if (!c.dataAccess) missing.push("dataAccess");
  return missing;
}

export function buildChecks(topic: ResearchTopic, c: Conditions): TopicWithChecks {
  const matchedInterests = overlap(c.interests, topic.interests);
  const matchedMethods = overlap(c.methods, topic.methods);
  const userWeeks = c.period ? periodWeeks(c.period) : 4;

  // 개인 경험 연결
  const personalLink: Check = (() => {
    const linkNote = matchedInterests.length
      ? `관심 분야 ${matchedInterests.join("·")}와(과) 연결돼요.`
      : "관심 분야와의 직접 연결은 약해요.";
    if (c.experience === "과제·프로젝트 경험" && matchedInterests.length)
      return { status: "확인됨", note: `과제·프로젝트 경험과 ${linkNote}` };
    if (c.experience === "관련 수업 수강")
      return { status: "조건부", note: `수강 경험으로 시작할 수 있어요. ${linkNote}` };
    if (c.experience === "경험 없음")
      return { status: "확인 필요", note: `직접 해 본 경험이 없어 기초 학습이 필요해요. ${linkNote}` };
    return { status: "조건부", note: linkNote };
  })();

  // 데이터 접근
  const dataAccess: Check = (() => {
    if (c.dataAccess && topic.goodDataAccess.includes(c.dataAccess))
      return { status: "확인됨", note: `${c.dataAccess} 조건과 잘 맞아요.` };
    if (c.dataAccess === "아직 모름")
      return { status: "확인 필요", note: "접근 가능한 데이터를 먼저 확인해야 해요." };
    return {
      status: "조건부",
      note: `${topic.goodDataAccess.join("·")} 쪽이 더 맞아요. 대체 데이터를 확인해 보세요.`,
    };
  })();

  // 방법 준비
  const method: Check = (() => {
    if (c.methods.includes("아직 정하지 못함"))
      return { status: "조건부", note: `${topic.methodDetail} 방법을 함께 정하면 돼요.` };
    if (matchedMethods.length)
      return { status: "확인됨", note: `${matchedMethods.join("·")}(으)로 바로 시작할 수 있어요.` };
    return { status: "조건부", note: `${topic.methodDetail}에 필요한 방법을 조금 익혀야 해요.` };
  })();

  // 기간·범위
  const period: Check = (() => {
    if (topic.minWeeks <= userWeeks)
      return { status: "확인됨", note: `${c.period ?? ""} 안에 시작 범위를 만들 수 있어요.` };
    return {
      status: "조건부",
      note: `${topic.minWeeks}주 이상 권장이라 ${c.period ?? ""} 기준으로 범위를 줄여야 해요.`,
    };
  })();

  // 확인할 위험 (항상 존재)
  const uncertainty: Check = {
    status: "확인 필요",
    note: topic.uncertainties[0] ?? "교수·데이터 제공자에게 확인할 항목이 있어요.",
  };

  return {
    topic,
    matchedInterests,
    matchedMethods,
    checks: { personalLink, dataAccess, method, period, uncertainty },
  };
}

export function compareTopicPair(
  c: Conditions,
  topics: [ResearchTopic, ResearchTopic],
): RecommendResult {
  const ordered = [...topics].sort((a, b) =>
    (a.variant === "안전 축소형" ? -1 : 1) -
    (b.variant === "안전 축소형" ? -1 : 1));
  return {
    kind: "ok",
    candidates: [
      buildChecks(ordered[0], c),
      buildChecks(ordered[1], c),
    ],
  };
}

// 관심·방법 우선 정렬 점수 (내부용, 사용자에게 노출하지 않음)
function rankScore(t: ResearchTopic, c: Conditions): number {
  return overlap(c.interests, t.interests).length * 2 + overlap(c.methods, t.methods).length;
}

export type RecommendOptions = { excludeIds?: string[] };

export function recommend(c: Conditions, opts: RecommendOptions = {}): RecommendResult {
  if (!c.major || !MAJORS.includes(c.major)) return { kind: "unsupported-major" };
  const exclude = new Set(opts.excludeIds ?? []);

  // 1) 전공 지원 → 2) 피하고 싶은 방식 충돌 제외 → 3) 이미 본 후보 제외
  const pool = TOPICS.filter(
    (t) =>
      t.majors.includes(c.major as Major) &&
      overlap(t.avoidTags, c.avoid).length === 0 &&
      !exclude.has(t.id),
  );

  if (pool.length === 0) return { kind: "empty" };

  // 관심·방법 우선 정렬
  const ranked = [...pool].sort((a, b) => rankScore(b, c) - rankScore(a, c));

  // 비교 가치가 있는 서로 다른 2개: 같은 pairId의 안전형↔심화형을 우선
  const top = ranked[0];
  const partner = ranked.find((t) => t.pairId === top.pairId && t.id !== top.id);
  let picked: ResearchTopic[];
  if (partner) {
    picked = [top, partner];
  } else {
    const other = ranked.find((t) => t.pairId !== top.pairId);
    picked = other ? [top, other] : [top];
  }

  if (picked.length < 2) return { kind: "insufficient", candidate: buildChecks(picked[0], c) };

  // 안전 축소형을 A, 차별 심화형을 B로 정렬
  picked.sort((a, b) => (a.variant === "안전 축소형" ? -1 : 1) - (b.variant === "안전 축소형" ? -1 : 1));
  return { kind: "ok", candidates: [buildChecks(picked[0], c), buildChecks(picked[1], c)] };
}
