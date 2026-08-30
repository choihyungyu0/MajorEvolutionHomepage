export type ServiceSection =
  | "/home"
  | "/professors"
  | "/quest"
  | "/research"
  | "/project-professors"
  | "/portfolio"
  | "/profile";

export type ServiceJourneyKey = "professor" | "project";

export type ServiceJourney = {
  key: ServiceJourneyKey;
  label: string;
  step: 1 | 2;
};

export type ServiceHelpStep = {
  title: string;
  description: string;
};

export type ServiceHelpArea = {
  title: string;
  description: string;
  selector: string;
};

export type ServiceHelpCopy = {
  section: ServiceSection;
  label: string;
  title: string;
  purpose: string;
  now: string;
  next: string;
  steps: readonly ServiceHelpStep[];
  areas: readonly ServiceHelpArea[];
};

type SearchParamsLike = {
  get: (name: string) => string | null;
};

export const SERVICE_NAV_GUIDE_STORAGE_KEY = "major-evolution-service-nav-guide-v3";
export const SERVICE_MOBILE_NAV_GUIDE_STORAGE_KEY = "major-evolution-service-nav-guide-mobile-v4";
export const SERVICE_DESKTOP_NAV_GUIDE_STORAGE_KEY = "major-evolution-service-nav-guide-desktop-v2";
export const SERVICE_NAV_GUIDE_EVENT = "major-evolution:open-navigation-guide";
export const SERVICE_HOME_ONBOARDING_EVENT = "major-evolution:open-home-onboarding";
export const SERVICE_NAV_GUIDE_QUERY_PARAM = "guide";
export const SERVICE_NAV_GUIDE_QUERY_VALUE = "tabs";
export const SERVICE_HOME_WITH_NAV_GUIDE = "/home?guide=tabs";
export const SERVICE_HELP_AUTO_OPEN_STORAGE_PREFIX = "major-evolution-service-help-seen-v2";

export function projectExecutionTabHref({
  hasHydrated,
  selectedTopicId,
  projectProfessorMatchTopicId,
  selectedProjectProfessorId,
  availableProfessorIds,
}: {
  hasHydrated: boolean;
  selectedTopicId: string | null;
  projectProfessorMatchTopicId: string | null;
  selectedProjectProfessorId: string | null;
  availableProfessorIds: readonly string[];
}): "/project-professors" | "/project-execution" {
  const selectedProfessorIsAvailable = Boolean(
    selectedProjectProfessorId
    && availableProfessorIds.includes(selectedProjectProfessorId),
  );
  return hasHydrated
    && Boolean(selectedTopicId)
    && projectProfessorMatchTopicId === selectedTopicId
    && selectedProfessorIsAvailable
    ? "/project-execution"
    : "/project-professors";
}

export function resolveServiceHelpAutoSection(
  pathname: string,
  searchParams?: SearchParamsLike,
): Exclude<ServiceSection, "/profile"> | null {
  if (pathname === "/home") {
    if (searchParams?.get("professor") === "quick") return "/professors";
    if (searchParams?.get("project") === "quick") return "/research";
    return "/home";
  }
  if (pathname === "/professors") return "/professors";
  if (pathname === "/quest") return "/quest";
  if (pathname === "/research") return "/research";
  if (pathname === "/project-professors") return "/project-professors";
  if (pathname === "/project-execution" || pathname === "/project-meeting") return "/project-professors";
  if (pathname === "/portfolio") return "/portfolio";
  return null;
}

export function getServiceHelpAutoOpenStorageKey(
  pathname: string,
  searchParams?: SearchParamsLike,
) {
  const section = resolveServiceHelpAutoSection(pathname, searchParams);
  if (!section) return null;
  return `${SERVICE_HELP_AUTO_OPEN_STORAGE_PREFIX}:${section.slice(1)}`;
}

