import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadModule(relativePath) {
  const source = readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

const navigation = loadModule("lib/navigation-flow.ts");
const serviceNavigation = loadModule("lib/service-navigation.ts");
const read = (relativePath) => readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  "utf8",
);

const professorScreen = read("components/screens/official-professor-screens.tsx");
const coursesScreen = read("components/screens/official-courses-screen.tsx");
const coursesPage = read("app/professors/[id]/courses/page.tsx");
const homeScreen = read("components/screens/unified-home-screen.tsx");
const questScreen = read("components/screens/quest-hub-screen.tsx");
const portfolioScreen = read("components/screens/portfolio-hub-screen.tsx");
const resultScreen = read("components/screens/research-result.tsx");
const projectHub = read("components/screens/project-professor-hub-screen.tsx");
const projectExecution = read("components/screens/project-execution-home-screen.tsx");
const projectMeeting = read("components/screens/project-meeting-screen.tsx");
const portfolioBuilderPage = read("app/portfolio/builder/page.tsx");
const portfolioBuilder = read("components/screens/portfolio-screen.tsx");

function params(values) {
  return { get: (name) => values[name] ?? null };
}

test("교수 상세 origin은 복귀 화면과 일반·프로젝트 매칭 버킷을 분리한다", () => {
  const cases = [
    ["home", undefined, "/home", "student", "/quest"],
    ["quest", undefined, "/quest", "student", "/quest"],
    ["portfolio", undefined, "/portfolio", "student", "/quest"],
    ["portfolio", "project", "/portfolio", "project", "/project-execution"],
    ["result", undefined, "/result/compare", "project", "/project-execution"],
    ["project", undefined, "/project-professors", "project", "/project-execution"],
    ["project-execution", undefined, "/project-execution", "project", "/project-execution"],
    ["project-meeting", undefined, "/project-meeting", "project", "/project-execution"],
    ["pitch", undefined, "/professors/pitch", "student", "/quest"],
  ];

  for (const [from, journey, backHref, matchBucket, nextHref] of cases) {
    const actual = navigation.professorDetailNavigation(from, journey);
    assert.equal(actual.backHref, backHref, `${from} back`);
    assert.equal(actual.matchBucket, matchBucket, `${from} bucket`);
    assert.equal(actual.nextHref, nextHref, `${from} next`);
  }
});

test("교수 상세·강의정보 query는 origin과 프로젝트 여정을 왕복 보존한다", () => {
  assert.equal(navigation.professorDetailQuery("home"), "?from=home");
  assert.equal(navigation.professorDetailQuery("project-execution"), "?from=project-execution");
  assert.equal(
    navigation.professorDetailQuery("portfolio", "project"),
    "?from=portfolio&journey=project",
  );
  assert.equal(navigation.professorDetailQuery("unsafe"), "");
});

test("교수 상세와 강의정보는 origin별 서비스 탭을 유지한다", () => {
  const cases = [
    ["home", undefined, "/home"],
    ["quest", undefined, "/quest"],
    ["portfolio", undefined, "/portfolio"],
    ["portfolio", "project", "/portfolio"],
    ["result", undefined, "/research"],
    ["project", undefined, "/project-professors"],
    ["project-execution", undefined, "/project-professors"],
    ["project-meeting", undefined, "/project-professors"],
    ["pitch", undefined, "/professors"],
  ];

  for (const [from, journey, section] of cases) {
    const search = params({ from, journey });
    assert.equal(serviceNavigation.resolveServiceSection("/professors/professor-1", search), section);
    assert.equal(serviceNavigation.resolveServiceSection("/professors/professor-1/courses", search), section);
  }
});

test("프로젝트 결과의 상세 근거 조회는 교수를 선택하지 않고 result origin만 전달한다", () => {
  const professorBlock = resultScreen.slice(
    resultScreen.indexOf("function ProfessorBlock"),
    resultScreen.indexOf("export function ResearchResultScreen"),
  );
  assert.match(professorBlock, /\?from=result/);
  assert.doesNotMatch(professorBlock, /onSelectProfessor|onClick=\{\(\) => onSelectProfessor/);
  assert.match(resultScreen, /onBack=\{\(\) => router\.replace\(/);
});

test("각 교수 상세 진입점은 실제 출발 origin을 전달한다", () => {
  assert.match(homeScreen, /\?from=home/);
  assert.match(questScreen, /\?from=quest/);
  assert.match(portfolioScreen, /from=portfolio/);
  assert.match(projectHub, /\?from=project/);
  assert.match(projectExecution, /\?from=project-execution/);
  assert.match(projectMeeting, /\?from=project-meeting/);
});

test("강의정보는 상세 origin query와 breadcrumb를 보존하고 포털 라벨을 정확히 표시한다", () => {
  assert.match(coursesPage, /searchParams/);
  assert.match(coursesPage, /from/);
  assert.match(coursesPage, /journey/);
  assert.match(coursesScreen, /professorDetailQuery/);
  assert.match(coursesScreen, /backHref=\{detailHref\}/);
  assert.match(coursesScreen, /href=\{detailHref\}>교수님 상세/);
  assert.match(coursesScreen, /대학 포털에서 확인/);
  assert.doesNotMatch(coursesScreen, /공식 시간표에서 확인/);
  assert.match(professorScreen, /\/courses\$\{professorDetailQuery\(from, journey\)\}/);
});

test("성장과정의 과거 프로젝트는 기록 화면으로, 유효한 현재 결과만 결과 화면으로 이동한다", () => {
  assert.equal(navigation.growthProjectRecordHref({
    recordTopicId: "topic-old",
    selectedTopicId: "topic-current",
    currentResultTopicIds: ["topic-current", "topic-other"],
  }), "/portfolio/builder?topic=topic-old");
  assert.equal(navigation.growthProjectRecordHref({
    recordTopicId: "topic-current",
    selectedTopicId: "topic-current",
    currentResultTopicIds: ["topic-current", "topic-other"],
  }), "/result");
  assert.equal(navigation.growthProjectRecordHref({
    recordTopicId: "topic-current",
    selectedTopicId: "topic-current",
    currentResultTopicIds: [],
  }), "/portfolio/builder?topic=topic-current");
  assert.match(portfolioScreen, /growthProjectRecordHref/);
  assert.match(portfolioBuilderPage, /searchParams/);
  assert.match(portfolioBuilderPage, /topic/);
  assert.match(portfolioBuilder, /growthProjectHistory\.find\(\(item\) => item\.topicId === topicId\)/);
});

test("직접 교수 찾기 입력 변경은 기존 검색 결과를 지우지 않고 성공 응답에서만 교체한다", () => {
  const form = professorScreen.slice(
    professorScreen.indexOf("export function OfficialProfessorsScreen"),
    professorScreen.indexOf("export function ProfessorPitchScreen"),
  );
  const changed = form.slice(
    form.indexOf("  const markInputsChanged"),
    form.indexOf("  const updateContext"),
  );
  assert.doesNotMatch(changed, /clearProfessorMatches/);
  assert.match(form, /const response = await requestProfessorDiscoveryMatches[\s\S]*setMatches\(response\)/);
});
