import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".mentor-selection-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/professor-mentor-selection.ts");
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: "lib/professor-mentor-selection.ts",
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics ?? []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);
assert.equal(errors.length, 0);
const outputPath = path.join(runtimeDirectory, "professor-mentor-selection.cjs");
fs.writeFileSync(outputPath, compiled.outputText, "utf8");
const selection = await import(pathToFileURL(outputPath).href);

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

const match = (role, id) => ({ role, professor: { id } });
const candidates = [
  match("TOPIC", "p1"), match("TOPIC", "p2"),
  match("METHOD", "p1"), match("METHOD", "p3"),
  match("CONTEXT", "p3"), match("CONTEXT", "p4"),
];

test("AI가 같은 교수를 중복 선택하면 공식 후보의 다음 교수로 역할을 완성한다", () => {
  const proposed = [match("TOPIC", "p1"), match("METHOD", "p1"), match("CONTEXT", "p3")];
  const completed = selection.completeProfessorMentorSelections(proposed, candidates);
  assert.deepEqual(completed.map((item) => item.role), ["TOPIC", "METHOD", "CONTEXT"]);
  assert.equal(new Set(completed.map((item) => item.professor.id)).size, 3);
  assert.deepEqual(completed.map((item) => item.professor.id), ["p1", "p3", "p4"]);
});

test("공식 후보 풀에 중복 없는 세 역할이 없으면 결과를 만들지 않는다", () => {
  const incomplete = [match("TOPIC", "p1"), match("METHOD", "p1"), match("CONTEXT", "p1")];
  assert.equal(selection.completeProfessorMentorSelections(incomplete, incomplete), null);
});
