export type Goal =
  | "explore-major"
  | "find-topic"
  | "find-professor"
  | "understand-paper";

export type Difficulty = "starter" | "project" | "advanced" | "research";
export type ComparisonCriterion =
  | "personalFit"
  | "majorFit"
  | "dataAccess"
  | "feasibility"
  | "careerValue"
  | "novelty";

export type StudentProfile = {
  name: string;
  school: string;
  major: string;
  minor: string;
  grade: string;
  interests: string[];
  careers: string[];
  skills: string[];
  experience: string;
  noExperience: boolean;
  availableWeeks: 2 | 4 | 8;
  outputGoal: string;
  difficulty: Difficulty;
};

export type Trend = {
  id: string;
  title: string;
  summary: string;
  data: string[];
  methods: string[];
  fitReason: string;
  sourceCount: number;
  verifiedAt: string;
  connection: "높음" | "보통";
};

export type Idea = {
  id: string;
  type: "연구형" | "프로젝트형" | "서비스형";
  title: string;
  subtitle: string;
  problem: string;
  question: string;
  data: string[];
  methods: string[];
  weeks: number;
  scores: Record<ComparisonCriterion, number>;
};

export type Evidence = {
  title: string;
  body: string;
  source: string;
};

export type Professor = {
  id: string;
  name: string;
  affiliation: string;
  role: "연구 주제" | "방법론" | "프로젝트·수업";
  matchScore: number;
  confidence: "high" | "medium";
  keywords: string[];
  reason: string;
  verifiedAt: string;
  portrait: string;
  evidences: Evidence[];
  courses: string[];
  checkPoint: string;
  sources: { type: string; title: string; verifiedAt: string }[];
};

export type EditablePassport = {
  problem: string;
  question: string;
  data: string;
  methods: string;
  output: string;
  risks: string;
  professorQuestions: string;
};

export const assetPath = "/major-evolution-assets/03_TRANSPARENT_PNG";
export const cropPath = "/major-evolution-assets/02_EXACT_CROPS";

export const defaultProfile: StudentProfile = {
  name: "김학생",
  school: "가상대학교",
  major: "수학",
  minor: "식품자원경제",
  grade: "3학년",
  interests: ["데이터 분석", "AI", "ESG", "식품 소비"],
  careers: ["데이터 분석가", "AI 서비스 기획자"],
  skills: ["Python", "머신러닝", "설문분석", "수학적 모델링"],
  experience: "소비자 설문 데이터를 활용해 구매의도를 분석한 팀 프로젝트",
  noExperience: false,
  availableWeeks: 4,
  outputGoal: "포트폴리오 프로젝트",
  difficulty: "project",
};

export const emptyProfile: StudentProfile = {
  ...defaultProfile,
  school: "",
  major: "",
  minor: "",
  grade: "3학년",
  interests: [],
  careers: [],
  skills: [],
  experience: "",
  noExperience: false,
};

export const goalOptions: { value: Goal; title: string; description: string }[] = [
  {
    value: "explore-major",
    title: "내 전공에서 할 수 있는 걸 찾고 싶어요",
    description: "전공의 확장 방향과 앞으로 준비할 기술을 살펴봐요.",
  },
  {
    value: "find-topic",
    title: "프로젝트·논문 주제가 필요해요",
    description: "전공과 강점으로 4주 안에 시작할 주제를 만들어요.",
  },
  {
    value: "find-professor",
    title: "나와 맞는 교수님을 찾고 싶어요",
    description: "아이디어와 공개 연구 정보가 연결되는 지점을 찾아봐요.",
  },
  {
    value: "understand-paper",
    title: "어려운 논문을 이해하고 싶어요",
    description: "초록이나 본문을 질문·방법·결과·한계 순서로 풀어드려요.",
  },
];

export const interestOptions = [
  "데이터 분석",
  "AI",
  "ESG",
  "식품 소비",
  "금융",
  "정책",
  "서비스 기획",
  "환경",
];

export const careerOptions = [
  "데이터 분석가",
  "AI 서비스 기획자",
  "연구자·대학원",
  "공모전·창업",
  "아직 탐색 중",
];

export const skillOptions = [
  "Python",
  "통계분석",
  "머신러닝",
  "설문분석",
  "수학적 모델링",
  "경제학적 해석",
  "발표",
  "서비스 기획",
];

export const dnaResult = {
  axes: ["수리 모델링형", "소비자·정책 해석형", "AI 서비스 기획형"],
  summary:
    "정량 모델의 결과를 경제적 의미와 서비스 제안으로 연결하는 주제가 잘 맞아요.",
  strengths: ["정량 모델", "경제적 해석", "문제 구조화"],
  preparation: ["텍스트 데이터 전처리", "조사 설계", "모델 평가 기준"],
  radar: [85, 78, 82, 73, 65, 68],
  radarLabels: ["모델링", "데이터", "AI 기획", "경제 해석", "조사 설계", "실행력"],
};

