import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadModule() {
  const sourceUrl = new URL("../../lib/project-professor-page.ts", import.meta.url);
  if (!existsSync(fileURLToPath(sourceUrl))) return null;
  const source = readFileSync(sourceUrl, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

const page = loadModule();

test("교수 후보는 순위가 아니라 연구주제·연구방법·응용확장 역할 순서로 배치한다", () => {
  assert.ok(page, "프로젝트 교수 추천 페이지 계약 모듈이 필요합니다.");
  const matches = [
    { role: "CONTEXT", professor: { id: "context" } },
    { role: "TOPIC", professor: { id: "topic" } },
    { role: "METHOD", professor: { id: "method" } },
  ];
  assert.deepEqual(page.buildProjectProfessorRoleSlots(matches).map((slot) => ({
    role: slot.role,
    label: slot.label,
    professorId: slot.match?.professor.id ?? null,
  })), [
    { role: "TOPIC", label: "연구주제 멘토", professorId: "topic" },
    { role: "METHOD", label: "연구방법 멘토", professorId: "method" },
    { role: "CONTEXT", label: "응용·확장 멘토", professorId: "context" },
  ]);
});

test("교수를 직접 선택한 뒤에만 프로젝트 실행 홈으로 이동한다", () => {
  assert.ok(page, "프로젝트 교수 추천 페이지 계약 모듈이 필요합니다.");
  assert.deepEqual(page.projectProfessorNextAction(null), {
    label: "면담할 교수님을 선택해 주세요",
    href: null,
    disabled: true,
  });
  assert.deepEqual(page.projectProfessorNextAction("professor-1"), {
    label: "선택한 교수님과 프로젝트 시작하기",
    href: "/project-execution",
    disabled: false,
  });
});

test("프로젝트가 없거나 후보를 고르지 않았을 때 성공 상태를 표시하지 않는다", () => {
  assert.ok(page, "프로젝트 교수 추천 페이지 계약 모듈이 필요합니다.");

  assert.deepEqual(page.projectProfessorPagePresentation({
    hasResult: false,
    hasSelectedTopic: false,
    matchStatus: "idle",
    hasMatches: false,
  }), {
    state: "missing-result",
    eyebrow: "프로젝트 실행 · 준비 전",
    title: "프로젝트를 먼저 설계해 볼까요?",
    description: "프로젝트의 문제·방법·범위를 정한 뒤 자문 교수를 연결할 수 있어요.",
    steps: ["pending", "pending", "pending"],
  });

  assert.deepEqual(page.projectProfessorPagePresentation({
    hasResult: true,
    hasSelectedTopic: false,
    matchStatus: "idle",
    hasMatches: false,
  }), {
    state: "missing-selection",
    eyebrow: "프로젝트 실행 · 1단계",
    title: "프로젝트 후보를 먼저 선택해 주세요",
    description: "후보를 고르고 상세 근거를 확인하면 프로젝트에 필요한 자문 역할을 연결해요.",
    steps: ["current", "pending", "pending"],
  });
});

test("교수 추천 진행·실패·성공 상태는 서로 다른 hero와 3단계 상태를 제공한다", () => {
  assert.ok(page, "프로젝트 교수 추천 페이지 계약 모듈이 필요합니다.");

  const idle = page.projectProfessorPagePresentation({
    hasResult: true,
    hasSelectedTopic: true,
    matchStatus: "idle",
    hasMatches: false,
  });
  assert.equal(idle.state, "idle");
  assert.equal(idle.title, "선택한 프로젝트의 상세 근거를 확인해 주세요");
  assert.deepEqual(idle.steps, ["complete", "current", "pending"]);

  const loading = page.projectProfessorPagePresentation({
    hasResult: true,
    hasSelectedTopic: true,
    matchStatus: "loading",
    hasMatches: false,
  });
  assert.equal(loading.state, "loading");
  assert.equal(loading.title, "프로젝트에 맞는 자문 교수를 찾고 있어요");
  assert.deepEqual(loading.steps, ["complete", "complete", "current"]);

  const error = page.projectProfessorPagePresentation({
    hasResult: true,
    hasSelectedTopic: true,
    matchStatus: "error",
    hasMatches: false,
  });
  assert.equal(error.state, "error");
  assert.equal(error.title, "교수 추천을 완료하지 못했어요");
  assert.deepEqual(error.steps, ["complete", "complete", "error"]);

  const success = page.projectProfessorPagePresentation({
    hasResult: true,
    hasSelectedTopic: true,
    matchStatus: "success",
    hasMatches: true,
  });
  assert.equal(success.state, "success");
  assert.equal(success.title, "이 프로젝트에 맞는 자문 교수를 연결했어요");
  assert.deepEqual(success.steps, ["complete", "complete", "current"]);
});

test("프로젝트 실행·자문 빈 상태는 후보 존재와 선택 상태에 따라 복구 경로를 구분한다", () => {
  assert.ok(page, "프로젝트 교수 추천 페이지 계약 모듈이 필요합니다.");

  assert.deepEqual(page.projectEntryRecoveryAction({
    hasCandidateResult: false,
    hasSelectedTopic: false,
  }), {
    state: "missing-result",
    href: "/research",
    label: "프로젝트 설계 시작하기",
  });
  assert.deepEqual(page.projectEntryRecoveryAction({
    hasCandidateResult: true,
    hasSelectedTopic: false,
  }), {
    state: "missing-selection",
    href: "/result",
    label: "프로젝트 후보 선택하기",
  });
  assert.equal(page.projectEntryRecoveryAction({
    hasCandidateResult: true,
    hasSelectedTopic: true,
  }), null);
});

test("이미 선택된 교수 버튼은 다시 선택할 수 없게 만든다", () => {
  assert.ok(page, "프로젝트 교수 추천 페이지 계약 모듈이 필요합니다.");
  assert.deepEqual(page.projectProfessorSelectionButton(false), {
    label: "이 교수님 선택",
    disabled: false,
  });
  assert.deepEqual(page.projectProfessorSelectionButton(true), {
    label: "선택한 교수님",
    disabled: true,
  });
});
