// 추천 결정 규칙 — USER_FLOW.md §8
// 검수된 로컬 데이터 필터링. 실시간 AI 생성·순위·0~100 점수 없음.
// 각 후보는 조건별로 확인됨 / 조건부 / 확인 필요 상태와 근거 문장을 가진다.

import {
  TOPICS,
  periodWeeks,
  type CheckStatus,
  type DataAccess,
  type ExperienceLevel,
  type PeriodLabel,
  type ResearchTopic,
} from "@/data/research-mvp";
import {
  normalizeAcademicInput,
  type MajorArea,
} from "@/data/academic-options";

export type Conditions = {
  school: string; // 선택
  majorArea: MajorArea | null;
  major: string | null;
  interests: string[]; // 1~3
  experience: ExperienceLevel | null;
  methods: string[]; // 1~2
  period: PeriodLabel | null;
  dataAccess: DataAccess | null;
  avoid: string[]; // 선택
};

export const emptyConditions: Conditions = {
  school: "",
  majorArea: null,
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
  personalLink: "관심·경험 연결",
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
  | { kind: "empty" }; // 0개

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

// 필수값이 모두 채워졌는지
export function missingRequired(c: Conditions): CriterionKey[] | string[] {
  const missing: string[] = [];
  if (!c.majorArea) missing.push("majorArea");
  if (!c.major?.trim()) missing.push("major");
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
  const ordered = orderPairVariants(topics[0], topics[1]);
  return {
    kind: "ok",
    candidates: [
      buildChecks(ordered[0], c),
      buildChecks(ordered[1], c),
    ],
  };
}

type RecommendationEvidence = {
  interestMatched: boolean;
  methodMatched: boolean;
  dataAccessMatched: boolean;
  periodMatched: boolean;
};

function recommendationEvidence(
  topic: ResearchTopic,
  conditions: Conditions,
): RecommendationEvidence {
  return {
    interestMatched: overlap(conditions.interests, topic.interests).length > 0,
    methodMatched: overlap(conditions.methods, topic.methods).length > 0,
    dataAccessMatched: Boolean(
      conditions.dataAccess
      && topic.goodDataAccess.includes(conditions.dataAccess),
    ),
    periodMatched: Boolean(
      conditions.period
      && topic.minWeeks <= periodWeeks(conditions.period),
    ),
  };
}

function compareByEvidence(
  left: ResearchTopic,
  right: ResearchTopic,
  conditions: Conditions,
): number {
  const leftEvidence = recommendationEvidence(left, conditions);
  const rightEvidence = recommendationEvidence(right, conditions);
  const rules: Array<(evidence: RecommendationEvidence) => boolean> = [
    (evidence) => evidence.interestMatched,
    (evidence) => evidence.methodMatched,
    (evidence) => evidence.dataAccessMatched,
    (evidence) => evidence.periodMatched,
  ];

  for (const rule of rules) {
    const leftMatches = rule(leftEvidence);
    const rightMatches = rule(rightEvidence);
    if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

function orderPairVariants(
  left: ResearchTopic,
  right: ResearchTopic,
): [ResearchTopic, ResearchTopic] {
  if (left.variant === "안전 축소형" && right.variant !== "안전 축소형") {
    return [left, right];
  }
  if (right.variant === "안전 축소형" && left.variant !== "안전 축소형") {
    return [right, left];
  }
  return left.id.localeCompare(right.id) <= 0 ? [left, right] : [right, left];
}

export type RecommendOptions = { excludeIds?: string[] };

function normalizedMajor(value: string): string {
  return normalizeAcademicInput(value, 80).replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function majorNamesOverlap(left: string, right: string): boolean {
  const normalizedLeft = normalizedMajor(left);
  const normalizedRight = normalizedMajor(right);
  return Boolean(
    normalizedLeft
    && normalizedRight
    && (
      normalizedLeft.includes(normalizedRight)
      || normalizedRight.includes(normalizedLeft)
    )
  );
}

function availableMethods(conditions: Conditions): string[] {
  const selected = conditions.methods.filter((method) => method !== "아직 정하지 못함");
  return selected.length > 0 ? selected.slice(0, 2) : ["문헌조사"];
}

function fallbackDataOptions(
  conditions: Conditions,
): ResearchTopic["dataOptions"] {
  if (conditions.dataAccess === "공개 데이터") {
    return [
      { name: "공개 통계·보고서·학술자료 후보", status: "조건부" },
      { name: "학과·전공 관련 공개 사례", status: "확인 필요" },
    ];
  }
  if (conditions.dataAccess === "직접 수집 가능") {
    return [
      { name: "소규모 관찰·설문·인터뷰 자료", status: "조건부" },
      { name: "공개 자료와 직접 수집 자료의 비교", status: "확인 필요" },
    ];
  }
  return [
    { name: "접근 가능한 공개 자료", status: "확인 필요" },
    { name: "학교·학과에서 이용 가능한 자료", status: "확인 필요" },
  ];
}

/**
 * AI를 사용할 수 없고 검수된 전공별 주제가 없는 경우에도,
 * 학생이 입력한 사실만 조합해 비교 가능한 두 개의 범용 시작안을 만든다.
 */
export function buildUniversalFallbackTopics(
  conditions: Conditions,
): [ResearchTopic, ResearchTopic] | null {
  const major = normalizeAcademicInput(conditions.major, 80);
  const majorArea = conditions.majorArea;
  const interests = conditions.interests
    .map((interest) => normalizeAcademicInput(interest, 60))
    .filter(Boolean)
    .slice(0, 3);
  if (!major || !majorArea || interests.length === 0) return null;

  const primaryInterest = interests[0];
  const secondInterest = interests[1] ?? `${majorArea}의 실제 사례`;
  const methods = availableMethods(conditions);
  const dataOptions = fallbackDataOptions(conditions);
  const pairId = `universal-${majorArea}`;
  const period = conditions.period ?? "선택 기간";
  const schoolContext = normalizeAcademicInput(conditions.school, 80);
  const context = schoolContext
    ? `${schoolContext}의 수업·학과 맥락`
    : "학교와 관계없이 확인할 수 있는 대학생 맥락";
  const evidence = [
    {
      id: "student-selected-major",
      title: `${majorArea} · ${major}`,
      type: "사용자 입력",
      verifiedAt: "현재 세션",
    },
    {
      id: "student-selected-interests",
      title: interests.join(" · "),
      type: "사용자 입력",
      verifiedAt: "현재 세션",
    },
  ];

  return [
    {
      id: `${pairId}-evidence`,
      pairId: `${pairId}-evidence`,
      variant: "안전 축소형",
      title: `${major}에서 ${primaryInterest} 문제 지도 만들기`,
      majors: [major],
      interests,
      methods,
      minWeeks: 4,
      goodDataAccess: conditions.dataAccess ? [conditions.dataAccess] : ["아직 모름"],
      avoidTags: [],
      problem: `${context}에서 ${primaryInterest}와 연결된 문제를 먼저 좁혀야 합니다.`,
      question: `${major} 분야에서 ${primaryInterest}와 관련해 한 학기 안에 확인할 수 있는 문제는 무엇일까?`,
      reason: `${majorArea} 계열과 선택한 관심 분야를 직접 연결하되, 새로운 사실을 가정하지 않는 시작안입니다.`,
      userConfirmed: [major, ...interests],
      aiProposed: ["공개 자료로 확인 가능한 작은 범위부터 시작"],
      dataOptions: dataOptions.map((option) => ({ ...option })),
      methodDetail: `${methods.join("·")}로 문제와 근거 후보를 정리`,
      scope: `${period} 동안 대상 1개와 핵심 질문 1개로 범위를 제한`,
      uncertainties: [
        "실제 학과 커리큘럼과 교수 연구분야의 공식 근거를 추가로 확인해야 합니다.",
      ],
      firstAction: `${major} 학과 페이지나 공개 강의계획서에서 ${primaryInterest} 관련 표현 3개 찾기`,
      evidence: evidence.map((source) => ({ ...source })),
    },
    {
      id: `${pairId}-application`,
      pairId: `${pairId}-application`,
      variant: "차별 심화형",
      title: `${secondInterest} 의사결정 지원 프로젝트`,
      majors: [major],
      interests,
      methods,
      minWeeks: 8,
      goodDataAccess: conditions.dataAccess ? [conditions.dataAccess] : ["아직 모름"],
      avoidTags: [],
      problem: `${secondInterest} 맥락에서 실제 선택이나 행동을 도울 기준과 자료가 필요합니다.`,
      question: `${secondInterest} 맥락에서 ${primaryInterest} 관련 의사결정을 돕기 위해 어떤 정보와 기준을 결합해야 할까?`,
      reason: `첫 후보가 현상을 설명한다면, 이 후보는 다른 관심 맥락에서 실제 선택을 돕는 결과물을 만드는 확장안입니다.`,
      userConfirmed: [major, ...interests],
      aiProposed: ["설명 결과를 의사결정 기준표나 작은 도구로 확장"],
      dataOptions: [
        { name: `${secondInterest} 관련 공개 사례·정책 자료`, status: "확인 필요" },
        { name: `${primaryInterest}와 연결된 선택 기준`, status: "확인 필요" },
      ],
      methodDetail: `${methods.join("·")}로 사례를 비교하고 의사결정 기준표 또는 작은 프로토타입 구성`,
      scope: `${period} 동안 사용자 상황 1개와 선택 기준 2~3개를 검토`,
      uncertainties: [
        "실제 사용자가 필요로 하는 선택 기준인지 추가로 확인해야 합니다.",
      ],
      firstAction: `${secondInterest} 맥락에서 ${primaryInterest} 관련 결정을 내려야 하는 상황 2개를 찾아 기준표 초안 만들기`,
      evidence: evidence.map((source) => ({ ...source })),
    },
  ];
}

export function recommend(c: Conditions, opts: RecommendOptions = {}): RecommendResult {
  const major = normalizeAcademicInput(c.major, 80);
  if (!major || !c.majorArea) return { kind: "empty" };
  const exclude = new Set(opts.excludeIds ?? []);

  // 1) 검수된 전공별 후보 → 2) 피하고 싶은 방식 충돌 제외 → 3) 이미 본 후보 제외
  let pool = TOPICS.filter(
    (t) =>
      t.majors.some((topicMajor) => majorNamesOverlap(topicMajor, major)) &&
      overlap(t.avoidTags, c.avoid).length === 0 &&
      !exclude.has(t.id),
  );

  // 검수된 전공별 후보가 없으면 사용자 입력만 사용한 범용 비교쌍으로 이어 간다.
  if (pool.length === 0) {
    const fallback = buildUniversalFallbackTopics(c);
    pool = fallback?.filter((topic) => !exclude.has(topic.id)) ?? [];
  }

  if (pool.length === 0) return { kind: "empty" };

  // 관심 → 방법 → 데이터 접근 → 기간 → 안정적 ID 순서의 명시적 근거 규칙
  const orderedPool = [...pool].sort((left, right) =>
    compareByEvidence(left, right, c));

  // 같은 주제의 난이도 차이보다, 문제 관점이 다른 주제 묶음을 우선합니다.
  const top = orderedPool[0];
  const contrasting = orderedPool.find((topic) =>
    topic.pairId !== top.pairId && topic.variant !== top.variant);
  const differentTopic = orderedPool.find((topic) => topic.pairId !== top.pairId);
  const sameTopicFallback = orderedPool.find((topic) =>
    topic.pairId === top.pairId && topic.id !== top.id);
  const other = contrasting ?? differentTopic ?? sameTopicFallback;
  const picked = other ? [top, other] : [top];

  if (picked.length < 2) return { kind: "insufficient", candidate: buildChecks(picked[0], c) };

  // 안전 축소형을 A, 차별 심화형을 B로 정렬
  const orderedPair = orderPairVariants(picked[0], picked[1]);
  return {
    kind: "ok",
    candidates: [buildChecks(orderedPair[0], c), buildChecks(orderedPair[1], c)],
  };
}
