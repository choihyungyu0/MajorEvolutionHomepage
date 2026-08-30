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
const runtimeDirectory = fs.mkdtempSync(path.join(testDirectory, ".quest-saved-runtime-"));
const sourcePath = path.join(repositoryRoot, "lib/quest-saved-records.ts");

let savedModule = null;
if (fs.existsSync(sourcePath)) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: "lib/quest-saved-records.ts",
    reportDiagnostics: true,
  });
  const outputPath = path.join(runtimeDirectory, "quest-saved-records.cjs");
  fs.writeFileSync(outputPath, compiled.outputText, "utf8");
  savedModule = require(outputPath);
}

after(() => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

test("교수 연결 저장 기록은 만나기 전·대화 중·만난 후로 묶고 프로젝트 실행 기록은 제외한다", () => {
  assert.ok(savedModule, "교수 연결 저장 기록 모듈이 필요합니다.");
  const sections = savedModule.buildProfessorConnectionSavedSections({
    cards: [
      {
        id: "before-card",
        tool: "first-line",
        title: "첫 질문",
        body: "연구를 시작한 계기가 궁금합니다.",
        professorId: "professor-1",
        topicId: "discovery:student-topic",
        updatedAt: "2026-08-31T10:00:00.000Z",
      },
      {
        id: "during-card",
        tool: "silence-rescue",
        title: "대화가 멈췄을 때",
        body: "방법을 조금 더 설명해 주실 수 있나요?",
        professorId: "professor-1",
        topicId: "context:student-topic",
        updatedAt: "2026-08-31T11:00:00.000Z",
      },
      {
        id: "paper-fallback-card",
        tool: "first-line",
        title: "논문에서 이어온 첫 질문",
        body: "이 논문의 후속 연구가 궁금합니다.",
        professorId: "professor-1",
        topicId: "paper:professor-1:paper-1",
        updatedAt: "2026-08-31T11:30:00.000Z",
      },
      {
        id: "project-card",
        tool: "next-seed",
        title: "프로젝트 자문",
        body: "프로젝트 실행 기록",
        professorId: "professor-2",
        topicId: "project-topic-1",
        updatedAt: "2026-08-31T12:00:00.000Z",
      },
    ],
    emailDrafts: {
      "discovery:student-topic:professor-1": {
        topicId: "discovery:student-topic",
        professorId: "professor-1",
        introduction: "안녕하세요.",
        questions: ["질문 1", "질문 2", "질문 3"],
        agenda: "면담 요청",
        emailDraft: "교수님께 드릴 메일",
        updatedAt: "2026-08-31T13:00:00.000Z",
      },
      "project-topic-1:professor-2": {
        topicId: "project-topic-1",
        professorId: "professor-2",
        introduction: "프로젝트 인사",
        questions: ["질문 1", "질문 2", "질문 3"],
        agenda: "프로젝트 자문",
        emailDraft: "프로젝트 메일",
        updatedAt: "2026-08-31T14:00:00.000Z",
      },
    },
    mentorEntries: {
      "context:student-topic:professor-1": {
        topicId: "context:student-topic",
        professorId: "professor-1",
        meetingDate: "2026-08-31",
        feedbackSummary: "교수님 피드백",
        commitment: "다음 주까지 자료 정리",
        updatedAt: "2026-08-31T15:00:00.000Z",
      },
    },
  });

  assert.deepEqual(sections.map((section) => section.id), ["before", "during", "after"]);
  assert.equal(sections.find((section) => section.id === "before").records.length, 3);
  assert.equal(sections.find((section) => section.id === "during").records.length, 1);
  assert.equal(sections.find((section) => section.id === "after").records.length, 1);
  assert.equal(sections.flatMap((section) => section.records).some((record) => record.topicId === "project-topic-1"), false);
});

test("오래되거나 손상된 로컬 저장 기록은 화면을 깨뜨리지 않고 건너뛴다", () => {
  assert.ok(savedModule, "교수 연결 저장 기록 모듈이 필요합니다.");
  assert.doesNotThrow(() => savedModule.buildProfessorConnectionSavedSections({
    cards: [
      { id: "bad-tool", tool: "unknown-tool", professorId: "professor-1", topicId: "discovery:topic" },
      null,
    ],
    emailDrafts: {
      broken: {
        topicId: "context:topic",
        professorId: "professor-1",
        questions: null,
        emailDraft: "깨진 이전 형식",
      },
    },
    mentorEntries: {
      broken: {
        topicId: "paper:professor-1:paper-1",
        professorId: "professor-1",
        feedbackSummary: null,
      },
    },
  }));

  const sections = savedModule.buildProfessorConnectionSavedSections({
    cards: [{ id: "bad-tool", tool: "unknown-tool", professorId: "professor-1", topicId: "discovery:topic" }],
    emailDrafts: { broken: { topicId: "context:topic", professorId: "professor-1", questions: null } },
    mentorEntries: { broken: { topicId: "paper:professor-1:paper-1", professorId: "professor-1", feedbackSummary: null } },
  });
  assert.equal(sections.flatMap((section) => section.records).length, 0);
  assert.doesNotThrow(() => savedModule.buildProfessorConnectionSavedSections({
    cards: null,
    emailDrafts: null,
    mentorEntries: null,
  }));
  const mismatched = savedModule.buildProfessorConnectionSavedSections({
    cards: [],
    emailDrafts: {
      "project-topic:professor-2": {
        topicId: "discovery:student-topic",
        professorId: "professor-1",
        introduction: "잘못 연결된 기록",
        questions: ["질문 1", "질문 2", "질문 3"],
        agenda: "잘못된 키",
        emailDraft: "프로젝트 기록이 섞이면 안 됩니다.",
        updatedAt: "2026-08-31T10:00:00.000Z",
      },
    },
    mentorEntries: {
      "project-topic:professor-2": {
        topicId: "context:student-topic",
        professorId: "professor-1",
        meetingDate: "2026-08-31",
        feedbackSummary: "잘못 연결된 면담 기록",
        commitment: "제외해야 함",
        updatedAt: "2026-08-31T10:00:00.000Z",
      },
    },
  });
  assert.equal(mismatched.flatMap((section) => section.records).length, 0);
});

test("저장 보기 링크는 별도 교수 연결 저장함으로 이동한다", () => {
  const questHub = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/quest-hub-screen.tsx"),
    "utf8",
  );
  const route = path.join(repositoryRoot, "app/quest/saved/page.tsx");
  assert.ok(fs.existsSync(route), "별도 /quest/saved 라우트가 필요합니다.");
  const routeSource = fs.readFileSync(route, "utf8");
  assert.match(routeSource, /export const metadata/);
  assert.match(routeSource, /title: "교수 연결 저장함"/);
  assert.match(questHub, /buildProfessorConnectionSavedSections/);
  assert.match(questHub, /const savedRecordCount = savedSections\.reduce/);
  assert.match(questHub, /status=\{savedRecordCount \? `\$\{savedRecordCount\}개` : "비어 있음"\}/);
  assert.match(questHub, /href="\/quest\/saved"/);
  assert.doesNotMatch(questHub.slice(0, questHub.indexOf("export function QuestAllToolsScreen")), /href="\/quest\/all#saved-cards"/);
  const sitemap = fs.readFileSync(path.join(repositoryRoot, "app/sitemap.ts"), "utf8");
  assert.match(sitemap, /"\/quest\/saved"/);
});

