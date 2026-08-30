import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".first-line-runtime-"));

const sourcePath = path.join(repositoryRoot, "lib/first-line.ts");
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: "lib/first-line.ts",
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics ?? []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);
assert.equal(errors.length, 0, "첫 질문 모듈 테스트용 변환에 실패했습니다.");
const outputPath = path.join(runtimeDirectory, "first-line.cjs");
fs.writeFileSync(outputPath, compiled.outputText, "utf8");
const firstLine = await import(pathToFileURL(outputPath).href);

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("첫 질문은 이메일과 같은 네 가지 대표 목적을 제공한다", () => {
  assert.deepEqual(
    firstLine.PURPOSES.map((purpose) => purpose.id),
    ["career", "research-interest", "project-review", "mentoring"],
  );
  assert.deepEqual(
    firstLine.PURPOSES.map((purpose) => purpose.label),
    ["진로·수업 고민 상담", "논문·연구과제 관심", "내 프로젝트 아이디어 점검", "멘토링·면담 요청"],
  );
});

test("각 목적은 같은 맥락으로 표현이 다른 첫 문장 세 개를 만든다", () => {
  for (const purpose of firstLine.PURPOSES) {
    const sentences = firstLine.buildFirstLines({
      situation: "after-class",
      purpose: purpose.id,
      evidence: "식품 산업 진로와 로컬푸드 프로젝트 고민",
      shuffle: 0,
    });
    assert.equal(sentences.length, 3, purpose.id);
    assert.ok(sentences.every((sentence) => sentence.purposeLabel === purpose.label));
    assert.equal(new Set(sentences.map((sentence) => sentence.text)).size, 3);
  }
});

test("교수님을 찾아뵙는 상황은 오피스아워 대신 연구실로 안내한다", () => {
  const officeSituation = firstLine.SITUATIONS.find((situation) => situation.id === "office-hour");
  assert.equal(officeSituation?.label, "연구실");
  assert.match(officeSituation?.hint ?? "", /연구실/);

  const sentences = firstLine.buildFirstLines({
    situation: "office-hour",
    purpose: "mentoring",
    evidence: "전공과 진로 방향",
    shuffle: 0,
  });
  assert.ok(sentences.every((sentence) => sentence.text.includes("연구실")));
  assert.ok(sentences.every((sentence) => !sentence.text.includes("오피스아워")));
});

test("첫 문장은 차분·밝은·공손 말투 중 하나를 골라 한 개만 만든다", () => {
  assert.ok(Array.isArray(firstLine.TONES), "첫 문장 말투 선택지가 필요합니다.");
  assert.deepEqual(
    firstLine.TONES.map((tone) => tone.id),
    ["calm", "bright", "polite"],
  );
  assert.deepEqual(
    firstLine.TONES.map((tone) => tone.label),
    ["차분하게", "밝게", "공손하게"],
  );
  assert.equal(typeof firstLine.buildFirstLine, "function");

  const results = firstLine.TONES.map((tone) => firstLine.buildFirstLine({
    situation: "after-class",
    purpose: "career",
    tone: tone.id,
    evidence: "식품 산업 진로",
    shuffle: 0,
  }));
  assert.ok(results.every(Boolean));
  assert.equal(new Set(results.map((result) => result.text)).size, 3);
  assert.deepEqual(results.map((result) => result.toneLabel), ["차분하게", "밝게", "공손하게"]);
});

test("다시 섞기는 선택한 말투를 유지하면서 문장 표현만 바꾼다", () => {
  assert.equal(typeof firstLine.buildFirstLine, "function");
  const first = firstLine.buildFirstLine({
    situation: "email",
    purpose: "mentoring",
    tone: "polite",
    evidence: "전공과 진로 방향",
    shuffle: 0,
  });
  const shuffled = firstLine.buildFirstLine({
    situation: "email",
    purpose: "mentoring",
    tone: "polite",
    evidence: "전공과 진로 방향",
    shuffle: 1,
  });
  assert.equal(first?.toneLabel, "공손하게");
  assert.equal(shuffled?.toneLabel, "공손하게");
  assert.notEqual(first?.text, shuffled?.text);
});
