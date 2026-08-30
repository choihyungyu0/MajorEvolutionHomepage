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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".journey-theme-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/journey-stage-theme.ts");

let themeModule = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/journey-stage-theme.ts",
    reportDiagnostics: true,
  });
  const outputPath = path.join(runtimeDirectory, "journey-stage-theme.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  themeModule = require(outputPath);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("매칭·프로젝트·추천·만남 단계는 서로 다른 배경 자산과 강조색을 사용한다", () => {
  assert.ok(themeModule, "단계별 시각 테마 모듈이 필요합니다.");
  const stages = ["match", "project", "recommend", "meeting"];
  const themes = stages.map((stage) => themeModule.getJourneyStageTheme(stage));

  assert.equal(new Set(themes.map((theme) => theme.backgroundImage)).size, 4);
  assert.equal(new Set(themes.map((theme) => theme.accent)).size, 4);
  assert.deepEqual(themes.map((theme) => theme.label), ["교수 매칭", "프로젝트 설계", "맞춤 교수 추천", "만남 준비"]);
});

test("모든 단계 테마는 밝은 히어로에서 읽을 수 있는 전경색과 배경 대체색을 제공한다", () => {
  for (const stage of ["match", "project", "recommend", "meeting"]) {
    const theme = themeModule.getJourneyStageTheme(stage);
    assert.match(theme.foreground, /^#[0-9a-f]{6}$/i);
    assert.match(theme.fallbackBackground, /^#[0-9a-f]{6}$/i);
  }
});