export function shouldOpenServiceNavGuide({
  matchingViewport,
  requested,
  hasCompletedGuide,
  isPlainHome,
}: {
  matchingViewport: boolean;
  requested: boolean;
  hasCompletedGuide: boolean;
  isPlainHome: boolean;
}) {
  return matchingViewport && (requested || (isPlainHome && !hasCompletedGuide));
}

export const SERVICE_GUIDE_STEPS = [
  {
    section: "/home" as const,
    label: "홈",
    title: "오늘의 다음 행동을 먼저 확인해요",
    description: "교수 연결, 프로젝트, 성장 기록 중 지금 이어갈 한 가지를 먼저 보여줘요.",
    anchor: "8.333%",
  },
  {
    section: "/professors" as const,
    label: "교수 매칭",
    title: "내 고민에서 첫 교수님을 찾아요",
    description: "고민을 정리한 뒤 학교 공식 정보를 근거로 대화할 교수님을 찾아요.",
    anchor: "25%",
  },
  {
    section: "/quest" as const,
    label: "교수 만남 준비",
    title: "선택한 교수님과의 첫 대화를 준비해요",
    description: "첫 질문과 이메일부터 면담 후 기록까지 교수 매칭 다음 단계를 이어가요.",
    anchor: "41.667%",
  },
  {
    section: "/research" as const,
    label: "AI 프로젝트 설계",
    title: "관심사를 실행할 프로젝트로 만들어요",
    description: "AI와 질문을 주고받으며 수업, 프로젝트, 연구 아이디어를 구체화해요.",
    anchor: "58.333%",
  },
  {
    section: "/project-professors" as const,
    label: "프로젝트 실행",
    title: "추천 교수와 프로젝트 실행을 이어가요",
    description: "설계한 주제와 방법에 맞는 자문 교수를 찾고 실행 홈에서 다음 행동을 관리해요.",
    anchor: "75%",
  },
  {
    section: "/portfolio" as const,
    label: "나의 성장과정",
    title: "지금까지의 변화를 기록으로 남겨요",
    description: "교수 연결, 프로젝트, AI 교수님과 나눈 생각을 나만의 성장 흐름으로 모아요.",
    anchor: "91.667%",
  },
] as const;

export function navigationJourney(section: string): ServiceJourney | null {
  if (section === "/professors") return { key: "professor", label: "교수 연결", step: 1 };
  if (section === "/quest") return { key: "professor", label: "교수 연결", step: 2 };
  if (section === "/research") return { key: "project", label: "프로젝트 실행", step: 1 };
  if (section === "/project-professors") return { key: "project", label: "프로젝트 실행", step: 2 };
  return null;
}

export function resolveServiceSection(
  pathname: string,
  searchParams?: SearchParamsLike,
): ServiceSection | null {
  if (pathname === "/home" && searchParams?.get("professor") === "quick") return "/professors";
  if (pathname === "/home" && searchParams?.get("project") === "quick") return "/research";

  if (pathname.startsWith("/project-professors")) return "/project-professors";
  if (pathname.startsWith("/project-execution") || pathname.startsWith("/project-meeting")) {
    return "/project-professors";
  }

  if (pathname === "/tutorial") return "/professors";
  if (pathname.startsWith("/professors")) {
    const from = searchParams?.get("from");
    if (from === "home") return "/home";
    if (from === "quest") return "/quest";
    if (from === "portfolio") return "/portfolio";
    if (from === "result") return "/research";
    if (
      from === "project"
      || from === "project-execution"
      || from === "project-meeting"
      || searchParams?.get("journey") === "project"
    ) return "/project-professors";
    return "/professors";
  }

  if (
    pathname.startsWith("/quest")
    || pathname.startsWith("/paper")
    || pathname.startsWith("/mentor-loop")
  ) return "/quest";

  if (
    pathname.startsWith("/research")
    || pathname.startsWith("/co-design")
    || pathname.startsWith("/result")
  ) {
    return searchParams?.get("section") === "professor-connection"
      ? "/project-professors"
      : "/research";
  }

  if (pathname.startsWith("/portfolio")) return "/portfolio";
  if (pathname.startsWith("/profile")) return "/profile";
  if (pathname === "/home" || pathname.startsWith("/mentoring")) return "/home";
  return null;
}

