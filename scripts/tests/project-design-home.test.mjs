import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadModule() {
  const sourceUrl = new URL("../../lib/project-design-home.ts", import.meta.url);
  if (!existsSync(fileURLToPath(sourceUrl))) return null;
  const compiled = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

const home = loadModule();
const researchPageSource = readFileSync(
  new URL("../../app/research/page.tsx", import.meta.url),
  "utf8",
);
const projectHomeSource = readFileSync(
  new URL("../../components/screens/project-design-home-screen.tsx", import.meta.url),
  "utf8",
);
const researchStoreSource = readFileSync(
  new URL("../../store/research-store.ts", import.meta.url),
  "utf8",
);
const conditionsPageSource = readFileSync(
  new URL("../../app/research/conditions/page.tsx", import.meta.url),
  "utf8",
);
const conditionsScreenSource = readFileSync(
  new URL("../../components/screens/research-condition.tsx", import.meta.url),
  "utf8",
);
const portfolioBuilderSource = readFileSync(
  new URL("../../components/screens/portfolio-screen.tsx", import.meta.url),
  "utf8",
);
const globalStylesSource = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

test("프로젝트 설계 홈은 저장 상태에 맞는 다음 행동 하나를 제시한다", () => {
  assert.ok(home, "프로젝트 설계 홈 상태 모듈이 필요합니다.");
  const action = (patch = {}) => home.projectDesignHomeAction({
    hasDraft: false,
    hasCompleteSetup: false,
    hasResult: false,
    hasSelectedTopic: false,
    hasProjectProfessor: false,
    ...patch,
  });

  assert.deepEqual(action(), {
    label: "프로젝트 설계 시작하기",
    href: "/research/tutorial",
    stage: "conditions",
  });
  assert.equal(action({ hasDraft: true }).label, "이어서 설계하기");
  assert.equal(action({ hasDraft: true, hasCompleteSetup: true }).href, "/co-design");
  assert.equal(action({ hasResult: true }).href, "/result");
  assert.equal(action({ hasResult: true, hasSelectedTopic: true }).href, "/result/compare");
  assert.equal(action({ hasResult: true, hasSelectedTopic: true, hasProjectProfessor: true }).href, "/project-execution");
});

test("프로젝트 홈의 진행률은 조건·공동설계·후보·선택 네 단계를 계산한다", () => {
  assert.ok(home, "프로젝트 설계 홈 상태 모듈이 필요합니다.");
  assert.deepEqual(home.projectDesignHomeProgress({
    hasCompleteSetup: true,
    hasCoDesignAnswers: true,
    hasResult: true,
    hasSelectedTopic: false,
  }), {
    completed: 3,
    total: 4,
    percent: 75,
    steps: { conditions: true, coDesign: true, candidates: true, selected: false },
  });
});

test("현재 프로젝트를 기록에 남기고 새 설계 상태만 초기화한다", () => {
  assert.match(projectHomeSource, /현재 프로젝트 저장하고 새로 설계/);
  assert.match(projectHomeSource, /localStorage\.removeItem\("major-evolution-research-tutorial-v1"\)/);
  assert.match(projectHomeSource, /saveCurrentProjectAndStartNew\(\);[\s\S]*router\.push\("\/research\/tutorial"\)/);
  const action = researchStoreSource.slice(
    researchStoreSource.lastIndexOf("  saveCurrentProjectAndStartNew: () =>"),
    researchStoreSource.lastIndexOf("  removeGrowthProjectRecord:"),
  );
  assert.match(action, /appendGrowthProjectRecord/);
  assert.match(action, /conditions: \{ \.\.\.emptyConditions \}/);
  assert.match(action, /selectedTopicId: null/);
  assert.match(action, /\.\.\.emptyProjectProfessorMatchState\(\)/);
  assert.doesNotMatch(action, /growthProjectHistory: \[\]|growthProfessorHistory: \[\]|professorMatches: \[\]/);
});

test("기존 프로젝트 조건 편집 주소는 새 조건 편집 화면으로 호환 이동한다", () => {
  assert.match(researchPageSource, /searchParams/);
  assert.match(researchPageSource, /view === "review"/);
  assert.match(researchPageSource, /redirect\("\/research\/conditions\?view=review"\)/);
});

test("프로젝트 홈에서 조건을 수정한 뒤에는 단계형 화면이 아니라 프로젝트 홈으로 돌아온다", () => {
  assert.match(projectHomeSource, /\/research\/conditions\?view=review&from=home/g);
  assert.match(conditionsPageSource, /from === "home"/);
  assert.match(conditionsPageSource, /returnHref="\/research"/);
  assert.match(conditionsScreenSource, /returnHref/);
  assert.match(conditionsScreenSource, /router\.replace\(returnHref\)/);
});

test("포트폴리오 빌더는 핵심 성장 기록 네 단계만 구성한다", () => {
  assert.match(portfolioBuilderSource, /type StepId = "topic" \| "professor" \| "paper" \| "revision"/);
  assert.doesNotMatch(portfolioBuilderSource, /id: "prepare"|id: "actions"/);
  assert.match(portfolioBuilderSource, /\{recordedCount\} \/ \{STEP_META\.length\}단계에 기록이 있어요/);
});

test("포트폴리오 빌더는 중간 화면에서 미리보기를 아래로 보내고 큰 화면에서 세 열로 복원한다", () => {
  assert.match(globalStylesSource, /@media \(min-width: 768px\)[\s\S]*?\.pf-layout \{ grid-template-columns: 230px minmax\(0, 1fr\);/);
  assert.match(globalStylesSource, /@media \(min-width: 768px\)[\s\S]*?\.pf-preview-panel \{ grid-column: 1 \/ -1; \}/);
  assert.match(globalStylesSource, /@media \(min-width: 1280px\)[\s\S]*?\.pf-layout \{ grid-template-columns: 248px minmax\(0, 1fr\) 292px; \}/);
  assert.match(globalStylesSource, /@media \(min-width: 1280px\)[\s\S]*?\.pf-preview-panel \{ grid-column: auto; \}/);
});
