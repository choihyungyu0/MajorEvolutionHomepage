import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".mentor-loop-dirty-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/mentor-loop-state.ts");

let mentorState = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/mentor-loop-state.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "멘토 기록 상태 모듈 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "mentor-loop-state.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  mentorState = await import(pathToFileURL(outputPath).href);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

const savedEntry = {
  topicId: "topic-1",
  professorId: "professor-1",
  meetingDate: "2026-08-30",
  feedbackSummary: "질문 범위를 줄인다.",
  recommendedResources: "공개 보고서",
  cautionPoint: "표본 한계",
  before: { question: "기존 질문", methodDetail: "기존 방법", scope: "기존 범위" },
  after: { question: "수정 질문", methodDetail: "수정 방법", scope: "수정 범위" },
  commitment: "변수 정의표를 작성한다.",
  sevenDayActions: ["자료 찾기", "표본 확인", "한쪽 정리"],
  nextCheckAt: "2026-09-06",
  followUpEmail: "감사 메일",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

test("저장 직후에는 저장됨이며 저장 시각만 달라도 재저장 대상으로 만들지 않는다", () => {
  assert.ok(mentorState, "멘토 기록의 저장 상태 판별 모듈이 필요합니다.");
  assert.equal(mentorState.hasUnsavedMentorLoopChanges(savedEntry, savedEntry), false);
  assert.equal(
    mentorState.hasUnsavedMentorLoopChanges(
      { ...savedEntry, updatedAt: "2026-08-30T00:01:00.000Z" },
      savedEntry,
    ),
    false,
  );
});

test("저장 후 내용을 고치면 저장됨 대신 재저장 필요 상태가 된다", () => {
  assert.ok(mentorState, "멘토 기록의 저장 상태 판별 모듈이 필요합니다.");
  assert.equal(
    mentorState.hasUnsavedMentorLoopChanges(
      { ...savedEntry, commitment: "변수 정의표와 샘플을 작성한다." },
      savedEntry,
    ),
    true,
  );
  assert.equal(
    mentorState.hasUnsavedMentorLoopChanges(
      { ...savedEntry, after: { ...savedEntry.after, scope: "수정 범위와 기간" } },
      savedEntry,
    ),
    true,
  );
});
