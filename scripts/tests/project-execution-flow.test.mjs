import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadModule() {
  const sourceUrl = new URL("../../lib/project-execution.ts", import.meta.url);
  if (!existsSync(fileURLToPath(sourceUrl))) return null;
  const source = readFileSync(sourceUrl, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

const flow = loadModule();

function loadDraftHookModule() {
  const sourceUrl = new URL("../../components/screens/use-project-execution-draft.ts", import.meta.url);
  if (!existsSync(fileURLToPath(sourceUrl))) return null;
  const source = readFileSync(sourceUrl, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const testRequire = (specifier) => {
    if (specifier === "react") return {};
    if (specifier === "@/lib/project-execution") return flow;
    throw new Error(`Unexpected test import: ${specifier}`);
  };
  new Function("exports", "module", "require", compiled)(loaded.exports, loaded, testRequire);
  return loaded.exports;
}

const draftHook = loadDraftHookModule();
const executionStyleSource = readFileSync(
  new URL("../../components/screens/project-execution-screen.module.css", import.meta.url),
  "utf8",
);
const professorStyleSource = readFileSync(
  new URL("../../components/screens/project-professor-hub-screen.module.css", import.meta.url),
  "utf8",
);

function mediaBlock(source, query) {
  const marker = `@media ${query}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${query} 미디어 쿼리가 필요합니다.`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`${query} 미디어 쿼리가 닫히지 않았습니다.`);
}

test("프로젝트 자문은 일반 교수 만남 기록과 다른 저장 키를 사용한다", () => {
  assert.ok(flow, "프로젝트 실행 흐름 모듈이 필요합니다.");
  assert.equal(
    flow.projectExecutionStorageKey("topic-1", "professor-1"),
    "project-execution:topic-1:professor-1",
  );
});

test("새 프로젝트 실행 초안은 교수 자문에 필요한 세 질문과 자료 체크를 준비한다", () => {
  assert.ok(flow, "프로젝트 실행 흐름 모듈이 필요합니다.");
  const draft = flow.createProjectExecutionDraft({
    topicId: "topic-1",
    professorId: "professor-1",
    topicTitle: "친환경 표시 문구 연구",
    topicQuestion: "문구와 가격은 어떤 관계가 있는가?",
    methodDetail: "텍스트 특성 추출과 비교",
  });

  assert.equal(draft.topicId, "topic-1");
  assert.equal(draft.professorId, "professor-1");
  assert.equal(draft.questions.length, 3);
  assert.match(draft.questions[0], /범위/);
  assert.match(draft.questions[1], /텍스트 특성 추출과 비교/);
  assert.deepEqual(Object.keys(draft.materials), [
    "project-brief",
    "evidence",
    "sample-data",
    "decision-log",
  ]);
});

test("실행 홈 진행률은 계획·질문·자료·반영 기록 네 단계를 각각 계산한다", () => {
  assert.ok(flow, "프로젝트 실행 흐름 모듈이 필요합니다.");
  const empty = flow.createProjectExecutionDraft({
    topicId: "topic-1",
    professorId: "professor-1",
    topicTitle: "프로젝트",
    topicQuestion: "질문",
    methodDetail: "방법",
  });
  assert.deepEqual(flow.getProjectExecutionProgress(empty), {
    completed: 1,
    total: 4,
    percent: 25,
    steps: {
      brief: true,
      advisory: false,
      evidence: false,
      reflection: false,
    },
  });

  const complete = {
    ...empty,
    meetingGoal: "분석 범위와 방법을 검증받기",
    questions: ["질문 1", "질문 2", "질문 3"],
    materials: {
      "project-brief": true,
      evidence: true,
      "sample-data": true,
      "decision-log": false,
    },
    reflection: "교수 자문을 반영해 범위를 20개 제품으로 좁혔다.",
  };
  assert.deepEqual(flow.getProjectExecutionProgress(complete), {
    completed: 4,
    total: 4,
    percent: 100,
    steps: {
      brief: true,
      advisory: true,
      evidence: true,
      reflection: true,
    },
  });
});

test("프로젝트 자문 현재 단계는 완료 개수가 아니라 가장 이른 미완료 단계다", () => {
  assert.ok(flow, "프로젝트 실행 흐름 모듈이 필요합니다.");
  assert.equal(flow.getProjectExecutionCurrentStep({
    brief: true,
    advisory: false,
    evidence: true,
    reflection: true,
  }), 1);
  assert.equal(flow.getProjectExecutionCurrentStep({
    brief: true,
    advisory: true,
    evidence: true,
    reflection: true,
  }), null);
});

test("브라우저 저장이 실패하면 화면에서 안내할 오류 상태를 반환한다", () => {
  assert.ok(flow, "프로젝트 실행 흐름 모듈이 필요합니다.");
  const draft = flow.createProjectExecutionDraft({
    topicId: "topic-1",
    professorId: "professor-1",
    topicTitle: "프로젝트",
    topicQuestion: "질문",
    methodDetail: "방법",
  });

  const result = flow.persistProjectExecutionDraft(
    {
      setItem() {
        throw new Error("QuotaExceededError");
      },
    },
    "project-execution:topic-1:professor-1",
    draft,
  );

  assert.equal(result.status, "error");
  assert.match(result.error, /저장하지 못했어요/);
});

test("저장 실패 뒤 다음 저장이 성공하면 오류가 없는 저장 완료 상태를 반환한다", () => {
  assert.ok(flow, "프로젝트 실행 흐름 모듈이 필요합니다.");
  const draft = flow.createProjectExecutionDraft({
    topicId: "topic-1",
    professorId: "professor-1",
    topicTitle: "프로젝트",
    topicQuestion: "질문",
    methodDetail: "방법",
  });
  const stored = new Map();
  let saveState = flow.persistProjectExecutionDraft(
    { setItem() { throw new Error("blocked"); } },
    "project-execution:topic-1:professor-1",
    draft,
  );

  saveState = flow.persistProjectExecutionDraft(
    { setItem(key, value) { stored.set(key, value); } },
    "project-execution:topic-1:professor-1",
    { ...draft, executionPlan: "표본 20개를 수집한다." },
  );

  assert.deepEqual(saveState, { status: "saved", error: null });
  assert.equal(
    JSON.parse(stored.get("project-execution:topic-1:professor-1")).executionPlan,
    "표본 20개를 수집한다.",
  );
});

test("브라우저 저장소 접근 자체가 차단되어도 호출부가 표시할 실패 상태를 반환한다", () => {
  assert.ok(draftHook, "프로젝트 실행 저장 훅 모듈이 필요합니다.");
  const draft = flow.createProjectExecutionDraft({
    topicId: "topic-1",
    professorId: "professor-1",
    topicTitle: "프로젝트",
    topicQuestion: "질문",
    methodDetail: "방법",
  });

  const result = draftHook.persistProjectExecutionDraftFromProvider(
    () => {
      throw new DOMException("Access denied", "SecurityError");
    },
    "project-execution:topic-1:professor-1",
    draft,
  );

  assert.equal(result.status, "error");
  assert.match(result.error, /저장하지 못했어요/);
});

test("701~1279px 프로젝트 액션 도크는 하단 내비 위에 머물고 마지막 콘텐츠 여유를 확보한다", () => {
  for (const source of [executionStyleSource, professorStyleSource]) {
    const tablet = mediaBlock(source, "(min-width: 701px) and (max-width: 1279px)");
    assert.match(
      tablet,
      /\.page\s*\{[^}]*padding-bottom:\s*calc\(176px \+ env\(safe-area-inset-bottom\)\)/,
    );
    assert.match(
      tablet,
      /\.actionDock\s*\{[^}]*bottom:\s*calc\(var\(--app-bottom-nav-height\) \+ env\(safe-area-inset-bottom\) \+ 12px\)/,
    );
    assert.match(tablet, /\.actionDock\s*\{[^}]*z-index:\s*30/);
  }
});

test("390px 프로젝트 액션 도크의 기존 단일 열·하단 내비 여유를 유지한다", () => {
  for (const source of [executionStyleSource, professorStyleSource]) {
    const mobile = mediaBlock(source, "(max-width: 700px)");
    assert.match(
      mobile,
      /\.actionDock\s*\{[^}]*bottom:\s*calc\(var\(--app-bottom-nav-height\) \+ env\(safe-area-inset-bottom\) \+ 8px\)/,
    );
    assert.match(mobile, /\.actionDock\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  }
});
