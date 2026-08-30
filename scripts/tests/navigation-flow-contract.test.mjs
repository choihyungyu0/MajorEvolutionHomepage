import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".navigation-flow-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/navigation-flow.ts");

let navigationFlow = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/navigation-flow.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "탭 흐름 모듈 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "navigation-flow.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  navigationFlow = await import(pathToFileURL(outputPath).href);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("PDF 뒤로가기는 진입 경로에 따라 3분 카드 또는 만남 준비로 돌아간다", () => {
  assert.ok(navigationFlow, "탭 흐름 모듈이 필요합니다.");
  assert.equal(
    navigationFlow.pdfReaderBackHref("card"),
    "/paper/reader?mode=bite&source=favorites&step=card",
  );
  assert.equal(navigationFlow.pdfReaderBackHref(undefined), "/quest");
});

test("상단 이전 버튼은 실제 부모 화면을 이름으로 안내한다", () => {
  assert.ok(navigationFlow, "탭 흐름 모듈이 필요합니다.");
  assert.equal(navigationFlow.backLabelForDestination("/quest"), "교수 만남 준비로 돌아가기");
  assert.equal(navigationFlow.backLabelForDestination("/professors"), "교수 매칭으로 돌아가기");
  assert.equal(navigationFlow.backLabelForDestination("/research"), "AI 프로젝트 설계로 돌아가기");
  assert.equal(navigationFlow.backLabelForDestination("/project-professors"), "맞춤 교수 추천으로 돌아가기");
  assert.equal(navigationFlow.backLabelForDestination("/project-execution"), "프로젝트 실행 홈으로 돌아가기");
  assert.equal(navigationFlow.backLabelForDestination("/project-meeting"), "프로젝트 자문 준비로 돌아가기");
  assert.equal(navigationFlow.backLabelForDestination("/portfolio"), "나의 성장과정으로 돌아가기");
  assert.equal(
    navigationFlow.backLabelForDestination("/paper/reader?mode=bite&source=favorites&step=card"),
    "3분 카드로 돌아가기",
  );
  assert.equal(
    navigationFlow.backLabelForDestination("/quest/first-line?from=paper"),
    "첫 질문으로 돌아가기",
  );
  assert.equal(navigationFlow.backLabelForDestination("back"), "이전 화면으로 돌아가기");
});

test("내 기록 관리의 복귀 경로는 허용된 진입 화면만 받아 안전하게 정한다", () => {
  assert.ok(navigationFlow, "탭 흐름 모듈이 필요합니다.");
  assert.equal(navigationFlow.portfolioManageReturnHref("professors"), "/professors");
  assert.equal(navigationFlow.portfolioManageReturnHref("profile"), "/profile");
  assert.equal(navigationFlow.portfolioManageReturnHref(undefined), "/profile");
  assert.equal(navigationFlow.portfolioManageReturnHref("https://unsafe.example"), "/profile");
});

test("명시된 복귀는 이력을 교체하고 실제 이력 복귀만 브라우저 back을 사용한다", () => {
  assert.ok(navigationFlow, "탭 흐름 모듈이 필요합니다.");
  assert.deepEqual(navigationFlow.resolveBackNavigation("/professors"), {
    mode: "replace",
    href: "/professors",
  });
  assert.deepEqual(navigationFlow.resolveBackNavigation("back"), { mode: "back" });
  assert.equal(navigationFlow.resolveBackNavigation(undefined), null);
});
