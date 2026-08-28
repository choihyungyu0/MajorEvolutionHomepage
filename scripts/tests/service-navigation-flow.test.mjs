import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const navigationSource = readFileSync(
  new URL("../../components/app/side-nav.tsx", import.meta.url),
  "utf8",
);
const globalStyleSource = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
const navigationConfigSource = readFileSync(
  new URL("../../lib/service-navigation.ts", import.meta.url),
  "utf8",
);
const landingSource = readFileSync(
  new URL("../../components/landing/landing-page.tsx", import.meta.url),
  "utf8",
);
const landingPreviewSource = readFileSync(
  new URL("../../components/landing/landing-product-preview.tsx", import.meta.url),
  "utf8",
);
const serviceHelpSource = readFileSync(
  new URL("../../components/app/service-help-guide.tsx", import.meta.url),
  "utf8",
);
const primitivesSource = readFileSync(
  new URL("../../components/app/primitives.tsx", import.meta.url),
  "utf8",
);
const installPromptSource = readFileSync(
  new URL("../../components/pwa/install-prompt.tsx", import.meta.url),
  "utf8",
);
const homeSource = readFileSync(
  new URL("../../components/screens/unified-home-screen.tsx", import.meta.url),
  "utf8",
);
const homeStyleSource = readFileSync(
  new URL("../../components/screens/home-dashboard.module.css", import.meta.url),
  "utf8",
);
const homeAiMapSource = readFileSync(
  new URL("../../components/screens/home-ai-map-preview.tsx", import.meta.url),
  "utf8",
);
const professorPanelSource = readFileSync(
  new URL("../../components/screens/professor-quick-start-panel.tsx", import.meta.url),
  "utf8",
);
const professorHubSource = readFileSync(
  new URL("../../components/screens/professor-hub-screen.tsx", import.meta.url),
  "utf8",
);
const professorTutorialSource = readFileSync(
  new URL("../../components/tutorial/professor-tutorial-screen.tsx", import.meta.url),
  "utf8",
);
const professorTutorialStyleSource = readFileSync(
  new URL("../../components/tutorial/professor-tutorial.module.css", import.meta.url),
  "utf8",
);
const projectPanelSource = readFileSync(
  new URL("../../components/screens/project-quick-start-panel.tsx", import.meta.url),
  "utf8",
);
const researchTutorialSource = readFileSync(
  new URL("../../components/tutorial/research-tutorial-screen.tsx", import.meta.url),
  "utf8",
);
const researchTutorialStyleSource = readFileSync(
  new URL("../../components/tutorial/research-tutorial.module.css", import.meta.url),
  "utf8",
);
const researchConditionSource = readFileSync(
  new URL("../../components/screens/research-condition.tsx", import.meta.url),
  "utf8",
);
const profileSource = readFileSync(
  new URL("../../components/screens/profile-screen.tsx", import.meta.url),
  "utf8",
);
const researchResultSource = readFileSync(
  new URL("../../components/screens/research-result.tsx", import.meta.url),
  "utf8",
);
const projectProfessorHubSource = readFileSync(
  new URL("../../components/screens/project-professor-hub-screen.tsx", import.meta.url),
  "utf8",
);
const officialProfessorSource = readFileSync(
  new URL("../../components/screens/official-professor-screens.tsx", import.meta.url),
  "utf8",
);
const questHubSource = readFileSync(
  new URL("../../components/screens/quest-hub-screen.tsx", import.meta.url),
  "utf8",
);
const questHubStyleSource = readFileSync(
  new URL("../../components/screens/quest-hub-screen.module.css", import.meta.url),
  "utf8",
);
const mentorLoopSource = readFileSync(
  new URL("../../components/screens/mentor-loop-screen.tsx", import.meta.url),
  "utf8",
);
const portfolioHubSource = readFileSync(
  new URL("../../components/screens/portfolio-hub-screen.tsx", import.meta.url),
  "utf8",
);
const aiProfessorSource = readFileSync(
  new URL("../../components/screens/ai-professor-screen.tsx", import.meta.url),
  "utf8",
);
const portfolioHubStyleSource = readFileSync(
  new URL("../../components/screens/portfolio-hub-screen.module.css", import.meta.url),
  "utf8",
);
const serviceHubStyleSource = readFileSync(
  new URL("../../components/app/service-hub.module.css", import.meta.url),
  "utf8",
);
const serviceHubSource = readFileSync(
  new URL("../../components/app/service-hub.tsx", import.meta.url),
  "utf8",
);
const researchStoreSource = readFileSync(
  new URL("../../store/research-store.ts", import.meta.url),
  "utf8",
);
const dataControlsSource = readFileSync(
  new URL("../../components/screens/data-controls.tsx", import.meta.url),
  "utf8",
);
const aiProfessorStoreSource = readFileSync(
  new URL("../../store/ai-professor-store.ts", import.meta.url),
  "utf8",
);
const questStoreSource = readFileSync(
  new URL("../../store/quest-store.ts", import.meta.url),
  "utf8",
);

