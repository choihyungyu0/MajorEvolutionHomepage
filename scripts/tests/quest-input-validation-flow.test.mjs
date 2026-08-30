import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".quest-input-validation-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/quest-input-validation.ts");

let validation = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/quest-input-validation.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "퀘스트 입력 검증 모듈 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "quest-input-validation.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  validation = await import(pathToFileURL(outputPath).href);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("빈 첫 문장과 공백만 있는 문장은 저장할 수 없다", () => {
  assert.ok(validation, "퀘스트 입력 검증 모듈이 필요합니다.");
  assert.equal(validation.canSaveFirstLine(""), false);
  assert.equal(validation.canSaveFirstLine("   \n"), false);
  assert.equal(validation.canSaveFirstLine("교수님께 한 가지 여쭙고 싶습니다."), true);
});

test("미니도구는 필요한 입력이 모두 있을 때만 저장할 수 있다", () => {
  assert.ok(validation, "퀘스트 입력 검증 모듈이 필요합니다.");
  assert.equal(validation.canSaveMiniReaction(""), false);
  assert.equal(validation.canSaveMiniReaction("논문의 한 줄 인상"), true);
  assert.equal(validation.canSaveMiniGlossary("용어", ""), false);
  assert.equal(validation.canSaveMiniGlossary("", "내 말 풀이"), false);
  assert.equal(validation.canSaveMiniGlossary("Knowledge integration", "지식을 모아 연결하는 과정"), true);
  assert.equal(validation.canSaveMiniBingo([]), false);
  assert.equal(validation.canSaveMiniBingo(["   ", ""]), false);
  assert.equal(validation.canSaveMiniBingo(["조직 학습"]), true);
});