export const trends: Trend[] = [
  {
    id: "greenwashing",
    title: "ESG·그린워싱 탐지",
    summary: "친환경 표현을 텍스트와 소비자 반응으로 분석해요.",
    data: ["제품 설명", "가격", "설문"],
    methods: ["텍스트 분석", "회귀 분석"],
    fitReason: "ESG 관심과 설문분석 경험을 함께 사용할 수 있어요.",
    sourceCount: 3,
    verifiedAt: "2026.06",
    connection: "높음",
  },
  {
    id: "wtp",
    title: "소비자 지불의사 분석",
    summary: "제품 속성과 가격이 선택에 미치는 영향을 분석해요.",
    data: ["설문", "선택 실험"],
    methods: ["회귀", "군집 분석"],
    fitReason: "경제적 해석과 소비자 데이터 관심이 연결돼요.",
    sourceCount: 3,
    verifiedAt: "2026.06",
    connection: "높음",
  },
  {
    id: "price-forecast",
    title: "농식품 가격예측",
    summary: "날씨와 수급 데이터를 연결해 가격 변화를 살펴봐요.",
    data: ["공공 가격", "날씨"],
    methods: ["시계열", "시각화"],
    fitReason: "수리 모델링과 데이터 분석 강점을 활용할 수 있어요.",
    sourceCount: 4,
    verifiedAt: "2026.05",
    connection: "보통",
  },
  {
    id: "food-security",
    title: "식량안보 위험 분석",
    summary: "생산과 수입 의존도를 바탕으로 위험 신호를 정리해요.",
    data: ["생산량", "수입량"],
    methods: ["지표 설계", "시나리오"],
    fitReason: "정책 해석과 모델링을 함께 쓸 수 있어요.",
    sourceCount: 2,
    verifiedAt: "2026.04",
    connection: "보통",
  },
  {
    id: "foodtech",
    title: "푸드테크 성장성 분석",
    summary: "기업과 정책 정보를 구조화해 성장 조건을 살펴봐요.",
    data: ["기업 공개정보", "정책사업"],
    methods: ["텍스트 분석", "규칙 점수"],
    fitReason: "AI 서비스 기획 목표와 잘 연결돼요.",
    sourceCount: 3,
    verifiedAt: "2026.06",
    connection: "보통",
  },
];

export const ideaSets: Idea[][] = [
  [
    {
      id: "greenwashing-detective",
      type: "연구형",
      title: "그린워싱 탐정 AI",
      subtitle: "친환경 표시 문구가 소비자 신뢰와 지불의사에 미치는 영향",
      problem: "소비자가 친환경 표현의 신뢰성을 판단하기 어렵다.",
      question: "표현 특성이 신뢰도와 지불의사에 어떤 영향을 미치는가?",
      data: ["제품 설명", "가격", "30~50명 설문"],
      methods: ["키워드 사전", "회귀 분석", "소비자 군집"],
      weeks: 4,
      scores: { personalFit: 88, majorFit: 91, dataAccess: 72, feasibility: 80, careerValue: 89, novelty: 84 },
    },
    {
      id: "food-price-alert",
      type: "프로젝트형",
      title: "농식품 가격 급등 조기경보",
      subtitle: "공공 통계와 날씨를 결합한 가격 신호 대시보드",
      problem: "가격 급등 신호를 학생과 소비자가 미리 이해하기 어렵다.",
      question: "어떤 수급·날씨 조합이 가격 급등에 앞서 나타나는가?",
      data: ["공공 가격", "날씨", "수입량"],
      methods: ["시계열", "대시보드"],
      weeks: 6,
      scores: { personalFit: 82, majorFit: 86, dataAccess: 86, feasibility: 70, careerValue: 84, novelty: 78 },
    },
    {
      id: "foodtech-diagnosis",
      type: "서비스형",
      title: "푸드테크 성장 가능성 진단 AI",
      subtitle: "시장성·ESG·정책금융 적합성을 구조화하는 서비스",
      problem: "초기 기업의 성장 조건을 한 번에 비교하기 어렵다.",
      question: "공개 정보만으로 어떤 성장 조건을 설명할 수 있는가?",
      data: ["기업 공개정보", "정책사업"],
      methods: ["규칙 기반 점수", "텍스트 분석"],
      weeks: 4,
      scores: { personalFit: 79, majorFit: 76, dataAccess: 64, feasibility: 74, careerValue: 91, novelty: 82 },
    },
  ],
  [
    {
      id: "eco-label-map",
      type: "프로젝트형",
      title: "친환경 표시 신뢰 지도",
      subtitle: "상품군별 친환경 표현과 근거 공개 수준을 시각화하는 지도",
      problem: "비슷한 친환경 문구도 근거 공개 수준이 서로 다르다.",
      question: "표현 유형과 근거 공개 수준은 상품군별로 어떻게 다른가?",
      data: ["제품 상세페이지", "인증 정보"],
      methods: ["분류 기준", "데이터 시각화"],
      weeks: 4,
      scores: { personalFit: 86, majorFit: 83, dataAccess: 88, feasibility: 86, careerValue: 84, novelty: 77 },
    },
    {
      id: "survey-coach",
      type: "서비스형",
      title: "소비자 설문 설계 코치",
      subtitle: "연구 질문을 측정 가능한 문항과 분석 계획으로 바꾸는 도구",
      problem: "처음 설문을 만드는 학생은 질문과 문항을 연결하기 어렵다.",
      question: "좋은 연구 질문을 문항과 변수로 어떻게 변환할 수 있는가?",
      data: ["설문 템플릿", "문항 기준"],
      methods: ["규칙 엔진", "품질 체크"],
      weeks: 4,
      scores: { personalFit: 84, majorFit: 79, dataAccess: 90, feasibility: 88, careerValue: 86, novelty: 74 },
    },
    {
      id: "policy-food-lab",
      type: "연구형",
      title: "식품 정책 반응 실험",
      subtitle: "정책 메시지 유형에 따른 소비자 선택 변화를 탐색하는 연구",
      problem: "정책 메시지가 실제 선택에 미치는 영향을 설명하기 어렵다.",
      question: "정보 제공 방식에 따라 소비자의 선택 의향이 달라지는가?",
      data: ["온라인 실험", "소규모 설문"],
      methods: ["A/B 설계", "회귀 분석"],
      weeks: 4,
      scores: { personalFit: 90, majorFit: 92, dataAccess: 70, feasibility: 76, careerValue: 87, novelty: 85 },
    },
  ],
];