const SECTION_HELP: Record<Exclude<ServiceSection, "/profile">, ServiceHelpCopy> = {
  "/home": {
    section: "/home",
    label: "홈",
    title: "지금 이어갈 한 가지를 먼저 보여줘요",
    purpose: "교수 연결, 프로젝트, 성장 기록의 현재 상태를 한곳에서 확인하는 화면이에요.",
    now: "가장 위의 행동 카드에서 지금 필요한 다음 단계를 시작해 보세요.",
    next: "완료한 내용은 나의 성장과정에 차곡차곡 이어져요.",
    steps: [
      { title: "오늘 할 일 시작", description: "맨 위 ‘지금 할 일’을 눌러 오늘 이어갈 한 가지를 시작해요." },
      { title: "현재 상태 확인", description: "선택한 교수와 첫 대화 준비 진행률에서 지금 단계를 확인해요." },
      { title: "기록 이어보기", description: "완료한 내용은 최근 기록이나 나의 성장과정에서 다시 봐요." },
    ],
    areas: [
      { title: "오늘의 핵심 행동", description: "가장 먼저 이어갈 일과 시작 버튼을 한 카드에 모았어요.", selector: '[data-service-help="home-next-action"]' },
      { title: "나의 첫 교수 연결", description: "선택한 교수와 공식 정보, 다른 교수를 확인하는 버튼이 있는 영역이에요.", selector: '[data-service-help="home-professor"]' },
      { title: "첫 대화 준비 진행률", description: "완료한 단계와 지금 이어갈 단계를 확인하고 바로 이동할 수 있어요.", selector: '[data-service-help="home-progress"]' },
    ],
  },
  "/professors": {
    section: "/professors",
    label: "교수 연결 1/2",
    title: "내 고민과 이어지는 교수님을 찾아요",
    purpose: "전공과 관심 분야를 설정하고 학교 공식 정보에서 대화할 교수님을 찾는 곳이에요.",
    now: "처음이라면 기본 설정을 마친 뒤, 후보 교수의 연결 근거를 비교해 보세요.",
    next: "한 분을 고르면 교수 만남 준비로 이어져요.",
    steps: [
      { title: "전공 설정", description: "학교와 단과대, 현재 공부하는 전공을 설정해요." },
      { title: "관심 분야 선택", description: "공식 연구 분야와 비교할 관심사를 하나 이상 골라요." },
      { title: "교수 선택하기", description: "세 교수의 연결 이유와 공식 근거를 비교하고 한 분을 선택해요." },
    ],
    areas: [
      { title: "기본 설정 진행 단계", description: "전공과 관심 분야 중 어디까지 설정했는지 보여줘요.", selector: '[data-service-help="professor-progress-context"]' },
      { title: "현재 설정 항목", description: "교수 연결에 필요한 최소 정보만 입력하거나 선택하는 영역이에요.", selector: '[data-service-help="professor-question"], [data-service-help="professor-options"]' },
      { title: "이전·다음 행동", description: "설정을 수정하거나 확인하고 교수 매칭으로 이동하는 버튼이에요.", selector: '[data-service-help="professor-actions"]' },
    ],
  },
  "/quest": {
    section: "/quest",
    label: "교수 연결 2/2",
    title: "교수님과의 첫 만남을 준비해요",
    purpose: "교수를 선택한 뒤 연락 전부터 면담 후까지 필요한 준비를 이어가는 곳이에요.",
    now: "화면 위의 다음 행동을 따라 논문 한입, 첫 질문, 이메일을 한 단계씩 준비해 보세요.",
    next: "면담 뒤 얻은 조언과 행동은 나의 성장과정에 남길 수 있어요.",
    steps: [
      { title: "연결 교수 확인", description: "대화할 교수님과 공식 연구 근거를 먼저 확인해요." },
      { title: "만나기 전 준비", description: "논문 한입, 첫 질문, 이메일 순서로 준비를 채워요." },
      { title: "대화와 후속 기록", description: "대비 질문을 준비하고 만난 뒤 조언을 다음 행동으로 기록해요." },
    ],
    areas: [
      { title: "지금 할 준비", description: "현재 단계에서 가장 먼저 할 일과 시작 버튼을 보여주는 핵심 카드예요.", selector: 'section[aria-labelledby="hub-primary-task"]' },
      { title: "첫 만남 여정", description: "교수 선택부터 면담 후 기록까지 네 단계의 현재 상태를 확인해요.", selector: 'section[aria-labelledby="meeting-journey-title"]' },
      { title: "교수·준비 현황", description: "연결한 교수의 근거와 지금까지 저장한 준비물을 함께 확인해요.", selector: 'aside[aria-label="현재 교수 연결과 저장한 준비 현황"]' },
    ],
  },
  "/research": {
    section: "/research",
    label: "프로젝트 실행 1/2",
    title: "프로젝트 설계 상태와 다음 행동을 확인해요",
    purpose: "저장된 조건부터 공동설계, 후보 비교, 프로젝트 선택까지 현재 상태를 한곳에서 확인하는 홈이에요.",
    now: "진행률과 현재 프로젝트 출발점을 확인하고 화면의 주 버튼으로 다음 단계만 이어가세요.",
    next: "프로젝트를 고르면 실행에 필요한 맞춤 교수 추천으로 이어져요.",
    steps: [
      { title: "설계 현황 확인", description: "조건·공동설계·후보·선택 네 단계 중 현재 위치를 확인해요." },
      { title: "다음 행동 이어가기", description: "저장 상태에 맞춰 설계 시작, 공동설계, 후보 보기 중 한 가지가 제안돼요." },
      { title: "후보 비교·선택", description: "생성한 프로젝트 후보의 근거를 비교하고 실행할 하나를 골라요." },
    ],
    areas: [
      { title: "프로젝트 설계 소개", description: "프로젝트 설계의 목적과 현재 상태에 맞는 주 행동을 보여줘요.", selector: '[data-journey-stage="project"]' },
      { title: "4단계 설계 현황", description: "완료한 단계와 아직 남은 단계를 한눈에 확인해요.", selector: 'section[aria-labelledby="project-design-progress-title"]' },
      { title: "지금 이어갈 한 가지", description: "현재 상태에 맞는 다음 행동과 준비 기간·자료를 확인해요.", selector: 'aside[aria-label="프로젝트 설계 다음 행동"]' },
    ],
  },
  "/project-professors": {
    section: "/project-professors",
    label: "프로젝트 실행 2/2",
    title: "프로젝트 성공에 필요한 교수님을 찾아요",
    purpose: "개인 고민이 아니라 선택한 프로젝트의 주제, 방법, 응용에 필요한 전문성을 기준으로 연결해요.",
    now: "역할별 추천 이유와 공식 근거를 비교해 프로젝트에 도움을 받을 교수님을 확인해 보세요.",
    next: "선택과 대화 기록은 나의 성장과정에 이어져요.",
    steps: [
      { title: "프로젝트 선택", description: "먼저 AI 프로젝트 설계를 마치고 후보 중 하나를 선택해요." },
      { title: "추천 불러오기", description: "프로젝트 결과에서 맞춤 교수 추천을 눌러 역할별 후보를 불러와요." },
      { title: "역할·근거 비교", description: "연구주제·방법론·응용 맥락별 추천 이유와 공식 근거를 비교해요." },
    ],
    areas: [
      { title: "추천을 이어갈 다음 행동", description: "현재 프로젝트 상태에 맞춰 설계·선택·추천 중 필요한 버튼을 보여줘요.", selector: '[data-service-help="project-primary"]' },
      { title: "선택 프로젝트", description: "어떤 프로젝트를 기준으로 교수 추천을 만드는지 확인해요.", selector: '[data-service-help="project-summary"]' },
      { title: "추천 기준과 신뢰 안내", description: "역할별 연결 기준과 공식 정보 사용 범위를 설명하는 영역이에요.", selector: '[data-service-help="recommendation-criteria"]' },
    ],
  },
  "/portfolio": {
    section: "/portfolio",
    label: "나의 성장과정",
    title: "내가 쌓은 경험과 생각의 변화를 모아요",
    purpose: "교수 연결, 프로젝트 설계, 면담 뒤 행동, AI 교수님 대화를 성장 흐름으로 보는 곳이에요.",
    now: "AI 교수님과 대화를 이어가거나 비어 있는 다음 기록을 채워 보세요.",
    next: "저장한 변화는 포트폴리오와 생각 지도에서 다시 활용할 수 있어요.",
    steps: [
      { title: "AI 교수님과 대화", description: "대화를 시작하거나 이어가며 지금 고민과 프로젝트 생각을 정리해요." },
      { title: "다음 기록 채우기", description: "최근 생각 지도와 다음 기록 제안을 보고 비어 있는 단계를 채워요." },
      { title: "성장 흐름 정리", description: "프로젝트·교수 연결 기록을 돌아보고 포트폴리오로 정리해요." },
    ],
    areas: [
      { title: "나의 AI 교수님", description: "대화와 생각 지도를 통해 현재 고민의 변화와 갈래를 확인해요.", selector: '[data-service-help="growth-ai-professor"]' },
      { title: "다음 기록 제안", description: "지금 비어 있는 성장 기록과 바로 이어갈 버튼을 보여줘요.", selector: '[data-service-help="growth-next-record"]' },
      { title: "내 방향의 변화", description: "처음 고민에서 현재 행동까지 어떻게 구체화됐는지 비교해요.", selector: '[data-service-help="growth-story"]' },
    ],
  },
};