function loadNavigationConfigModule() {
  const compiled = ts.transpileModule(navigationConfigSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

test("서비스 탭은 교수 여정 뒤 프로젝트 여정 순서로 이어진다", () => {
  const labels = [
    'label: "홈"',
    'label: "교수 매칭"',
    'label: "교수 만남 준비"',
    'label: "AI 프로젝트 설계"',
    'label: "맞춤 교수 추천"',
    'label: "나의 성장과정"',
  ];

  const positions = labels.map((label) => navigationSource.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(navigationSource, /shortLabel: "매칭"/);
  assert.match(navigationSource, /shortLabel: "만남"/);
  assert.match(navigationSource, /shortLabel: "프로젝트"/);
  assert.match(navigationSource, /shortLabel: "추천"/);
  assert.match(navigationSource, /shortLabel: "성장"/);
  assert.match(navigationConfigSource, /pathname\.startsWith\("\/portfolio"\)/);
  assert.match(navigationConfigSource, /navigationJourney/);
  assert.match(navigationConfigSource, /label: "교수 연결"/);
  assert.match(navigationConfigSource, /label: "프로젝트 실행"/);
  assert.match(navigationSource, /is-project-journey-start/);
  assert.match(navigationSource, /is-professor-journey-start/);
  assert.match(navigationSource, /side-nav__journey-step/);
  assert.match(navigationSource, /service-bottom-nav__journey-label/);
  assert.match(globalStyleSource, /\.service-bottom-nav__journey-label/);
});

test("첫 진입에서는 AI 마스코트가 PC와 모바일의 여섯 탭을 각 환경에서 한 번씩 안내한다", () => {
  assert.match(navigationConfigSource, /major-evolution-service-nav-guide-v3/);
  assert.match(navigationConfigSource, /major-evolution-service-nav-guide-mobile-v4/);
  assert.match(navigationConfigSource, /major-evolution-service-nav-guide-desktop-v2/);
  assert.match(navigationConfigSource, /SERVICE_GUIDE_STEPS/);
  assert.match(navigationConfigSource, /label: "홈"[\s\S]*label: "교수 매칭"[\s\S]*label: "교수 만남 준비"/);
  assert.match(navigationConfigSource, /label: "AI 프로젝트 설계"[\s\S]*label: "맞춤 교수 추천"[\s\S]*label: "나의 성장과정"/);
  assert.match(navigationSource, /guideCharacter\.connectOpener/);
  assert.match(navigationSource, /window\.location\.search\.length === 0/);
  assert.match(navigationSource, /matchMedia\("\(min-width: 1280px\)"\)/);
  assert.match(navigationSource, /shouldOpenServiceNavGuide/);
  assert.match(navigationSource, /matchingViewport: !desktopViewport\.matches/);
  assert.match(navigationSource, /SERVICE_DESKTOP_NAV_GUIDE_STORAGE_KEY/);
  assert.match(navigationSource, /matchingViewport: desktopViewport\.matches/);
  assert.match(navigationSource, /scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(navigationSource, /SERVICE_NAV_GUIDE_EVENT/);
  assert.match(navigationSource, /role="dialog"/);
  assert.match(navigationSource, /aria-live="polite"/);
  assert.match(navigationSource, /건너뛰기/);
  assert.match(navigationSource, /이전/);
  assert.match(navigationSource, /"시작하기" : "다음"/);
  assert.match(navigationSource, /event\.key === "Escape"/);
  assert.match(navigationSource, /data-service-nav-guide-open/);
  assert.match(globalStyleSource, /\.service-bottom-nav__guide/);
  assert.match(globalStyleSource, /--nav-guide-anchor/);
  assert.match(globalStyleSource, /\.service-bottom-nav a\.is-guide-target/);
  assert.match(globalStyleSource, /\.side-nav__guide/);
  assert.match(globalStyleSource, /\.side-nav__guide-progress/);
  assert.match(globalStyleSource, /\.side-nav\.is-guiding \+ \.app-viewport\.has-side-nav/);
  assert.match(globalStyleSource, /@media \(max-width: 420px\)/);
  assert.match(installPromptSource, /hasAttribute\("data-service-nav-guide-open"\)/);
});

test("첫 탭 안내 뒤에는 마이페이지·홈 핵심 화면·도움말 AI를 순서대로 설명한다", () => {
  assert.match(navigationConfigSource, /SERVICE_HOME_ONBOARDING_EVENT = "major-evolution:open-home-onboarding"/);
  assert.equal((navigationSource.match(/new CustomEvent\(SERVICE_HOME_ONBOARDING_EVENT\)/g) ?? []).length, 2);
  assert.match(navigationSource, /finishMobileGuideAndContinue/);
  assert.match(navigationSource, /finishGuideAndContinue/);
  assert.match(navigationSource, /data-service-onboarding="desktop-profile"/);
  assert.match(primitivesSource, /data-service-onboarding="mobile-profile"/);
  assert.match(homeSource, /data-service-onboarding="home-content"/);
  assert.match(serviceHelpSource, /마이페이지에서 내 정보를 관리해요/);
  assert.match(serviceHelpSource, /홈에서는 지금 할 일을 먼저 봐요/);
  assert.match(serviceHelpSource, /궁금한 화면은 도움말 AI에게 물어보세요/);
  assert.match(serviceHelpSource, /selector: "\.service-tab-header \.service-help-trigger"/);
  assert.match(serviceHelpSource, /data-service-help-trigger-target/);
  assert.match(globalStyleSource, /data-service-help-trigger-target="true"/);
  assert.match(globalStyleSource, /\.service-tab-header__actions/);
  assert.equal((serviceHelpSource.match(/localStorage\.getItem\(autoOpenStorageKey\) === "complete"/g) ?? []).length, 2);
});

test("랜딩의 서비스 시작은 완료 기록과 무관하게 홈 탭 가이드를 한 번 연다", () => {
  const { shouldOpenServiceNavGuide } = loadNavigationConfigModule();
  assert.equal(shouldOpenServiceNavGuide({
    matchingViewport: true,
    requested: true,
    hasCompletedGuide: true,
    isPlainHome: false,
  }), true);
  assert.equal(shouldOpenServiceNavGuide({
    matchingViewport: true,
    requested: false,
    hasCompletedGuide: true,
    isPlainHome: true,
  }), false);
  assert.equal(shouldOpenServiceNavGuide({
    matchingViewport: true,
    requested: false,
    hasCompletedGuide: false,
    isPlainHome: true,
  }), true);
  assert.equal(shouldOpenServiceNavGuide({
    matchingViewport: false,
    requested: true,
    hasCompletedGuide: false,
    isPlainHome: true,
  }), false);

  assert.match(navigationConfigSource, /SERVICE_HOME_WITH_NAV_GUIDE = "\/home\?guide=tabs"/);
  assert.equal((landingSource.match(/href=\{SERVICE_HOME_WITH_NAV_GUIDE\}/g) ?? []).length, 4);
  assert.equal((landingSource.match(/서비스 시작하기/g) ?? []).length, 4);
  assert.match(navigationSource, /hasRequestedNavigationGuide/);
  assert.match(navigationSource, /requestedForMobile/);
  assert.match(navigationSource, /requestedForDesktop/);
  assert.match(navigationSource, /url\.searchParams\.delete\(SERVICE_NAV_GUIDE_QUERY_PARAM\)/);
  assert.match(navigationSource, /window\.history\.replaceState\(window\.history\.state, "", nextUrl\)/);
  assert.match(navigationSource, /if \(requestedForMobile\) consumeNavigationGuideRequest\(\)/);
  assert.match(navigationSource, /if \(requestedForDesktop\) consumeNavigationGuideRequest\(\)/);
  assert.equal((navigationSource.match(/const forcedGuideRef = useRef\(false\)/g) ?? []).length, 2);
  assert.match(navigationSource, /if \(requestedForMobile\) forcedGuideRef\.current = true/);
  assert.match(navigationSource, /if \(requestedForDesktop\) forcedGuideRef\.current = true/);
  assert.match(navigationSource, /requested: forcedGuideRef\.current/);
  assert.match(navigationSource, /forcedGuideRef\.current = false/);
});

test("오른쪽 위 도움말 AI는 현재 화면의 목적과 사용 순서를 모든 서비스 화면에서 설명한다", () => {
  assert.match(primitivesSource, /ServiceHelpGuide/);
  assert.match(primitivesSource, /className="service-tab-header"/);
  assert.match(primitivesSource, /placement="header"/);
  assert.doesNotMatch(primitivesSource, /placement="floating"/);
  assert.match(serviceHelpSource, /화면 안내 AI/);
  assert.match(serviceHelpSource, /이 화면의 목적/);
  assert.match(serviceHelpSource, /지금 먼저 할 일/);
  assert.match(serviceHelpSource, /그다음 이어질 일/);
  assert.match(serviceHelpSource, /탭 사용 순서/);
  assert.match(serviceHelpSource, /help\.steps\.map/);
  assert.match(serviceHelpSource, /service-help-dialog__body/);
  assert.match(serviceHelpSource, /전체 메뉴 안내/);
  assert.match(serviceHelpSource, /SERVICE_NAV_GUIDE_EVENT/);
  assert.match(serviceHelpSource, /aria-modal="true"/);
  assert.match(serviceHelpSource, /event\.key === "Escape"/);
  assert.match(serviceHelpSource, /contains\(document\.activeElement\)/);
  assert.match(navigationConfigSource, /portfolio\/ai-professor/);
  assert.match(navigationConfigSource, /대화하기에서 고민을 말하거나/);
  assert.match(globalStyleSource, /\.service-help-trigger--floating/);
  assert.match(globalStyleSource, /\.service-help-dialog/);
  assert.match(globalStyleSource, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(globalStyleSource, /\.service-help-dialog__steps/);
  assert.match(globalStyleSource, /\.service-help-backdrop \{[\s\S]*rgba\(17, 27, 52, 0\.44\)/);
  assert.match(globalStyleSource, /data-service-nav-guide-open="true"[\s\S]*rgba\(16, 26, 52, 0\.56\)/);
  assert.match(globalStyleSource, /\.service-help-tour-backdrop\.is-measuring/);
  assert.match(navigationSource, /useNavigationGuideModal/);
  assert.match(navigationSource, /aria-modal="true"/);
  assert.match(navigationSource, /element\.inert = true/);
  assert.match(navigationSource, /useNavigationGuideStepFocus/);
});

test("독립 교수·프로젝트 튜토리얼도 같은 도움말 AI와 명암 규칙을 재사용한다", () => {
  assert.match(professorTutorialSource, /presentation === "page" \? \([\s\S]*href="\/welcome"[\s\S]*<ServiceHelpGuide placement="header"/);
  assert.match(researchTutorialSource, /presentation === "page" \? \([\s\S]*href="\/welcome"[\s\S]*<ServiceHelpGuide placement="header"/);
  assert.equal((professorTutorialSource.match(/<ServiceHelpGuide/g) ?? []).length, 1);
  assert.equal((researchTutorialSource.match(/<ServiceHelpGuide/g) ?? []).length, 1);
  assert.match(professorPanelSource, /presentation="embedded"/);
  assert.match(projectPanelSource, /presentation="embedded"/);
  assert.doesNotMatch(professorPanelSource, /ServiceHelpGuide/);
  assert.doesNotMatch(projectPanelSource, /ServiceHelpGuide/);
  assert.match(globalStyleSource, /\.service-help-tour__spotlight[\s\S]*9999px rgba\(16, 26, 52, 0\.56\)/);
});

test("주요 서비스 탭은 모바일과 PC 공통 바에서 서비스 소개·도움말·마이페이지를 바로 제공한다", () => {
  assert.match(primitivesSource, /aria-label="서비스 공통 메뉴"/);
  assert.match(primitivesSource, /<BrandLogo href="\/home" compact className="service-tab-header__brand" \/>/);
  assert.match(primitivesSource, /href="\/welcome"/);
  assert.match(primitivesSource, /aria-label="서비스 소개 보기"/);
  assert.match(primitivesSource, /className="service-tab-header__intro"/);
  assert.match(primitivesSource, /className="top-app-bar__intro"/);
  assert.match(primitivesSource, /<ServiceHelpGuide placement="header" \/>/);
  assert.match(primitivesSource, /className="service-tab-header__profile"/);
  assert.match(primitivesSource, /aria-label="마이페이지"/);
  assert.match(globalStyleSource, /\.service-tab-header \{/);
  assert.match(globalStyleSource, /\.service-tab-header__intro/);
  assert.match(globalStyleSource, /\.service-tab-header__profile/);
  assert.match(globalStyleSource, /@media \(min-width: 1280px\)[\s\S]*\.service-tab-header \{[\s\S]*min-height: 72px/);
  assert.doesNotMatch(globalStyleSource, /\.service-tab-header > \.service-tab-header__brand,[\s\S]*display: none/);

  for (const source of [
    homeSource,
    professorHubSource,
    questHubSource,
    portfolioHubSource,
    projectProfessorHubSource,
    aiProfessorSource,
  ]) {
    assert.match(source, /showHeader=\{false\}/);
    assert.doesNotMatch(source, /ServiceMobileHeader|styles\.mobileHeader/);
  }

  assert.match(researchConditionSource, /showHeader=\{false\}/);
  assert.match(researchConditionSource, /bottomNav=\{<ServiceBottomNav \/>\}/);
  assert.doesNotMatch(researchConditionSource, /showSideNav=\{false\}/);
  assert.doesNotMatch(researchConditionSource, /research-home-logo|<AppLogo/);
  assert.match(profileSource, /showHeader=\{false\}/);
  assert.match(profileSource, /bottomNav=\{<ServiceBottomNav \/>\}/);
});

test("여섯 주요 탭의 도움말 AI는 탭별 첫 방문에만 자동으로 열리고 수동 도움말은 유지된다", () => {
  const {
    getServiceHelpAutoOpenStorageKey,
    resolveServiceHelpAutoSection,
  } = loadNavigationConfigModule();
  const params = (values = {}) => ({
    get(name) {
      return values[name] ?? null;
    },
  });

  const entryCases = [
    ["/home", params(), "/home"],
    ["/home", params({ professor: "quick" }), "/professors"],
    ["/professors", params(), "/professors"],
    ["/quest", params(), "/quest"],
    ["/home", params({ project: "quick" }), "/research"],
    ["/research", params(), "/research"],
    ["/project-professors", params(), "/project-professors"],
    ["/portfolio", params(), "/portfolio"],
  ];

  for (const [pathname, searchParams, section] of entryCases) {
    assert.equal(resolveServiceHelpAutoSection(pathname, searchParams), section);
    assert.equal(
      getServiceHelpAutoOpenStorageKey(pathname, searchParams),
      `major-evolution-service-help-seen-v2:${section.slice(1)}`,
    );
  }

  const uniqueKeys = new Set(entryCases.map(([pathname, searchParams]) => (
    getServiceHelpAutoOpenStorageKey(pathname, searchParams)
  )));
  assert.equal(uniqueKeys.size, 6);

  for (const pathname of [
    "/professors/pitch",
    "/paper/reader",
    "/mentor-loop",
    "/co-design",
    "/result",
    "/portfolio/ai-professor",
  ]) {
    assert.equal(resolveServiceHelpAutoSection(pathname, params()), null);
    assert.equal(getServiceHelpAutoOpenStorageKey(pathname, params()), null);
  }

  assert.match(navigationConfigSource, /SERVICE_HELP_AUTO_OPEN_STORAGE_PREFIX = "major-evolution-service-help-seen-v2"/);
  assert.match(serviceHelpSource, /window\.localStorage\.getItem\(autoOpenStorageKey\)/);
  assert.match(serviceHelpSource, /window\.localStorage\.setItem\(autoOpenStorageKey, "complete"\)/);
  assert.match(serviceHelpSource, /document\.documentElement\.hasAttribute\("data-service-nav-guide-open"\)/);
  assert.match(serviceHelpSource, /navigationGuideRequested/);
  assert.match(serviceHelpSource, /manualInteractionKeyRef/);
  assert.match(serviceHelpSource, /onClick=\{startAreaTour\}/);

  const autoBlockStart = serviceHelpSource.indexOf("const timer = window.setTimeout");
  const autoBlockEnd = serviceHelpSource.indexOf("}, 240);", autoBlockStart);
  const autoBlock = serviceHelpSource.slice(autoBlockStart, autoBlockEnd);
  assert.ok(autoBlockStart >= 0 && autoBlockEnd > autoBlockStart);
  assert.ok(autoBlock.indexOf("localStorage.setItem") < autoBlock.indexOf("setOpen(true)"));
});

test("랜딩은 최신 기본 설정·화면 안내 AI·대화 재분기 흐름을 설명한다", () => {
  assert.match(landingSource, /교수 연결의 기본을 설정하다/);
  assert.match(landingSource, /전공·관심 기본 설정/);
  assert.match(landingSource, /가입 없이 전공과 관심 분야를 설정하면/);
  assert.doesNotMatch(landingSource, /3분 고민 정리|긴 신청서/);
  assert.match(landingSource, /특정 카드에서 새 갈래를 만들고/);
  assert.match(landingPreviewSource, /처음 여는 탭에서는 화면 안내 AI가 핵심 카드와 버튼을 한 번만 짚어줘요/);
  assert.match(landingPreviewSource, /저장한 전공·관심·프로젝트·연결 교수 맥락만 참고/);
  assert.match(landingPreviewSource, /이 카드에서 가지치기/);
  assert.match(homeSource, /두 단계 기본 설정을 마치면 첫 교수 연결을 시작할 수 있어요/);
  assert.doesNotMatch(homeSource, /3분 방향 찾기|나의 방향 3분 정리하기/);
});

test("여섯 주요 탭과 AI 교수님·면담 후 화면은 각자 세 단계 사용안내를 제공한다", () => {
  const stepBlocks = navigationConfigSource.match(/steps:\s*\[[\s\S]*?\n\s*\],/g) ?? [];
  assert.equal(stepBlocks.length, 9);
  for (const block of stepBlocks) {
    assert.equal((block.match(/title:/g) ?? []).length, 3);
    assert.equal((block.match(/description:/g) ?? []).length, 3);
  }
  assert.match(navigationConfigSource, /오늘 할 일 시작/);
  assert.match(navigationConfigSource, /전공 설정/);
  assert.match(navigationConfigSource, /관심 분야 선택/);
  assert.match(navigationConfigSource, /연결 교수 확인/);
  assert.match(navigationConfigSource, /입력 방식 선택/);
  assert.match(navigationConfigSource, /추천 불러오기/);
  assert.match(navigationConfigSource, /AI 교수님과 대화/);
  assert.match(navigationConfigSource, /가볍게 대화/);
  assert.match(navigationConfigSource, /교수 연결의 현재 상태와 다음 행동을 확인해요/);
  assert.match(navigationConfigSource, /교수 만남 후 · 다음 만남 씨앗/);
  assert.match(navigationConfigSource, /받은 조언 정리/);
  assert.match(navigationConfigSource, /7일 행동 저장/);
  assert.match(navigationConfigSource, /pathname\.startsWith\("\/mentor-loop"\)/);
});

test("도움말 AI는 현재 탭의 실제 카드와 버튼을 순서대로 강조한다", () => {
  const areaBlocks = navigationConfigSource.match(/areas:\s*\[[\s\S]*?\n\s*\],/g) ?? [];
  assert.equal(areaBlocks.length, 9);
  for (const block of areaBlocks) {
    assert.equal((block.match(/selector:/g) ?? []).length, 3);
  }

  assert.match(serviceHelpSource, /startAreaTour/);
  assert.match(serviceHelpSource, /service-help-tour__spotlight/);
  assert.match(serviceHelpSource, /scrollIntoView\(\{ block: "center"/);
  assert.match(serviceHelpSource, /new ResizeObserver\(updateSpotlight\)/);
  assert.match(serviceHelpSource, /appViewport\.inert = true/);
  assert.match(serviceHelpSource, /전체 사용 안내/);
  assert.match(serviceHelpSource, /aria-live="polite"/);
  assert.match(globalStyleSource, /\.service-help-tour-backdrop/);
  assert.match(globalStyleSource, /box-shadow:[\s\S]*9999px/);
  assert.match(globalStyleSource, /\.service-help-tour\.is-top/);
  assert.match(globalStyleSource, /\.service-help-tour\.is-bottom/);

  assert.match(homeSource, /data-service-help="home-next-action"/);
  assert.match(homeSource, /data-service-help="home-professor"/);
  assert.match(homeSource, /data-service-help="home-progress"/);
  assert.match(professorTutorialSource, /data-service-help="professor-question"/);
  assert.match(researchTutorialSource, /data-service-help="research-question"/);
  assert.match(projectProfessorHubSource, /data-service-help="project-primary"/);
  assert.match(portfolioHubSource, /data-service-help="growth-ai-professor"/);
  assert.match(professorHubSource, /data-service-help="professor-hub-primary"/);
  assert.match(professorHubSource, /data-service-help="professor-hub-connection"/);
  assert.match(professorHubSource, /data-service-help="professor-hub-tools"/);
  assert.match(researchConditionSource, /data-service-help="research-progress"/);
  assert.match(researchConditionSource, /data-service-help="research-question"/);
  assert.match(researchConditionSource, /data-service-help="research-actions"/);
  assert.match(mentorLoopSource, /data-service-help="mentor-loop-progress"/);
  assert.match(mentorLoopSource, /data-service-help="mentor-loop-stage"/);
  assert.match(mentorLoopSource, /data-service-help="mentor-loop-actions"/);
});

test("면담 후 기록 화면은 현재 한 단계만 보여주고 보조 기능은 접어서 제공한다", () => {
  assert.match(mentorLoopSource, /type MentorLoopStage = 1 \| 2 \| 3/);
  assert.match(mentorLoopSource, /MentorLoopProgress/);
  assert.match(mentorLoopSource, /stage === 1/);
  assert.match(mentorLoopSource, /stage === 2/);
  assert.match(mentorLoopSource, /stage === 3/);
  assert.match(mentorLoopSource, /mentor-loop-optional/);
  assert.match(mentorLoopSource, /mentor-loop-email-disclosure/);
  assert.doesNotMatch(mentorLoopSource, /<SceneBanner/);
});

test("탭 활성 규칙은 빠른 시작과 하위 화면의 실제 여정 맥락을 유지한다", () => {
  assert.match(navigationConfigSource, /pathname === "\/tutorial"/);
  assert.match(navigationConfigSource, /searchParams\?\.get\("from"\) === "project"/);
  assert.match(navigationConfigSource, /searchParams\?\.get\("section"\) === "professor-connection"/);
  assert.match(navigationConfigSource, /pathname\.startsWith\("\/paper"\)/);
  assert.match(navigationConfigSource, /pathname\.startsWith\("\/portfolio"\)/);
});

test("교수 매칭 튜토리얼은 최초 한 번만 탭 본문에서 보여주고 이후 교수 홈으로 진입한다", () => {
  assert.match(navigationSource, /href: "\/home\?professor=quick"/);
  assert.match(navigationSource, /useProfessorTabHref/);
  assert.match(navigationSource, /hasCompletedProfessorTutorial/);
  assert.match(navigationSource, /profileHasProfessorSetup/);
  assert.match(navigationSource, /hasProfessorJourney/);
  assert.match(navigationSource, /canOpenProfessorHome \? "\/professors" : "\/home\?professor=quick"/);
  assert.match(professorTutorialSource, /completeProfessorTutorial\(\);/);
  assert.match(homeSource, /searchParams\.get\("professor"\) === "quick"/);
  assert.match(homeSource, /professorMatchStatus === "success"/);
  assert.match(homeSource, /matches\.length > 0/);
  assert.match(homeSource, /professorMatchTopicId === discoveryTopic\.id/);
  assert.match(homeSource, /router\.replace\("\/professors\/pitch", \{ scroll: false \}\)/);
  assert.match(homeSource, /저장한 교수 피칭을 불러오고 있어요/);
  assert.match(homeSource, /<ProfessorQuickStartPanel/);
  assert.match(homeSource, /styles\.quickDashboard/);
  assert.match(professorPanelSource, /<section/);
  assert.match(professorPanelSource, /presentation="embedded"/);
  assert.doesNotMatch(professorPanelSource, /createPortal|aria-modal|quickOverlayBackdrop/);
  assert.match(homeStyleSource, /\.quickInlinePanel/);
  assert.match(professorTutorialSource, /presentation\?: "page" \| "overlay" \| "embedded"/);
  assert.match(professorTutorialSource, /presentation === "page" \? "main" : "div"/);
  assert.match(professorTutorialStyleSource, /\.embeddedPage[\s\S]*overflow: visible/);
  assert.match(professorTutorialSource, /onRequestClose\?: \(\) => void/);
  assert.match(navigationConfigSource, /searchParams\?\.get\("professor"\) === "quick"/);
  assert.match(navigationConfigSource, /searchParams\?\.get\("project"\) === "quick"/);
  assert.match(navigationSource, /useSearchParams/);
});

test("AI 프로젝트 설계도 팝업 없이 홈의 탭 본문에서 기존 튜토리얼을 재사용한다", () => {
  assert.match(navigationSource, /href: "\/home\?project=quick"/);
  assert.match(homeSource, /searchParams\.get\("project"\) === "quick"/);
  assert.match(homeSource, /const quickPanelOpen = professorQuickOpen \|\| projectQuickOpen/);
  assert.match(homeSource, /<ProjectQuickStartPanel/);
  assert.match(projectPanelSource, /<section/);
  assert.match(projectPanelSource, /aria-label="프로젝트 빠른 시작"/);
  assert.match(projectPanelSource, /presentation="embedded"/);
  assert.doesNotMatch(projectPanelSource, /createPortal|aria-modal|quickOverlayBackdrop/);
  assert.match(researchTutorialSource, /presentation\?: "page" \| "overlay" \| "embedded"/);
  assert.match(researchTutorialSource, /presentation === "page" \? "main" : "div"/);
  assert.match(researchTutorialSource, /scrollIntoView\(\{ block: "start", behavior: "smooth" \}\)/);
  assert.match(researchTutorialSource, /major-evolution-research-tutorial-v1/);
  assert.match(researchTutorialStyleSource, /\.embeddedPage[\s\S]*overflow: visible/);
  assert.match(researchTutorialStyleSource, /\.embeddedPage \.actions[\s\S]*--app-bottom-nav-height/);
  assert.match(researchTutorialStyleSource, /@media \(max-width: 759px\)[\s\S]*\.embeddedPage[\s\S]*overflow: visible/);
  assert.match(researchTutorialSource, /className=\{styles\.modeChangeButton\}/);
  assert.match(researchTutorialStyleSource, /@media \(max-width: 420px\)[\s\S]*\.modeChangeButton[\s\S]*display: none/);
  assert.match(homeSource, /router\.replace\("\/home", \{ scroll: false \}\)/);
  assert.match(researchTutorialSource, /현재 공식 데이터를 지원하는 학교를 먼저 확인해요/);
  assert.match(researchTutorialSource, /!isDankookUniversity\(c\.school\)/);
  assert.match(researchTutorialSource, /필수 · 현재 단국대학교 지원/);
  assert.match(researchTutorialSource, /\{ label: "학교", value: draft\.conditions\.school \?\? "", step: "major" \}/);
  assert.match(navigationSource, /useProjectTabHref/);
  assert.match(navigationSource, /if \(result\) return "\/result"/);
  assert.match(navigationSource, /if \(hasCompleteSetup\) return "\/co-design"/);
  assert.match(navigationSource, /hasSavedDraft \? "\/research" : "\/home\?project=quick"/);
});

test("모바일 홈은 가로 스크롤 대신 현재 단계와 핵심 대화 흐름만 먼저 보여준다", () => {
  assert.match(homeSource, /mobileProgressCard/);
  assert.match(homeSource, /journeyComplete \? "성장 보기" : "이어가기"/);
  assert.match(homeStyleSource, /@media \(max-width: 759px\)[\s\S]*\.progressRail \{ display: none; \}/);
  assert.match(homeStyleSource, /@media \(max-width: 759px\)[\s\S]*\.aiMapMiniCanvas \{ display: none; \}/);
  assert.match(homeStyleSource, /\.utilitySection \{ display: none; \}/);
  assert.match(homeStyleSource, /calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(homeAiMapSource, /latestNode && latestNode\.id !== previewNodes\[0\]\?\.id/);
  assert.match(homeAiMapSource, /aiMapMobileFlow/);
  assert.match(homeAiMapSource, /aiMapMobileLink/);
});

test("맞춤 교수 추천 탭은 프로젝트 진행 상태마다 막히지 않는 다음 행동을 제공한다", () => {
  assert.match(projectProfessorHubSource, /AI 프로젝트 설계하기/);
  assert.match(projectProfessorHubSource, /프로젝트 후보 고르기/);
  assert.match(projectProfessorHubSource, /맞춤 교수 추천 확인하기/);
  assert.match(projectProfessorHubSource, /rankingSource === "ai-reranked"/);
  assert.match(projectProfessorHubSource, /공식 근거 규칙/);
  assert.match(projectProfessorHubSource, /isCurrentProjectProfessorMatch/);
  assert.match(projectProfessorHubSource, /const projectMatches = projectCoverage/);
  assert.match(projectProfessorHubSource, /\/result\?section=professor-connection#professor-connection/);
  assert.match(projectProfessorHubSource, /\?from=project/);
  assert.match(officialProfessorSource, /searchParams\.get\("from"\) === "project" \? "\/project-professors" : "\/professors"/);
  assert.match(researchResultSource, /hasCurrentProjectMatches \? professorMatches : \[\]/);
  assert.match(researchResultSource, /맞춤 교수 추천 탭에서 이어보기/);
  assert.match(researchResultSource, /단국대학교 재학생으로 확인하고 이어가기/);
});

test("학생 고민 매칭 응답과 프로젝트 멘토 응답은 주제 ID가 맞을 때만 현재 여정에 반영된다", () => {
  assert.match(researchStoreSource, /export function isProjectProfessorTopicId/);
  assert.match(researchStoreSource, /export function isCurrentProjectProfessorMatch/);
  assert.match(researchStoreSource, /response\.topicId !== state\.professorMatchTopicId/);
  assert.match(researchStoreSource, /isProjectProfessorTopicId\(response\.topicId\) && response\.topicId !== state\.selectedTopicId/);
  assert.match(researchStoreSource, /mergeGrowthProfessorHistoryByTopic/);
  assert.match(researchStoreSource, /isProjectProfessorTopicId\(response\.topicId\) \? "project" : "student"/);
  assert.match(researchStoreSource, /persistedVersion < 8 && persistedProjectMatch/);
  assert.match(researchStoreSource, /item\.source === "student" && currentProjectProfessorIds\.has\(item\.professorId\)/);
});

test("피칭에서 고른 교수는 즐겨찾기 없이도 대화 준비의 연결 교수로 인정한다", () => {
  assert.match(questHubSource, /selectedProfessorId/);
  assert.match(questHubSource, /professorMatches\.find/);
  assert.match(questHubSource, /hasConnectedProfessor/);
  assert.match(questHubSource, /교수님의 연구를 살펴볼 차례예요/);

  const connectionState = questHubSource.slice(
    questHubSource.indexOf("  const selectedProfessorMatch ="),
    questHubSource.indexOf("  const primary ="),
  );
  assert.match(connectionState, /Boolean\(selectedProfessorId\)/);
  assert.doesNotMatch(connectionState, /favoriteProfessorIds/);
});

test("교수 만남 준비 화면은 선택부터 면담 후 기록까지 현재 단계를 드러낸다", () => {
  assert.match(questHubSource, /첫 만남 여정/);
  assert.match(questHubSource, /지금 어디까지 준비했나요/);
  assert.match(questHubSource, /label: "교수 선택"/);
  assert.match(questHubSource, /label: "만나기 전"/);
  assert.match(questHubSource, /label: "대화 중"/);
  assert.match(questHubSource, /label: "만난 후"/);
  assert.match(questHubSource, /aria-current=\{isCurrent \? "step"/);
});

test("교수 만남 준비의 직접 진행 안내는 모바일 화면에서 한 번만 보여준다", () => {
  assert.equal((questHubSource.match(/연락과 면담은 학생이 직접 진행해요/g) ?? []).length, 1);
});

test("모바일 만남 화면은 현재와 다음 단계만 남기고 중복 상세를 바로가기로 바꾼다", () => {
  assert.match(questHubSource, /mobileJourneyStart/);
  assert.match(questHubSource, /mobileVisibleStep/);
  assert.match(questHubSource, /mobileQuickLinks/);
  assert.match(questHubSource, /저장한 준비물 \{beforeCount \+ silenceCount \+ afterCount\}개 보기/);
  assert.match(questHubStyleSource, /@media \(max-width: 1023px\)[\s\S]*\.journeyStep:not\(\.mobileVisibleStep\)/);
  assert.match(questHubStyleSource, /@media \(max-width: 1023px\)[\s\S]*\.expandedToolLists/);
  assert.match(questHubStyleSource, /calc\(104px \+ env\(safe-area-inset-bottom\)\)/);
});

test("서비스 허브는 모바일과 PC에서 같은 기능을 다른 정보 위계로 배치한다", () => {
  assert.match(serviceHubSource, /export function HubAdaptiveLayout/);
  assert.match(serviceHubSource, /eyebrow = "지금 먼저 할 일"/);
  assert.match(serviceHubSource, /className=\{styles\.primaryEyebrow\}/);
  assert.match(serviceHubStyleSource, /\.primaryTask::before/);
  assert.match(questHubSource, /eyebrow="지금 먼저 할 일"/);
  assert.match(serviceHubSource, /adaptivePrimary/);
  assert.match(serviceHubSource, /adaptiveRail/);
  assert.match(serviceHubSource, /adaptiveBody/);
  assert.match(serviceHubStyleSource, /@media \(min-width: 1280px\)[\s\S]*grid-template-areas/);
  assert.match(serviceHubStyleSource, /"primary rail"[\s\S]*"body rail"/);
  assert.match(serviceHubStyleSource, /position: sticky/);
  assert.match(serviceHubStyleSource, /grid-template-areas:[\s\S]*"icon copy"[\s\S]*"actions actions"/);
  assert.doesNotMatch(serviceHubStyleSource, /minmax\(220px, 320px\)/);
  assert.match(serviceHubStyleSource, /\.primaryButton \{ min-height: 48px; \}/);
  assert.doesNotMatch(serviceHubStyleSource, /\.rowCopy strong\s*\{[^}]*-webkit-line-clamp/);
  assert.match(serviceHubSource, /layout\?: "rail" \| "stacked"/);
  assert.match(serviceHubSource, /layout === "stacked" \? \([\s\S]*\{body\}[\s\S]*\{rail\}/);
  assert.match(serviceHubStyleSource, /\.adaptiveLayoutStacked[\s\S]*"primary"[\s\S]*"body"[\s\S]*"rail"/);
  assert.match(questHubSource, /layout="stacked"/);
  assert.match(questHubStyleSource, /container-name: meeting-journey/);
  assert.match(questHubStyleSource, /@container meeting-journey \(max-width: 760px\)/);
  assert.doesNotMatch(questHubStyleSource, /\.stepCopy strong\s*\{[^}]*white-space: nowrap/);
  assert.doesNotMatch(questHubStyleSource, /\.stepCopy em\s*\{[^}]*text-overflow: ellipsis/);
  assert.match(questHubSource, /contextLabel="현재 교수 연결과 저장한 준비 현황"/);
  assert.match(questHubSource, /저장한 준비물/);
  assert.doesNotMatch(globalStyleSource, /\.app-viewport \.side-nav/);
});

test("서비스 허브는 설명보다 첫 행동을 우선하고 빈 상태의 중복 CTA를 만들지 않는다", () => {
  assert.match(serviceHubSource, /variant\?: "default" \| "compact"/);
  assert.match(serviceHubSource, /href\?: string/);
  assert.match(serviceHubSource, /if \(!href\)[\s\S]*<article/);
  assert.match(serviceHubStyleSource, /\.introCompact/);
  assert.match(serviceHubStyleSource, /\.rowStatic/);
  assert.match(professorHubSource, /variant="compact"/);
  assert.match(professorHubSource, /href=\{selected \?[^\n]+: undefined\}/);
  assert.match(questHubSource, /variant="compact"/);
  assert.doesNotMatch(questHubSource, /contextProgressCopy/);
  assert.match(projectProfessorHubSource, /variant="compact"/);
  assert.match(projectProfessorHubSource, /recommendationReady/);
});

test("나의 성장과정은 프로젝트와 교수 연결을 현재 결과와 분리해 보존한다", () => {
  assert.match(researchStoreSource, /growthDirectionBaseline/);
  assert.match(researchStoreSource, /growthProjectHistory:\s*appendGrowthProjectRecord/);
  assert.match(researchStoreSource, /growthProfessorHistory:\s*mergeGrowthProfessorHistoryByTopic/);
  assert.match(researchStoreSource, /version:\s*8/);
  assert.match(portfolioHubSource, /내 방향이 구체화된 흐름/);
  assert.match(portfolioHubSource, /프로젝트 설계 기록/);
  assert.match(portfolioHubSource, /지금까지 연결한 교수님/);
  assert.match(portfolioHubSource, /입력하지 않은 변화는 추정하지 않고/);
});

test("성장 허브는 AI 교수님을 핵심 경험으로, 다음 기록은 보조 행동으로 구분한다", () => {
  assert.match(portfolioHubSource, /성장과정의 중심/);
  assert.match(portfolioHubSource, /AI 교수님과 대화 이어가기/);
  assert.match(portfolioHubSource, /나눈 대화/);
  assert.match(portfolioHubSource, /대화 갈래/);
  assert.match(portfolioHubSource, /다음 기록 제안/);
  assert.doesNotMatch(portfolioHubSource, /HubPrimaryTask/);
  assert.match(portfolioHubStyleSource, /\.aiProfessorSection[\s\S]*linear-gradient/);
  assert.match(portfolioHubStyleSource, /\.nextRecordCard/);
  assert.match(serviceHubStyleSource, /@media \(min-width: 1024px\)[\s\S]*\.primaryTask/);
  assert.match(serviceHubStyleSource, /@media \(max-width: 640px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test("모바일 성장 허브는 대표 변화와 최근 대화 지도만 먼저 보여준다", () => {
  assert.match(portfolioHubSource, /latestMapSummary/);
  assert.match(portfolioHubSource, /aiProfessorMapPreview/);
  assert.match(portfolioHubSource, /mobileStorySummary/);
  assert.match(portfolioHubSource, /mobileCompactList/);
  assert.match(portfolioHubStyleSource, /@media \(max-width: 1023px\)[\s\S]*\.storyPath \{[\s\S]*display: none;/);
  assert.match(portfolioHubStyleSource, /\.mobileCompactList > section > div:last-child > a:nth-child\(n \+ 2\)/);
  assert.match(portfolioHubStyleSource, /calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
});

test("내 기록 관리는 백업과 항목별 개별 삭제를 제공한다", () => {
  assert.match(dataControlsSource, /현재 브라우저에만 저장돼요/);
  assert.match(dataControlsSource, /기록 내려받기/);
  assert.match(dataControlsSource, /나의 방향과 프로젝트/);
  assert.match(dataControlsSource, /교수 연결과 만남/);
  assert.match(dataControlsSource, /나의 AI 교수님/);
  assert.match(dataControlsSource, /개 항목별 관리/);
  assert.match(dataControlsSource, /이 항목만 삭제/);
  assert.match(dataControlsSource, /나머지 기록은 그대로 남아요/);
  assert.doesNotMatch(dataControlsSource, /category\.clear/);
  assert.match(researchStoreSource, /clearGrowthDirectionBaseline:\s*\(\) =>/);
  assert.match(researchStoreSource, /removeGrowthProjectRecord:\s*\(topicId\) =>/);
  assert.match(researchStoreSource, /removeGrowthProfessorRecord:\s*\(professorId, source\) =>/);
  assert.match(researchStoreSource, /deleteKnockKitDraft:\s*\(key\) =>/);
  assert.match(researchStoreSource, /deleteMentorLoopEntry:\s*\(key\) =>/);
  assert.match(researchStoreSource, /removeFavoriteProfessors:\s*\(ids\) =>/);
  assert.match(questStoreSource, /deleteCard:\s*\(id\) =>/);
  assert.match(aiProfessorStoreSource, /removeConversationBranch:\s*\(messageId\) =>/);
  assert.match(aiProfessorStoreSource, /removeGrowthNote:\s*\(id\) =>/);

  const branchRemoval = aiProfessorStoreSource.slice(
    aiProfessorStoreSource.indexOf("removeConversationBranch: (messageId)"),
    aiProfessorStoreSource.indexOf("removeGrowthNote: (id)"),
  );
  assert.match(branchRemoval, /messages:\s*state\.messages\.filter/);
  assert.match(branchRemoval, /mapDecisions/);
  assert.doesNotMatch(branchRemoval, /growthNotes:/);
});
