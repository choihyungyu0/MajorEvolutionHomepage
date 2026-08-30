import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const entryGate = source("components/landing/entry-gate.tsx");
const profileStore = source("store/profile-store.ts");
const profileScreen = source("components/screens/profile-screen.tsx");
const sideNav = source("components/app/side-nav.tsx");
const primitives = source("components/app/primitives.tsx");
const landing = source("components/landing/landing-page.tsx");
const landingProductPreview = source("components/landing/landing-product-preview.tsx");
const landingProductPreviewStyles = source("components/landing/landing-product-preview.module.css");
const professorTutorial = source("components/tutorial/professor-tutorial-screen.tsx");
const researchTutorial = source("components/tutorial/research-tutorial-screen.tsx");
const welcomePage = source("app/welcome/page.tsx");
const portfolioHub = source("components/screens/portfolio-hub-screen.tsx");
const recordsPage = source("app/portfolio/manage/page.tsx");

test("최초 진입만 랜딩을 보여주고 서비스 이용 뒤에는 홈으로 보낸다", () => {
  assert.match(entryGate, /hasEnteredService/);
  assert.match(entryGate, /hasExistingJourney/);
  assert.match(entryGate, /router\.replace\("\/home"\)/);
  assert.match(entryGate, /return <LandingPage \/>/);
  assert.match(landing, /markServiceEntered/);
  assert.match(landing, /SERVICE_HOME_WITH_NAV_GUIDE/);
  assert.equal((landing.match(/href=\{SERVICE_HOME_WITH_NAV_GUIDE\}/g) ?? []).length, 4);
  assert.equal((landing.match(/서비스 시작하기/g) ?? []).length, 4);
  assert.doesNotMatch(landing, /3분 방향 찾기/);
  assert.match(professorTutorial, /runProfessorTutorialStoredAction\(markServiceEntered\)/);
  assert.match(researchTutorial, /runResearchTutorialStoredAction\(markServiceEntered\)/);
});

test("랜딩에서 실제 서비스 화면과 AI 대화의 생각 진화 과정을 미리 본다", () => {
  assert.match(landing, /LandingProductPreview/);
  assert.match(landing, /href: "#preview"/);
  assert.match(landingProductPreview, /실제 서비스 미리보기/);
  assert.match(landingProductPreview, /AI 교수님/);
  assert.match(landingProductPreview, /교수 3인 피칭/);
  assert.match(landingProductPreview, /AI 프로젝트 설계/);
  assert.match(landingProductPreview, /생각 씨앗/);
  assert.match(landingProductPreview, /발견한 단서/);
  assert.match(landingProductPreview, /다음 발걸음/);
  assert.match(landingProductPreview, /원문에서 새 갈래 이어가기/);
  assert.match(landingProductPreview, /화면 안내 AI가 핵심 카드와 버튼을 한 번만 짚어줘요/);
  const professorPitchIndex = landingProductPreview.indexOf('id: "professor-match"');
  const projectDesignIndex = landingProductPreview.indexOf('id: "project-design"');
  const aiProfessorIndex = landingProductPreview.indexOf('id: "ai-professor"');
  assert.ok(professorPitchIndex < projectDesignIndex && projectDesignIndex < aiProfessorIndex);
  assert.match(landingProductPreview, /useState<PreviewId>\("professor-match"\)/);
  assert.match(landingProductPreview, /AI_MAP_BRANCHES/);
  assert.match(landingProductPreview, /대화 4개 · 생각 7개 · 갈래 3개/);
  assert.match(landingProductPreview, /새로 생긴 질문/);
  assert.match(landingProductPreview, /확인할 관점/);
  assert.match(landingProductPreview, /지금의 방향/);
  assert.match(landingProductPreview, /mapBranches/);
  assert.match(landingProductPreview, /mapDirection/);
  assert.match(landingProductPreviewStyles, /@media \(max-width: 767px\)/);
  assert.match(landingProductPreviewStyles, /\.aiPreview \{[\s\S]*?grid-template-columns/);
  assert.match(landingProductPreviewStyles, /\.mapBranches \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(landingProductPreviewStyles, /@keyframes mapNodeReveal/);
  assert.match(landingProductPreviewStyles, /prefers-reduced-motion:[\s\S]*\.mapNode/);
});

test("마이페이지 정보는 브라우저 로컬 저장소에만 보존한다", () => {
  assert.match(profileStore, /createJSONStorage\(\(\) => localStorage\)/);
  assert.match(profileStore, /major-evolution-profile-v1/);
  assert.match(profileStore, /hasCompletedProfessorTutorial/);
  assert.match(profileStore, /completeProfessorTutorial/);
  assert.match(profileStore, /version: 2/);
  assert.match(profileStore, /saveProfile/);
  assert.match(profileScreen, /입력 내용은 현재 브라우저에만 저장됩니다/);
  assert.match(profileScreen, /내 정보 저장/);
});

test("좌측 하단 프로필과 공통 헤더 서비스 소개 경로가 분리되어 있다", () => {
  assert.match(sideNav, /side-nav__footer/);
  assert.match(sideNav, /href="\/profile"/);
  assert.match(sideNav, /href="\/home"/);
  assert.match(primitives, /href="\/welcome"/);
  assert.doesNotMatch(profileScreen, /href="\/welcome"/);
  assert.match(welcomePage, /<LandingPage \/>/);
});

test("내 기록 관리는 성장 허브가 아니라 마이페이지 출처를 보존해 진입한다", () => {
  assert.doesNotMatch(portfolioHub, /내 기록 관리/);
  assert.match(profileScreen, /href="\/portfolio\/manage\?from=profile"/);
  assert.match(profileScreen, /내 기록 관리/);
  assert.match(profileScreen, /저장한 기록을 백업하거나 필요한 항목만 직접 정리해요/);
  assert.match(recordsPage, /searchParams: Promise<\{ from\?: string \}>/);
  assert.match(recordsPage, /portfolioManageReturnHref\(from\)/);
});
