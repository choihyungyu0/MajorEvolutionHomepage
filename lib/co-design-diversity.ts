export type CoDesignDiversitySignals = {
  title: string;
  problem: string;
  question: string;
  dataOptions: Array<{ name: string }>;
  methodDetail: string;
};

const GENERIC_TOKENS = new Set([
  "기반", "활용", "개발", "분석", "연구", "프로젝트", "공개", "데이터",
  "지표", "보고서", "대한", "통한", "위한", "어떻게", "무엇인가", "비교",
]);

const DATA_FAMILY_PATTERNS = {
  numeric: /시세|가격|거래량|수익률|변동성|수치|통계|시계열|센서|측정/u,
  text: /공시|설명서|문서|텍스트|보고서|뉴스|문구|논문|게시글/u,
  people: /설문|인터뷰|응답|사용자 기록|관찰/u,
  cases: /사례|정책|프로젝트 기록|의사결정 기록|강의계획/u,
} as const;

const METHOD_FAMILY_PATTERNS = {
  statistics: /회귀|상관|군집|시계열|통계|지표 계산|예측 모형|패널/u,
  text: /텍스트|문서 분류|키워드|토픽|자연어|NLP|임베딩/u,
  design: /프로토타입|도구 설계|대시보드|기준표|사용성|시나리오/u,
  qualitative: /문헌|사례 비교|인터뷰|설문|내용 분석/u,
} as const;

function tokens(values: string[]) {
  return new Set(
    values
      .join(" ")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .split(/[^0-9a-z가-힣]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !GENERIC_TOKENS.has(token)),
  );
}

function similarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / new Set([...left, ...right]).size;
}

function families(
  value: string,
  patterns: Record<string, RegExp>,
) {
  return new Set(
    Object.entries(patterns)
      .filter(([, pattern]) => pattern.test(value))
      .map(([family]) => family),
  );
}

function axisIsDifferent(
  leftFamilies: Set<string>,
  rightFamilies: Set<string>,
  tokenSimilarity: number,
) {
  if (leftFamilies.size === 0 || rightFamilies.size === 0) return tokenSimilarity < 0.5;
  return [...leftFamilies].every((family) => !rightFamilies.has(family));
}

/**
 * 범위·기간만 다른 사실상 같은 후보를 막습니다.
 * 제목, 문제·질문, 주요 데이터, 방법 중 세 축 이상이 달라야 서로 다른 방향입니다.
 */
export function coDesignCandidatesAreDistinct(
  left: CoDesignDiversitySignals,
  right: CoDesignDiversitySignals,
) {
  const titleSimilarity = similarity(tokens([left.title]), tokens([right.title]));
  const questionSimilarity = similarity(
    tokens([left.problem, left.question]),
    tokens([right.problem, right.question]),
  );
  const dataSimilarity = similarity(
    tokens(left.dataOptions.map((option) => option.name)),
    tokens(right.dataOptions.map((option) => option.name)),
  );
  const methodSimilarity = similarity(
    tokens([left.methodDetail]),
    tokens([right.methodDetail]),
  );
  const leftDataFamilies = families(left.dataOptions[0]?.name ?? "", DATA_FAMILY_PATTERNS);
  const rightDataFamilies = families(right.dataOptions[0]?.name ?? "", DATA_FAMILY_PATTERNS);
  const leftMethodFamilies = families(left.methodDetail, METHOD_FAMILY_PATTERNS);
  const rightMethodFamilies = families(right.methodDetail, METHOD_FAMILY_PATTERNS);
  const dataAxisDifferent = axisIsDifferent(leftDataFamilies, rightDataFamilies, dataSimilarity);
  const methodAxisDifferent = axisIsDifferent(leftMethodFamilies, rightMethodFamilies, methodSimilarity);
  const sameCoreIdea = titleSimilarity >= 0.48 && questionSimilarity >= 0.33;
  return (
    !sameCoreIdea
    && dataAxisDifferent
    && methodAxisDifferent
    && (titleSimilarity < 0.42 || questionSimilarity < 0.45)
  );
}