test("저장함은 단계별 기록과 빈 상태에서 준비 도구로 돌아가는 행동을 제공한다", () => {
  const screenPath = path.join(repositoryRoot, "components/screens/quest-saved-screen.tsx");
  assert.ok(fs.existsSync(screenPath), "교수 연결 저장함 화면이 필요합니다.");
  const screen = fs.readFileSync(screenPath, "utf8");
  assert.match(screen, /교수 연결 저장함/);
  assert.match(screen, /buildProfessorConnectionSavedSections/);
  assert.match(screen, /sections\.map/);
  assert.match(screen, /section\.label/);
  assert.match(screen, /저장한 준비 기록이 아직 없어요/);
  assert.match(screen, /같은 도구 열기/);
  assert.match(screen, /aria-label=\{`\$\{record\.label\} 도구 열기`\}/);
  assert.doesNotMatch(screen, /원래 도구에서 보기/);
  assert.doesNotMatch(screen, /<main className=\{styles\.page\}>/);
  assert.match(screen, /href="\/quest\/all"/);
  const styles = fs.readFileSync(
    path.join(repositoryRoot, "components/screens/quest-saved-screen.module.css"),
    "utf8",
  );
  assert.match(styles, /\.hero span,[\s\S]*color: #a43f2b/);
  assert.match(styles, /\.hero p \{[\s\S]*color: #566176/);
  assert.match(styles, /\.recordMeta time \{ color: #5f697c/);
  assert.match(styles, /\.record > small \{[\s\S]*color: #536079/);
});