const AI_PROFESSOR_HELP: ServiceHelpCopy = {
  section: "/portfolio",
  label: "나의 성장과정",
  title: "AI 교수님과 생각을 정리하고 갈래를 만들어요",
  purpose: "짧은 대화에서 고민의 핵심을 찾고, 새 질문이 생기면 생각 지도를 여러 갈래로 넓혀요.",
  now: "대화하기에서 고민을 말하거나, 대화 지도에서 정리된 생각과 원문을 열어 보세요.",
  next: "내 맥락에서 저장한 메모를 확인하고 실제 교수 만남이나 프로젝트 설계로 이어갈 수 있어요.",
  steps: [
    { title: "가볍게 대화", description: "지금 고민이나 아이디어를 짧게 말하면 핵심과 선택지를 정리해요." },
    { title: "생각 지도 확인", description: "질문·발견·행동이 어떤 갈래로 이어졌는지 살펴봐요." },
    { title: "핵심을 남기기", description: "중요한 생각만 성장 메모로 저장하고 실제 만남·프로젝트로 이어가요." },
  ],
  areas: [
    { title: "보기 방식 선택", description: "대화하기, 대화 지도, 내 맥락을 오가며 같은 기록을 다른 방식으로 확인해요.", selector: 'nav[aria-label="AI 교수님 보기 방식"]' },
    { title: "현재 AI 교수님 화면", description: "현재 선택한 보기 방식의 대화·생각 지도·성장 맥락을 보여줘요.", selector: 'section[aria-labelledby="ai-professor-conversation"], section[aria-labelledby="conversation-map-title"], aside[aria-label="나의 성장 맥락과 저장 메모"]' },
    { title: "다음 생각 이어가기", description: "추천 질문을 고르거나 직접 입력해 새로운 대화 갈래를 만들 수 있어요.", selector: '[aria-label="이어갈 대화 예시"], nav[aria-label="다음 성장 행동"]' },
  ],
};