export const allIdeas = ideaSets.flat();

export const professors: Professor[] = [
  {
    id: "prof-consumer",
    name: "김소비 교수님",
    affiliation: "식품경제·소비자 행동 연구실",
    role: "연구 주제",
    matchScore: 89,
    confidence: "high",
    keywords: ["소비자 행동", "지불의사금액", "설문 분석"],
    reason: "소비자 신뢰와 지불의사 연구가 아이디어의 핵심 질문과 연결돼요.",
    verifiedAt: "2026.07.01",
    portrait: `${assetPath}/08_professor_portrait_01_alpha.png`,
    evidences: [
      { title: "연구 질문 연결", body: "친환경 표현과 소비자 신뢰의 관계를 연구 질문으로 다듬는 데 연결돼요.", source: "공식 교수 소개" },
      { title: "데이터·방법 연결", body: "소비자 설문과 지불의사금액 분석 방법을 함께 확인할 수 있어요.", source: "공식 연구실" },
      { title: "수업·프로젝트 기회", body: "소비자경제 분석 수업의 프로젝트 방식과 현재 결과물이 연결돼요.", source: "공식 강의계획서" },
    ],
    courses: ["소비자경제 분석", "식품시장 조사"],
    checkPoint: "현재 연구실 학생 모집 여부는 공식 페이지에서 확인되지 않았어요.",
    sources: [
      { type: "공식 교수 소개", title: "연구 분야 및 주요 논문", verifiedAt: "2026.07.01" },
      { type: "공식 연구실", title: "소비자 행동 연구 프로젝트", verifiedAt: "2026.07.01" },
      { type: "공식 강의계획서", title: "소비자경제 분석", verifiedAt: "2026.06.24" },
    ],
  },
  {
    id: "prof-data",
    name: "이데이터 교수님",
    affiliation: "데이터사이언스 연구실",
    role: "방법론",
    matchScore: 86,
    confidence: "high",
    keywords: ["텍스트 분석", "머신러닝", "데이터 시각화"],
    reason: "텍스트 분석과 모델 평가 방법을 보완하는 데 적합해요.",
    verifiedAt: "2026.06.18",
    portrait: `${assetPath}/08_professor_portrait_02_alpha.png`,
    evidences: [
      { title: "방법론 연결", body: "텍스트 분류와 기준 모델 설계를 점검하는 데 연결돼요.", source: "공식 교수 소개" },
      { title: "평가 기준 연결", body: "모델 성능과 오류를 함께 설명하는 프로젝트가 확인돼요.", source: "공식 연구실" },
      { title: "시각화 연결", body: "결과를 대시보드로 전달하는 수업 프로젝트와 연결돼요.", source: "공식 강의계획서" },
    ],
    courses: ["응용 머신러닝", "텍스트 데이터 분석"],
    checkPoint: "최근 프로젝트의 학부생 참여 방식은 직접 확인이 필요해요.",
    sources: [
      { type: "공식 교수 소개", title: "연구 분야 및 프로젝트", verifiedAt: "2026.06.18" },
      { type: "공식 연구실", title: "텍스트 데이터 연구", verifiedAt: "2026.06.18" },
      { type: "공식 강의계획서", title: "응용 머신러닝", verifiedAt: "2026.06.10" },
    ],
  },
  {
    id: "prof-policy",
    name: "박정책 교수님",
    affiliation: "ESG·공공정책 연구실",
    role: "프로젝트·수업",
    matchScore: 81,
    confidence: "medium",
    keywords: ["ESG", "정책 효과", "프로젝트"],
    reason: "분석 결과를 정책 제안과 프로젝트로 확장하는 데 연결돼요.",
    verifiedAt: "2026.04.02",
    portrait: `${assetPath}/08_professor_portrait_03_alpha.png`,
    evidences: [
      { title: "정책 맥락 연결", body: "친환경 표시와 정책 효과를 함께 해석할 수 있어요.", source: "공식 교수 소개" },
      { title: "프로젝트 연결", body: "공개 데이터를 활용한 정책 프로젝트가 확인돼요.", source: "공식 프로젝트" },
      { title: "결과물 연결", body: "분석 결과를 정책 제안서로 확장하는 데 연결돼요.", source: "공식 강의계획서" },
    ],
    courses: ["ESG 정책 분석", "공공데이터 프로젝트"],
    checkPoint: "공식 정보의 최근 업데이트 시점이 오래되어 최신 확인이 필요해요.",
    sources: [
      { type: "공식 교수 소개", title: "연구 분야", verifiedAt: "2026.04.02" },
      { type: "공식 프로젝트", title: "ESG 정책 연구", verifiedAt: "2026.04.02" },
    ],
  },
];

