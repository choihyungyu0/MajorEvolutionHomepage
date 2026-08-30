import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".result-flow-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/result-page-flow.ts");

let resultFlow = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/result-page-flow.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "결과 페이지 흐름 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "result-page-flow.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  resultFlow = require(outputPath);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("프로젝트 결과는 후보 이해·근거 비교·교수 연결의 서로 다른 페이지로 이어진다", () => {
  assert.ok(resultFlow, "결과 페이지 흐름 모듈이 필요합니다.");
  assert.deepEqual(resultFlow.RESULT_PAGE_STEPS, [
    { id: "summary", label: "후보 선택", href: "/result" },
    { id: "compare", label: "근거 더보기", href: "/result/compare" },
    { id: "professors", label: "교수 연결", href: "/project-professors" },
  ]);
});

test("후보를 고르면 상세 근거를 확인한 뒤 교수 연결로 이어진다", () => {
  assert.ok(resultFlow, "결과 페이지 흐름 모듈이 필요합니다.");
  assert.deepEqual(resultFlow.resultPagePrimaryAction("summary", false), {
    label: "연결할 후보를 먼저 선택해 주세요",
    href: null,
    disabled: true,
  });
  assert.deepEqual(resultFlow.resultPagePrimaryAction("summary", true), {
    label: "선택한 후보 자세히 보기",
    href: "/result/compare",
    disabled: false,
  });
  assert.deepEqual(resultFlow.resultPagePrimaryAction("compare", false), {
    label: "연결할 후보를 먼저 선택해 주세요",
    href: null,
    disabled: true,
  });
  assert.deepEqual(resultFlow.resultPagePrimaryAction("compare", true), {
    label: "선택한 주제로 교수 찾기",
    href: "/project-professors",
    disabled: false,
  });
  assert.deepEqual(resultFlow.resultPagePrimaryAction("compare", true, false), {
    label: "학교 확인하고 교수 찾기",
    href: "/research/conditions?view=review",
    disabled: false,
  });
});

test("교수 요청 중 후보가 바뀌면 이전 응답으로 교수 화면에 이동하지 않는다", () => {
  assert.equal(typeof resultFlow.projectProfessorRequestCompleted, "function");
  assert.equal(resultFlow.projectProfessorRequestCompleted({
    requestedTopicId: "topic-a",
    selectedTopicId: "topic-b",
    matchTopicId: null,
    status: "idle",
  }), false);
  assert.equal(resultFlow.projectProfessorRequestCompleted({
    requestedTopicId: "topic-a",
    selectedTopicId: "topic-a",
    matchTopicId: "topic-a",
    status: "success",
  }), true);
});
