import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".email-purpose-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/email-draft-purpose.ts");

let purposeModule = null;
if (fs.existsSync(sourcePath)) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: "lib/email-draft-purpose.ts",
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "이메일 목적 모듈 테스트용 변환에 실패했습니다.");
  const outputPath = path.join(runtimeDirectory, "email-draft-purpose.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  purposeModule = await import(pathToFileURL(outputPath).href);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

const context = {
  topicId: "topic-1",
  topicTitle: "식품 산업 진로와 로컬푸드 프로젝트",
  topicQuestion: "식품 산업에서 어떤 진로 경험부터 시작해야 할까요?",
  methodDetail: "공개 자료를 읽고 작은 현장 조사를 진행",
  professorId: "professor-1",
  professorName: "정다은",
  professorTitle: "교수",
  researchField: "농식품 경제",
  paperTitle: "로컬푸드를 통한 친환경 농업 활성화 방안",
  firstLine: "이 분야에서 학부생이 먼저 해볼 경험은 무엇인가요?",
};

test("대표 목적 네 가지가 서로 다른 제목과 상담 초안을 만든다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  const purposes = ["career", "research-interest", "project-review", "mentoring"];
  const drafts = purposes.map((purpose) => purposeModule.buildEmailDraft({
    ...context,
    purpose,
    includePaper: false,
    includeFirstLine: false,
  }));

  assert.equal(new Set(drafts.map((draft) => draft.emailDraft.split("\n")[0])).size, 4);
  assert.match(drafts[0].emailDraft, /진로 상담 요청/);
  assert.match(drafts[1].emailDraft, /연구 관심 문의/);
  assert.match(drafts[2].emailDraft, /프로젝트 점검 요청/);
  assert.match(drafts[3].emailDraft, /멘토링 상담 요청/);
  assert.ok(drafts.every((draft) => !draft.emailDraft.includes(context.paperTitle)));
});

test("논문 포함을 선택한 초안만 선택 논문 제목을 사용한다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  const withoutPaper = purposeModule.buildEmailDraft({
    ...context,
    purpose: "research-interest",
    includePaper: false,
    includeFirstLine: false,
  });
  const withPaper = purposeModule.buildEmailDraft({
    ...context,
    purpose: "research-interest",
    includePaper: true,
    includeFirstLine: false,
  });

  assert.doesNotMatch(withoutPaper.emailDraft, /로컬푸드를 통한 친환경 농업 활성화 방안/);
  assert.match(withPaper.emailDraft, /로컬푸드를 통한 친환경 농업 활성화 방안/);
  assert.match(withPaper.questions.join("\n"), /로컬푸드를 통한 친환경 농업 활성화 방안/);
});

test("목적과 논문 포함 여부마다 수정본 저장 키가 분리된다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  const keys = [
    purposeModule.emailDraftStorageKey("topic-1", "professor-1", "career", false, false),
    purposeModule.emailDraftStorageKey("topic-1", "professor-1", "career", false, true),
    purposeModule.emailDraftStorageKey("topic-1", "professor-1", "project-review", true, false),
    purposeModule.emailDraftStorageKey("topic-1", "professor-1", "project-review", true, true),
  ];
  assert.equal(new Set(keys).size, 4);
});

test("현재 교수와 일치하는 논문만 이메일 포함 후보로 사용한다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  const selection = {
    professorId: "professor-1",
    title: context.paperTitle,
  };
  assert.equal(
    purposeModule.paperTitleForProfessor(selection, "professor-1"),
    context.paperTitle,
  );
  assert.equal(
    purposeModule.paperTitleForProfessor(selection, "professor-2"),
    null,
  );
  assert.equal(purposeModule.paperTitleForProfessor(null, "professor-1"), null);
});

test("논문 활용은 선택 단계로 표시하고 메일과 미니도구 주소를 제공한다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  assert.deepEqual(
    purposeModule.PAPER_TO_EMAIL_STEPS.map((step) => step.label),
    ["논문 선택", "3분 카드", "PDF 해설", "첫 질문", "메일 초안"],
  );
  assert.match(purposeModule.PAPER_TO_EMAIL_STEPS[1].description, /선택/);
  assert.match(purposeModule.PAPER_TO_EMAIL_STEPS[2].description, /선택/);
  assert.equal(
    purposeModule.PAPER_TO_EMAIL_STEPS[3].href,
    "/quest/first-line?from=paper",
  );
  assert.equal(
    purposeModule.PAPER_TO_EMAIL_STEPS[4].href,
    "/quest/email-guard?from=first-line",
  );
  assert.equal(purposeModule.FIRST_QUESTION_FROM_PAPER_HREF, "/quest/first-line?from=paper");
  assert.equal(purposeModule.EMAIL_FROM_FIRST_QUESTION_HREF, "/quest/email-guard?from=first-line");
  assert.equal(purposeModule.MINI_TOOL_SHUFFLE_HREF, "/quest/mini-tools#shuffle");
  assert.equal(purposeModule.MINI_TOOLS_HREF, "/quest/mini-tools#all-tools");
});

test("선택한 첫 질문은 요청할 때만 이메일과 질문 목록에 이어진다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  const withoutFirstLine = purposeModule.buildEmailDraft({
    ...context,
    purpose: "career",
    includePaper: false,
    includeFirstLine: false,
  });
  const withFirstLine = purposeModule.buildEmailDraft({
    ...context,
    purpose: "career",
    includePaper: false,
    includeFirstLine: true,
  });
  assert.doesNotMatch(withoutFirstLine.emailDraft, /학부생이 먼저 해볼 경험/);
  assert.match(withFirstLine.emailDraft, /학부생이 먼저 해볼 경험/);
  assert.equal(withFirstLine.questions[0], context.firstLine);
});

test("첫 질문 카드 제목에서 이메일 목적과 이메일용 질문을 복원한다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  assert.equal(
    purposeModule.emailPurposeFromFirstLineTitle("수업 후 · 멘토링·면담 요청"),
    "mentoring",
  );
  assert.equal(
    purposeModule.firstQuestionForEmail(
      "교수님, 수업 마치고 잠깐 여쭤도 될까요? 이 분야에서 먼저 해볼 경험은 무엇인가요?",
      "수업 후 · 진로·수업 고민 상담",
    ),
    "이 분야에서 먼저 해볼 경험은 무엇인가요?",
  );
  assert.equal(
    purposeModule.firstQuestionForEmail(
      "교수님, 연구실에 찾아뵈어도 될지 여쭙습니다. 제 진로 방향에서 먼저 점검할 기준은 무엇일까요?",
      "연구실 · 멘토링·면담 요청",
    ),
    "제 진로 방향에서 먼저 점검할 기준은 무엇일까요?",
  );
});

test("이메일 하단은 서비스 홈과 면담 후 기록으로 각각 이동한다", () => {
  assert.ok(purposeModule, "목적별 이메일 초안 모듈이 필요합니다.");
  assert.deepEqual(purposeModule.emailGuardStickyActions(), [
    { id: "home", label: "홈으로", href: "/home", secondary: true },
    {
      id: "feedback",
      label: "면담 후 피드백 기록",
      href: "/mentor-loop",
      secondary: false,
    },
  ]);
});