const PROFESSOR_HUB_HELP: ServiceHelpCopy = {
  section: "/professors",
  label: "교수 연결 1/2",
  title: "교수 연결의 현재 상태와 다음 행동을 확인해요",
  purpose: "첫 설정을 마친 뒤 다시 찾기, 후보 비교, 선택한 교수 확인을 한곳에서 이어가는 교수 탭 홈이에요.",
  now: "가장 위 카드에서 지금 필요한 행동 하나를 시작하거나, 내 교수 연결에서 저장한 상태를 확인하세요.",
  next: "교수 한 분을 선택하면 교수 만남 준비 탭에서 첫 질문과 연락을 준비할 수 있어요.",
  steps: [
    { title: "지금 할 일 확인", description: "설정과 교수 선택 상태에 맞춰 가장 먼저 할 행동을 확인해요." },
    { title: "연결 상태 확인", description: "선택한 교수와 저장한 교수를 한곳에서 확인해요." },
    { title: "다시 찾거나 관리", description: "조건을 바꿔 새로 찾거나 저장한 연결을 관리해요." },
  ],
  areas: [
    { title: "지금 필요한 교수 연결", description: "현재 상태에 따라 교수 찾기, 피칭 이어보기, 대화 준비 중 하나를 먼저 보여줘요.", selector: '[data-service-help="professor-hub-primary"]' },
    { title: "내 교수 연결", description: "선택한 교수와 저장한 교수를 확인하고 해당 화면으로 바로 이동해요.", selector: '[data-service-help="professor-hub-connection"]' },
    { title: "다시 찾기와 관리", description: "조건을 직접 입력해 다시 찾거나 저장한 연결 기록을 관리해요.", selector: '[data-service-help="professor-hub-tools"]' },
  ],
};