export const defaultPassport: EditablePassport = {
  problem: "소비자가 친환경 표시 문구의 신뢰성을 판단하기 어렵다.",
  question: "표현 특성이 소비자 신뢰도와 지불의사에 어떤 영향을 미치는가?",
  data: "제품 설명 텍스트, 가격 정보, 30~50명 탐색 설문",
  methods: "입문: 키워드 빈도 · 표준: 회귀분석 · 심화: 텍스트 분류",
  output: "그린워싱 위험도 기준, 소비자 반응 시각화, 5페이지 보고서",
  risks: "라벨 정의, 설문 표본, 인과관계 과장",
  professorQuestions: "연구 정의의 타당성, 설문 설계, 4주 범위의 적절성",
};

export const defaultQuestions = [
  "그린워싱을 분석할 때 타당한 정의와 기준은 무엇인가요?",
  "소비자 신뢰와 지불의사를 함께 측정하려면 어떤 조사 설계가 적절할까요?",
  "4주 프로젝트라면 텍스트 분석과 설문 중 어디에 범위를 집중하는 것이 좋을까요?",
];

export const defaultEmailDraft = `안녕하세요 교수님, 수학과 식품자원경제를 공부하고 있는 김학생입니다.

친환경 표시 문구가 소비자 신뢰와 지불의사에 미치는 영향을 4주 프로젝트로 탐색하고 있습니다. 연구 질문과 설문 범위가 적절한지 짧게 조언을 구하고 싶어 연락드렸습니다.

가능하시다면 20분 정도 면담을 요청드려도 될까요? 감사합니다.`;

export const comparisonLabels: Record<ComparisonCriterion, string> = {
  personalFit: "개인 적합",
  majorFit: "전공 연결",
  dataAccess: "데이터 확보",
  feasibility: "4주 실행",
  careerValue: "포트폴리오",
  novelty: "차별성",
};

export const difficultyCopy: Record<Difficulty, { label: string; spice: string; description: string }> = {
  starter: { label: "입문", spice: "순한맛", description: "2주 안에 공개 데이터와 기술통계로 탐색 결과를 만들어요." },
  project: { label: "프로젝트", spice: "보통맛", description: "4주 안에 제품 100개 이하와 소규모 설문, 기준 모델 1개를 완성해요." },
  advanced: { label: "심화", spice: "매운맛", description: "6~8주 동안 설문 설계와 모델 비교를 포함한 보고서를 완성해요." },
  research: { label: "도전", spice: "아주 매운맛", description: "8주 이상 재현 가능한 분석과 선행연구 비교까지 확장해요." },
};
