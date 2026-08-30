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
const heroStyleSource = fs.readFileSync(
  path.join(repositoryRoot, "components/app/journey-stage-hero.module.css"),
  "utf8",
);

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

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  return 0.2126 * channel(Number.parseInt(hex.slice(1, 3), 16))
    + 0.7152 * channel(Number.parseInt(hex.slice(3, 5), 16))
    + 0.0722 * channel(Number.parseInt(hex.slice(5, 7), 16));
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test("어두운 매칭 히어로의 작은 단계 라벨은 WCAG AA 대비를 확보한다", () => {
  assert.match(
    heroStyleSource,
    /\.hero\[data-journey-stage="match"\] \.eyebrow \{[\s\S]*color: #fff;[\s\S]*background: #26345e;/,
  );
  assert.ok(contrast("#ffffff", "#26345e") >= 4.5);
});