const MENTOR_LOOP_HELP: ServiceHelpCopy = {
  section: "/quest",
  label: "교수 만남 후 · 다음 만남 씨앗",
  title: "교수님의 조언을 수정과 행동으로 이어가요",
  purpose: "면담에서 들은 핵심을 남기고, 연구안의 변화와 이번 주 행동을 하나의 기록으로 만드는 화면이에요.",
  now: "받은 조언부터 한 단계씩 정리하세요. 현재 단계만 화면에 보여서 필요한 내용에 집중할 수 있어요.",
  next: "저장하면 7일 행동과 감사 이메일 초안이 만들어지고, 기록은 나의 성장과정에 이어져요.",
  steps: [
    { title: "받은 조언 정리", description: "면담일과 교수님이 강조한 핵심을 적고, 필요하면 추천 자료와 주의점도 남겨요." },
    { title: "연구안 수정", description: "기존 질문·방법·범위와 조언을 반영한 수정 문장을 나란히 비교해요." },
    { title: "7일 행동 저장", description: "교수님께 약속한 일과 이번 주 행동, 다음 확인 날짜를 정해 저장해요." },
  ],
  areas: [
    { title: "세 단계 진행 순서", description: "받은 조언, 연구 수정, 7일 행동 중 현재 위치를 확인하고 필요한 단계로 이동해요.", selector: '[data-service-help="mentor-loop-progress"]' },
    { title: "현재 단계 입력", description: "지금 단계에 필요한 내용만 보여줘요. 입력한 내용은 같은 교수·주제 기록으로 이어집니다.", selector: '[data-service-help="mentor-loop-stage"]' },
    { title: "이전·다음·저장", description: "이전 단계로 돌아가거나 다음 단계로 이동하고, 마지막에는 7일 계획과 이메일 초안을 저장해요.", selector: '[data-service-help="mentor-loop-actions"]' },
  ],
};

