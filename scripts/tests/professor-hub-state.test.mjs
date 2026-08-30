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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".professor-hub-state-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/professor-hub-home.ts");

let stateModule = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/professor-hub-home.ts",
    reportDiagnostics: true,
  });
  const outputPath = path.join(runtimeDirectory, "professor-hub-home.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  stateModule = require(outputPath);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("재매칭 뒤 현재 후보에서 빠진 즐겨찾기도 성장 기록의 이름과 실제 개수로 보여준다", () => {
  assert.ok(stateModule, "교수 매칭 홈 상태 모듈이 필요합니다.");
  const summary = stateModule.getSavedProfessorSummary({
    favoriteProfessorIds: ["prof-old", "prof-current", "prof-missing"],
    currentProfessors: [{ id: "prof-current", name: "현재 교수" }],
    history: [{ professorId: "prof-old", name: "과거 교수" }],
  });

  assert.equal(summary.count, 3);
  assert.deepEqual(summary.names, ["과거 교수", "현재 교수"]);
  assert.equal(summary.description, "과거 교수 · 현재 교수 · 저장 기록 1명");
});

test("이름 스냅샷을 찾지 못해도 즐겨찾기 개수를 비어 있음으로 낮추지 않는다", () => {
  const summary = stateModule.getSavedProfessorSummary({
    favoriteProfessorIds: ["prof-unknown"],
    currentProfessors: [],
    history: [],
  });

  assert.equal(summary.count, 1);
  assert.deepEqual(summary.names, []);
  assert.equal(summary.description, "저장한 교수 1명의 공식 정보를 다시 확인할 수 있어요.");
});
