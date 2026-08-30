import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".journey-progress-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/journey-progress.ts");

let progressModule = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: "lib/journey-progress.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "진행률 계산 모듈 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "journey-progress.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  progressModule = await import(pathToFileURL(outputPath).href);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

const current = { topicId: "topic-current", professorId: "prof-current" };
const card = (id, tool, body, overrides = {}) => ({
  id,
  tool,
  body,
  professorId: current.professorId,
  topicId: current.topicId,
  bundleId: null,
  ...overrides,
});

test("현재 교수와 주제의 고유 준비물만 홈과 퀘스트 진행률에 반영한다", () => {
  assert.ok(progressModule, "현재 여정 진행률 계산 모듈이 필요합니다.");
  const progress = progressModule.getJourneyProgress({
    ...current,
    cards: [
      card("paper-1", "paper-bite", "문제 카드", { bundleId: "paper-bundle" }),
      card("paper-2", "paper-bite", "방법 카드", { bundleId: "paper-bundle" }),
      card("question-1", "first-line", "교수님께 질문드리고 싶습니다."),
      card("question-empty", "first-line", "   "),
      card("other-professor", "first-line", "다른 교수 카드", { professorId: "prof-other" }),
      card("other-topic", "silence-rescue", "다른 주제 카드", { topicId: "topic-other" }),
      card("during-1", "silence-rescue", "현재 대화 중 질문"),
      card("after-1", "next-seed", "현재 면담 후 행동"),
    ],
    emailDrafts: {
      "topic-current:prof-current:email:career:no-paper:no-first-line": { emailDraft: "새 형식" },
      "topic-current:prof-current:email:mentoring:paper:first-line": { emailDraft: "목적 변형" },
      "topic-current:prof-current": { emailDraft: "레거시" },
      "topic-current:prof-other:email:career:no-paper:no-first-line": { emailDraft: "다른 교수" },
    },
    mentorEntries: {
      "topic-current:prof-current": { commitment: "현재 약속" },
      "topic-other:prof-current": { commitment: "다른 주제" },
    },
  });

  assert.deepEqual(progress.before, { paper: 1, question: 1, email: 1, total: 3 });
  assert.deepEqual(progress.during, { total: 1 });
  assert.deepEqual(progress.after, { total: 2 });
  assert.equal(progress.readySteps.professor, true);
  assert.equal(progress.readySteps.before, true);
  assert.equal(progress.readySteps.during, true);
  assert.equal(progress.readySteps.after, true);
  assert.equal(progress.preparedItemCount, 6);
});

test("교수나 주제가 없으면 저장된 준비물이 있어도 교수별 진행 완료가 아니다", () => {
  assert.ok(progressModule, "현재 여정 진행률 계산 모듈이 필요합니다.");
  const progress = progressModule.getJourneyProgress({
    topicId: "topic-current",
    professorId: null,
    cards: [card("question-1", "first-line", "질문")],
    emailDrafts: { "topic-current:prof-current": { emailDraft: "레거시" } },
    mentorEntries: { "topic-current:prof-current": { commitment: "약속" } },
  });

  assert.deepEqual(progress.before, { paper: 0, question: 0, email: 0, total: 0 });
  assert.equal(progress.readySteps.professor, false);
  assert.equal(progress.readySteps.before, false);
  assert.equal(progress.preparedItemCount, 0);
});

test("현재 이메일 초안은 새 키와 이전 키를 모두 인식하되 목적별 변형은 한 번만 센다", () => {
  assert.ok(progressModule, "현재 여정 진행률 계산 모듈이 필요합니다.");
  assert.equal(
    progressModule.hasEmailDraftForJourney(
      {
        "topic-current:prof-current": { emailDraft: "이전 초안" },
        "topic-current:prof-current:email:career:no-paper": { emailDraft: "이전 새 키" },
        "topic-current:prof-current:email:research-interest:paper:first-line": { emailDraft: "현재 새 키" },
      },
      current.topicId,
      current.professorId,
    ),
    true,
  );
  const progress = progressModule.getJourneyProgress({
    ...current,
    cards: [],
    emailDrafts: {
      "topic-current:prof-current:email:career:no-paper:no-first-line": { emailDraft: "A" },
      "topic-current:prof-current:email:mentoring:paper:first-line": { emailDraft: "B" },
    },
    mentorEntries: {},
  });
  assert.equal(progress.before.email, 1);
});

test("콜론이 포함된 교수 탐색 주제 ID의 이메일 초안도 현재 여정으로 인식한다", () => {
  assert.equal(
    progressModule.hasEmailDraftForJourney(
      {
        "discovery:career-data:prof-current:email:career:no-paper:no-first-line": {
          emailDraft: "탐색 주제 초안",
        },
      },
      "discovery:career-data",
      "prof-current",
    ),
    true,
  );
});