const PROJECT_EXECUTION_HELP: ServiceHelpCopy = {
  section: "/project-professors",
  label: "프로젝트 실행 홈",
  title: "프로젝트 실행 상태와 다음 행동을 확인해요",
  purpose: "선택한 프로젝트와 자문 교수를 기준으로 실행 준비 현황과 오늘 할 일을 관리하는 화면이에요.",
  now: "완료하지 않은 단계를 확인하고 오늘 실행할 한 문장을 먼저 남겨 보세요.",
  next: "필요한 근거를 다시 보거나 프로젝트 교수 자문 준비로 이어갈 수 있어요.",
  steps: [
    { title: "실행 현황 확인", description: "프로젝트 브리프·교수 자문·자료 준비·자문 반영의 현재 상태를 확인해요." },
    { title: "오늘 실행 정리", description: "지금 바로 할 다음 행동을 한 문장으로 적으면 이 브라우저에 저장돼요." },
    { title: "교수 자문 준비", description: "선택한 교수님께 검증받을 목표와 질문, 가져갈 자료를 준비해요." },
  ],
  areas: [
    { title: "프로젝트 실행 맥락", description: "현재 프로젝트와 선택한 자문 교수를 함께 확인해요.", selector: '[aria-label="현재 프로젝트와 자문 교수"]' },
    { title: "4단계 실행 현황", description: "완료한 단계와 다음으로 이어갈 작업을 확인해요.", selector: 'section[aria-labelledby="execution-progress-title"]' },
    { title: "오늘의 실행", description: "다음 행동을 입력하고 자동 저장 상태를 확인하는 영역이에요.", selector: 'section[aria-labelledby="execution-plan-title"]' },
  ],
};

const PROJECT_MEETING_HELP: ServiceHelpCopy = {
  section: "/project-professors",
  label: "프로젝트 교수 자문",
  title: "프로젝트 교수 자문을 구체적으로 준비해요",
  purpose: "일반 교수 만남과 분리해 프로젝트의 질문·데이터·방법·범위를 검증받을 준비를 하는 화면이에요.",
  now: "이번 자문에서 결정할 목표를 적고, 학생의 말투로 질문 세 개와 가져갈 자료를 다듬어 보세요.",
  next: "면담 뒤에는 받은 조언을 프로젝트 변화로 기록하고 실행 홈으로 돌아갈 수 있어요.",
  steps: [
    { title: "자문 목표 정리", description: "면담 뒤 바꾸거나 확정할 한 가지를 먼저 적어요." },
    { title: "질문·자료 준비", description: "핵심 질문 세 개를 다듬고 근거·샘플 데이터·결정 쟁점을 챙겨요." },
    { title: "자문 후 반영", description: "들은 조언으로 달라진 범위·방법·다음 행동을 기록해요." },
  ],
  areas: [
    { title: "자문 목적 구분", description: "일반 첫 만남이 아닌 프로젝트 자문이라는 점과 저장 범위를 확인해요.", selector: '[class*="purposeNotice"]' },
    { title: "자문 목표와 질문", description: "결정 목표와 질문 세 개를 프로젝트 맥락에 맞게 편집해요.", selector: 'section[aria-labelledby="meeting-goal-title"]' },
    { title: "프로젝트·교수 맥락", description: "선택 프로젝트와 자문 교수의 공식 연결 이유를 함께 확인해요.", selector: 'aside[aria-label="선택한 프로젝트와 자문 교수"]' },
  ],
};

