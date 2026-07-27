// 전공진화소 2회차 MVP — 검수된 로컬 연구주제·교수 데이터
// USER_FLOW.md §7(조건), §8(추천 규칙), §9(카드 필드), §12.8(교수 공식 정보) 반영.
// 원칙: 실시간 AI 생성이 아니라 검수된 로컬 데이터 필터링. 0~100 점수·순위 없음.

export const MAJORS = ["수학", "식품자원경제학", "통계학", "컴퓨터공학", "경제학"] as const;
export type Major = (typeof MAJORS)[number];

export const INTEREST_TAGS = [
  "데이터 분석",
  "AI·머신러닝",
  "ESG·지속가능성",
  "소비자 행동",
  "식품 소비",
  "가격·시장",
  "정책 효과",
  "텍스트 분석",
] as const;

export const EXPERIENCE_LEVELS = ["경험 없음", "관련 수업 수강", "과제·프로젝트 경험"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const METHOD_TAGS = ["문헌조사", "설문·인터뷰", "데이터 분석", "실험·관찰", "아직 정하지 못함"] as const;

export const PERIODS = [
  { label: "4주", weeks: 4 },
  { label: "8주", weeks: 8 },
  { label: "한 학기", weeks: 16 },
] as const;
export type PeriodLabel = (typeof PERIODS)[number]["label"];

export const DATA_ACCESS = ["공개 데이터", "직접 수집 가능", "학교·연구실 확인 필요", "아직 모름"] as const;
export type DataAccess = (typeof DATA_ACCESS)[number];

export const AVOID_TAGS = ["설문·인터뷰", "실험·관찰", "코딩 많은 분석", "장기 데이터 수집"] as const;

// 조건 확인 상태 — 숫자 점수 대신 사용 (USER_FLOW §8, §9.5)
export type CheckStatus = "확인됨" | "조건부" | "확인 필요";

export type EvidenceSource = {
  id: string;
  title: string;
  type: string; // 공식 논문 / 공식 프로젝트 / 학과 연구 키워드 등
  verifiedAt: string;
};

export type ResearchTopic = {
  id: string;
  pairId: string; // 같은 pairId끼리 "안전 축소형 ↔ 차별 심화형" 비교쌍
  variant: "안전 축소형" | "차별 심화형";
  title: string; // 한 줄 주제
  majors: Major[]; // 지원 전공
  interests: string[]; // 관련 관심 분야
  methods: string[]; // 사용하는 방법·도구
  minWeeks: 4 | 8 | 16; // 시작에 필요한 최소 기간
  goodDataAccess: DataAccess[]; // 잘 맞는 데이터 접근 조건
  avoidTags: string[]; // 이 주제가 내포하는, 사용자가 피하고 싶을 수 있는 방식
  problem?: string; // AI 공동설계가 정리한 문제 정의
  question: string; // 핵심 연구질문
  reason: string; // 내 조건과 연결되는 이유
  userConfirmed?: string[]; // 사용자가 직접 확인한 맥락(원문 값만)
  aiProposed?: string[]; // AI가 제안한 해석·확장
  dataOptions: { name: string; status: CheckStatus }[]; // 가능한 데이터 후보
  methodDetail: string; // 제안 방법
  scope: string; // 예상 범위와 기간
  uncertainties: string[]; // 주요 불확실성 또는 확인할 사항
  firstAction: string; // 첫 30분 확인 행동
  evidence: EvidenceSource[]; // 근거 자료와 최근 확인일
  professorIds: string[]; // 연결 교수
};

export type Professor = {
  id: string;
  name: string;
  affiliation: string; // 대학·학과·연구실
  role: string; // 연결 역할 (연구 주제 / 방법론 / 학습·기회)
  fields: string[]; // 공식 연구 분야
  matchReasons: { reason: string; source: string }[]; // 연결 근거 + 출처
  relatedCourses: string[]; // 공식 강의
  verifiedAt: string; // 최근 확인일
  officialContactUrl: string; // 학교·학과·연구실 공식 문의 URL
  availabilityUnknown: true; // 실제 모집·면담 가능 여부는 항상 미확인
};

// 교수 공식 정보 고지 문구 (USER_FLOW §12.8)
export const PROFESSOR_DISCLAIMER =
  "현재 확인된 공식 정보만으로 특정 교수의 지도·모집·면담 가능 여부를 판단할 수 없습니다. 실제 가능 여부는 학교·학과·연구실 공식 안내에서 직접 확인해 주세요.";

export const PROFESSOR_DATA_NOTE =
  "대학 공식 프로필의 이름·소속·연구분야·논문 목록만 앱에 사용합니다. 이메일·전화는 저장하지 않고, 사진은 이용 허가 확인 전 표시하지 않습니다.";

// ─────────────────────────────────────────────────────────
// 교수 (프로토타입용 가상 데이터, 공식 링크는 예시 URL)
// ─────────────────────────────────────────────────────────
export const PROFESSORS: Professor[] = [
  {
    id: "prof-consumer",
    name: "김소비 교수님",
    affiliation: "가상대학교 식품자원경제학과 · 소비자행동 연구실",
    role: "연구 주제 연결",
    fields: ["소비자 행동", "식품경제", "지불의사 분석"],
    matchReasons: [
      { reason: "소비자 신뢰와 지불의사 연구가 선택한 연구주제의 핵심 질문과 연결돼요.", source: "공식 연구실 소개" },
      { reason: "친환경 표시·식품 소비 관련 공식 프로젝트를 진행한 이력이 있어요.", source: "공식 프로젝트 페이지" },
    ],
    relatedCourses: ["소비자경제 분석", "식품시장 조사"],
    verifiedAt: "2026.07.01",
    officialContactUrl: "https://university.example/dept/food-econ/faculty/consumer",
    availabilityUnknown: true,
  },
  {
    id: "prof-data",
    name: "이데이터 교수님",
    affiliation: "가상대학교 데이터사이언스학과 · 텍스트마이닝 연구실",
    role: "방법론 연결",
    fields: ["텍스트 분석", "머신러닝", "데이터 시각화"],
    matchReasons: [
      { reason: "텍스트 분석·회귀 분석 방법론이 이 주제의 분석 단계와 맞닿아 있어요.", source: "공식 교수 소개" },
      { reason: "제품 설명·리뷰 텍스트를 다룬 공개 프로젝트가 방법 참고가 돼요.", source: "공식 프로젝트 페이지" },
    ],
    relatedCourses: ["텍스트 데이터 분석", "머신러닝 입문"],
    verifiedAt: "2026.06.18",
    officialContactUrl: "https://university.example/dept/data-science/faculty/data",
    availabilityUnknown: true,
  },
  {
    id: "prof-policy",
    name: "박정책 교수님",
    affiliation: "가상대학교 식품자원경제학과 · ESG·공공정책 연구실",
    role: "학습·기회 연결",
    fields: ["ESG", "정책 효과", "공공데이터"],
    matchReasons: [
      { reason: "분석 결과를 정책·제도 함의로 확장하는 관점이 심화 방향과 연결돼요.", source: "공식 강의계획서" },
      { reason: "ESG 공시·표시 규제 관련 공개 자료를 다뤄 확인 질문을 준비하기 좋아요.", source: "공식 연구실 소개" },
    ],
    relatedCourses: ["ESG와 공공정책", "식품정책 세미나"],
    verifiedAt: "2026.04.02",
    officialContactUrl: "https://university.example/dept/food-econ/faculty/policy",
    availabilityUnknown: true,
  },
  {
    id: "prof-stats",
    name: "최통계 교수님",
    affiliation: "가상대학교 통계학과 · 시계열예측 연구실",
    role: "방법론 연결",
    fields: ["시계열", "예측 모델", "통계 추론"],
    matchReasons: [
      { reason: "시계열·수급 데이터 분석 방법이 가격 변동 주제의 핵심 방법과 맞아요.", source: "공식 교수 소개" },
      { reason: "공공 가격·기상 데이터를 활용한 공개 프로젝트가 참고가 돼요.", source: "공식 프로젝트 페이지" },
    ],
    relatedCourses: ["시계열 분석", "예측 방법론"],
    verifiedAt: "2026.06.24",
    officialContactUrl: "https://university.example/dept/statistics/faculty/stats",
    availabilityUnknown: true,
  },
];

// ─────────────────────────────────────────────────────────
// 검수된 연구주제 (연구형만, 안전 축소형 ↔ 차별 심화형 3쌍)
// ─────────────────────────────────────────────────────────
export const TOPICS: ResearchTopic[] = [
  // 쌍 1 — 친환경 표시 × 가격 (페르소나 핵심)
  {
    id: "topic-greenwash-safe",
    pairId: "greenwash",
    variant: "안전 축소형",
    title: "온라인 식품 친환경 표시 문구와 가격 프리미엄의 관계 탐색",
    majors: ["수학", "식품자원경제학", "컴퓨터공학"],
    interests: ["데이터 분석", "ESG·지속가능성", "식품 소비", "가격·시장"],
    methods: ["데이터 분석", "문헌조사"],
    minWeeks: 4,
    goodDataAccess: ["공개 데이터"],
    avoidTags: [],
    question: "친환경 표시 문구의 표현 특성은 제품 가격 프리미엄과 어떤 관계가 있는가?",
    reason: "공개된 제품 설명·가격 데이터로 시작할 수 있고, 데이터 분석 경험을 바로 활용할 수 있어요.",
    dataOptions: [
      { name: "온라인 제품 설명 텍스트·가격", status: "확인됨" },
      { name: "브랜드·용량 등 통제 변수", status: "조건부" },
    ],
    methodDetail: "표현 유형 빈도 분석과 탐색적 회귀 분석",
    scope: "제품 20개 표본으로 변수 정의와 수집 가능성 검토 (4주 기준)",
    uncertainties: [
      "가격 프리미엄의 통제 변수 정의는 교수에게 확인이 필요해요.",
      "인과관계나 그린워싱 여부는 단정하지 않아요.",
    ],
    firstAction: "제품 20개의 친환경 표시 문구와 가격을 표본 수집하고 표현 유형을 임시 분류하기",
    evidence: [
      { id: "src-gw-1", title: "친환경 표시와 소비자 신뢰 연구", type: "공식 논문", verifiedAt: "2026.06" },
      { id: "src-gw-2", title: "식품 라벨 표현 분류 프로젝트", type: "공식 프로젝트", verifiedAt: "2026.06" },
    ],
    professorIds: ["prof-consumer", "prof-data"],
  },
  {
    id: "topic-greenwash-deep",
    pairId: "greenwash",
    variant: "차별 심화형",
    title: "친환경 표시 문구의 과장 가능성을 알리는 텍스트 특성 탐색",
    majors: ["수학", "식품자원경제학", "컴퓨터공학"],
    interests: ["텍스트 분석", "ESG·지속가능성", "소비자 행동"],
    methods: ["데이터 분석", "문헌조사"],
    minWeeks: 8,
    goodDataAccess: ["공개 데이터", "학교·연구실 확인 필요"],
    avoidTags: [],
    question: "어떤 텍스트 특성이 실제 근거가 약한 친환경 표현과 연관되는가?",
    reason: "같은 데이터에서 출발하지만 텍스트 특성 정의와 검증이 더해져 차별성이 있어요.",
    dataOptions: [
      { name: "제품 설명 텍스트", status: "확인됨" },
      { name: "표현의 근거 여부 판정 기준", status: "확인 필요" },
    ],
    methodDetail: "텍스트 특성 추출과 회귀·분류, 과장 라벨 기준의 전문가 확인",
    scope: "표현 기준 정의와 소규모 검증까지 (8주 이상 권장)",
    uncertainties: [
      "과장·근거 부족의 판정 기준은 교수·전문가 확인이 필요해요.",
      "라벨링 편향을 줄이는 방법을 함께 정해야 해요.",
    ],
    firstAction: "친환경 표현 30개를 모아 '근거 있음/불확실'로 임시 라벨링하고 애매한 사례 정리하기",
    evidence: [
      { id: "src-gw-3", title: "그린워싱 텍스트 신호 연구", type: "공식 논문", verifiedAt: "2026.05" },
      { id: "src-gw-2", title: "식품 라벨 표현 분류 프로젝트", type: "공식 프로젝트", verifiedAt: "2026.06" },
    ],
    professorIds: ["prof-data", "prof-policy"],
  },

  // 쌍 2 — 농식품 가격 변동
  {
    id: "topic-price-safe",
    pairId: "price",
    variant: "안전 축소형",
    title: "농식품 가격 변동과 날씨·수급 데이터의 시계열 탐색",
    majors: ["수학", "통계학", "식품자원경제학"],
    interests: ["데이터 분석", "가격·시장"],
    methods: ["데이터 분석"],
    minWeeks: 8,
    goodDataAccess: ["공개 데이터"],
    avoidTags: [],
    question: "날씨·수급 변화는 특정 농식품 가격 변동과 어떤 시계열 관계를 보이는가?",
    reason: "공공 가격·기상 데이터가 공개돼 있고 시계열 분석에 수리·데이터 역량을 쓸 수 있어요.",
    dataOptions: [
      { name: "공공 가격·기상·수입량 데이터", status: "확인됨" },
      { name: "품목·기간 선택 기준", status: "조건부" },
    ],
    methodDetail: "시계열 시각화와 기초 상관·회귀 분석",
    scope: "품목 1~2개, 최근 구간 위주로 관계 탐색 (8주 기준)",
    uncertainties: [
      "대상 품목과 통제할 계절성 정의는 확인이 필요해요.",
      "상관과 인과를 구분해 해석해야 해요.",
    ],
    firstAction: "공공데이터 포털에서 품목 1개의 가격·기상 시계열을 내려받아 그래프로 그려 보기",
    evidence: [
      { id: "src-pr-1", title: "농식품 가격 변동 요인 분석", type: "공식 논문", verifiedAt: "2026.05" },
      { id: "src-pr-2", title: "공공 가격 데이터 대시보드", type: "공식 프로젝트", verifiedAt: "2026.06" },
    ],
    professorIds: ["prof-stats", "prof-data"],
  },
  {
    id: "topic-price-deep",
    pairId: "price",
    variant: "차별 심화형",
    title: "농식품 가격 급등 조기 신호 지표 설계",
    majors: ["수학", "통계학", "식품자원경제학"],
    interests: ["데이터 분석", "정책 효과", "가격·시장"],
    methods: ["데이터 분석"],
    minWeeks: 16,
    goodDataAccess: ["공개 데이터", "학교·연구실 확인 필요"],
    avoidTags: ["장기 데이터 수집"],
    question: "여러 공공 지표를 결합해 가격 급등을 사전에 알리는 신호를 만들 수 있는가?",
    reason: "같은 데이터를 쓰되 지표 설계와 검증이 더해져 정책 함의로 확장돼요.",
    dataOptions: [
      { name: "가격·수급·수입·환율 등 다중 공공 지표", status: "조건부" },
      { name: "급등 기준선과 평가 방식", status: "확인 필요" },
    ],
    methodDetail: "지표 결합과 임계값 설계, 과거 사례로 신호 성능 점검",
    scope: "지표 정의와 소규모 백테스트까지 (한 학기 권장)",
    uncertainties: [
      "급등의 정의와 평가 기준은 교수 확인이 필요해요.",
      "데이터 지연·결측 처리 방식을 정해야 해요.",
    ],
    firstAction: "과거 급등 사례 3건을 골라 어떤 공공 지표가 먼저 움직였는지 표로 정리하기",
    evidence: [
      { id: "src-pr-3", title: "가격 조기경보 지표 연구", type: "공식 논문", verifiedAt: "2026.04" },
      { id: "src-pr-2", title: "공공 가격 데이터 대시보드", type: "공식 프로젝트", verifiedAt: "2026.06" },
    ],
    professorIds: ["prof-stats", "prof-policy"],
  },

  // 쌍 3 — 소비자 지불의사 (설문 기반)
  {
    id: "topic-wtp-safe",
    pairId: "wtp",
    variant: "안전 축소형",
    title: "친환경 식품에 대한 소비자 지불의사 설문 탐색",
    majors: ["식품자원경제학", "경제학"],
    interests: ["소비자 행동", "ESG·지속가능성", "식품 소비"],
    methods: ["설문·인터뷰", "데이터 분석"],
    minWeeks: 8,
    goodDataAccess: ["직접 수집 가능"],
    avoidTags: ["설문·인터뷰"],
    question: "소비자는 친환경 속성에 얼마나, 어떤 조건에서 더 지불하려 하는가?",
    reason: "소규모 설문을 직접 설계·수집해 지불의사를 탐색할 수 있어요.",
    dataOptions: [
      { name: "소규모 온라인 설문 응답", status: "조건부" },
      { name: "표본·문항 설계", status: "확인 필요" },
    ],
    methodDetail: "설문 설계와 기술통계·회귀 분석",
    scope: "30~50명 탐색 설문과 기초 분석 (8주 기준)",
    uncertainties: [
      "표본 편향과 문항 타당성은 확인이 필요해요.",
      "설문 참여 동의·개인정보 처리 문구를 준비해야 해요.",
    ],
    firstAction: "친환경 속성 3개를 정해 설문 초안 5문항을 작성하고 지인 3명에게 사전 점검받기",
    evidence: [
      { id: "src-wtp-1", title: "친환경 속성 지불의사 연구", type: "공식 논문", verifiedAt: "2026.06" },
    ],
    professorIds: ["prof-consumer"],
  },
  {
    id: "topic-wtp-deep",
    pairId: "wtp",
    variant: "차별 심화형",
    title: "선택실험으로 친환경 속성별 가치 추정",
    majors: ["식품자원경제학", "경제학"],
    interests: ["소비자 행동", "ESG·지속가능성"],
    methods: ["설문·인터뷰", "데이터 분석"],
    minWeeks: 16,
    goodDataAccess: ["직접 수집 가능", "학교·연구실 확인 필요"],
    avoidTags: ["설문·인터뷰"],
    question: "친환경 속성의 상대적 가치를 선택실험으로 어떻게 추정할 수 있는가?",
    reason: "설문에서 나아가 선택실험 설계와 모형 추정이 더해져 방법 난도가 높아요.",
    dataOptions: [
      { name: "선택실험 설계 응답", status: "확인 필요" },
      { name: "속성·수준 설계와 실험 조합", status: "확인 필요" },
    ],
    methodDetail: "선택실험 설계와 이산선택 모형 추정",
    scope: "속성·수준 설계와 소규모 파일럿까지 (한 학기 권장)",
    uncertainties: [
      "실험 설계와 모형 추정은 선수 학습·교수 확인이 필요해요.",
      "표본 확보와 응답 품질 관리가 핵심 위험이에요.",
    ],
    firstAction: "친환경 속성 3개와 수준 2~3개를 정해 선택 카드 예시 한 세트를 만들어 보기",
    evidence: [
      { id: "src-wtp-2", title: "선택실험 기반 속성 가치 연구", type: "공식 논문", verifiedAt: "2026.05" },
    ],
    professorIds: ["prof-consumer", "prof-policy"],
  },
];

export function findProfessor(id: string): Professor | undefined {
  return PROFESSORS.find((p) => p.id === id);
}

export function periodWeeks(label: PeriodLabel): 4 | 8 | 16 {
  return PERIODS.find((p) => p.label === label)?.weeks ?? 4;
}