const PROJECT_SETUP_HELP: ServiceHelpCopy = {
  section: "/research",
  label: "프로젝트 조건 정리",
  title: "프로젝트 조건을 한 단계씩 정리해요",
  purpose: "전공·관심·경험·기간·자료를 필요한 순서로 확인해 실행 가능한 프로젝트 범위를 만드는 화면이에요.",
  now: "저장된 답은 건너뛰고 아직 비어 있는 조건부터 확인하거나 전체 요약에서 필요한 항목만 수정하세요.",
  next: "조건을 확인하면 AI 공동설계 질문으로 이어져 프로젝트 후보를 만들 수 있어요.",
  steps: [
    { title: "출발 조건 확인", description: "전공과 탐색 방식, 관심 분야를 확인해요." },
    { title: "준비 범위 정리", description: "경험·도구·기간·자료 접근 상황을 선택해요." },
    { title: "최종 확인", description: "전체 조건을 한눈에 보고 필요한 항목만 수정한 뒤 공동설계를 시작해요." },
  ],
  areas: [
    { title: "조건 준비 진행률", description: "어느 조건까지 확인했는지 보여줘요.", selector: '[data-service-help="research-progress"]' },
    { title: "현재 조건", description: "지금 단계에서 필요한 항목을 선택하거나 입력해요.", selector: '[data-service-help="research-question"]' },
    { title: "이전·다음 행동", description: "이전 단계로 돌아가거나 다음 조건으로 이동해요.", selector: '[data-service-help="research-actions"]' },
  ],
};

const CO_DESIGN_HELP: ServiceHelpCopy = {
  section: "/research",
  label: "AI 공동설계",
  title: "AI와 프로젝트 방향을 공동설계해요",
  purpose: "확인한 조건을 바탕으로 AI가 한 번에 한 질문을 제시하고 답변 맥락을 프로젝트 후보로 구체화하는 화면이에요.",
  now: "오른쪽 제안 중 가까운 방향을 고르거나 내 답변을 직접 적고 다음 질문으로 이어가세요.",
  next: "다섯 질문을 확인하면 데이터·방법·범위가 다른 프로젝트 후보를 비교할 수 있어요.",
  steps: [
    { title: "현재 맥락 확인", description: "전공·관심·기간과 선택한 탐색 방식을 먼저 확인해요." },
    { title: "질문에 답하기", description: "제안 방향을 고르거나 학생의 말로 직접 답해요." },
    { title: "후보 만들기", description: "공통 세 질문과 맞춤 두 질문을 마치면 후보 비교로 이어져요." },
  ],
  areas: [
    { title: "현재 프로젝트 맥락", description: "설계 조건과 탐색 방식을 확인하고 필요하면 근거 안내를 열어요.", selector: '[aria-label="현재 프로젝트 맥락"]' },
    { title: "AI 공동설계 대화", description: "현재 질문과 앞선 답변 맥락을 확인해요.", selector: '[aria-label="AI 공동설계 스튜디오"]' },
    { title: "답변하고 다음 질문", description: "가까운 방향을 선택하거나 직접 입력한 뒤 다음으로 이동해요.", selector: '.co-studio-next, .co-question-actions' },
  ],
};

export function getServiceHelpCopy(
  pathname: string,
  searchParams?: SearchParamsLike,
): ServiceHelpCopy {
  if (pathname.startsWith("/portfolio/ai-professor")) return AI_PROFESSOR_HELP;
  if (pathname.startsWith("/mentor-loop")) return MENTOR_LOOP_HELP;
  if (pathname.startsWith("/project-execution")) return PROJECT_EXECUTION_HELP;
  if (pathname.startsWith("/project-meeting")) return PROJECT_MEETING_HELP;
  if (pathname.startsWith("/research/conditions") || pathname.startsWith("/research/tutorial")) return PROJECT_SETUP_HELP;
  if (pathname.startsWith("/co-design")) return CO_DESIGN_HELP;
  if (pathname === "/professors") return PROFESSOR_HUB_HELP;

  const section = resolveServiceSection(pathname, searchParams);
  if (section && section !== "/profile") return SECTION_HELP[section];

  return {
    ...SECTION_HELP["/home"],
    title: "이 화면에서 할 수 있는 일을 알려드려요",
    purpose: "현재 화면의 핵심 기능을 확인하고 다음 서비스로 자연스럽게 이어갈 수 있어요.",
  };
}
