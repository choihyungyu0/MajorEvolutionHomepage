import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTypeScriptModule(path) {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

const suggestionModule = loadTypeScriptModule("lib/ai-growth-professor.ts");
const conversationMapModule = loadTypeScriptModule("lib/ai-conversation-map.ts");

test("추천 3개 중 앞의 두 개는 직렬이고 세 번째만 선택적으로 새 갈래가 된다", () => {
  assert.equal(
    typeof suggestionModule.normalizeGrowthProfessorSuggestions,
    "function",
    "추천 유형 정규화 함수가 필요합니다.",
  );

  assert.deepEqual(suggestionModule.normalizeGrowthProfessorSuggestions([
    "지금 답변을 더 구체화해 주세요",
    { text: "필요한 자료부터 알려 주세요", kind: "branch" },
    { text: "다른 목표로 보면 무엇이 달라질까요?", kind: "branch", axis: "clarify" },
    { text: "네 번째 추천은 보이지 않아야 해요", kind: "branch" },
  ]), [
    {
      text: "이 내용을 더 쉽게 이해하려면 무엇부터 보면 좋을까요?",
      kind: "continue",
      axis: "clarify",
    },
    {
      text: "제가 먼저 확인해야 할 자료는 무엇인가요?",
      kind: "continue",
      axis: "evidence_action",
    },
    {
      text: "다른 목표로 보면 무엇이 달라질까요?",
      kind: "branch",
      axis: "alternative",
    },
  ]);

  assert.equal(typeof suggestionModule.isStudentQuestionText, "function");
  assert.equal(suggestionModule.isStudentQuestionText("제가 놓친 기준은 무엇인가요?"), true);
  assert.equal(suggestionModule.isStudentQuestionText("오늘 바로 자료를 모아볼게요"), false);

  assert.equal(
    typeof suggestionModule.resolveGrowthProfessorSuggestionParentId,
    "function",
    "추천 유형에 따라 부모 갈래를 정하는 함수가 필요합니다.",
  );
  assert.equal(
    suggestionModule.resolveGrowthProfessorSuggestionParentId(
      { text: "현재 내용을 더 이해하려면 무엇을 봐야 하나요?", kind: "continue", axis: "clarify" },
      "assistant-1",
    ),
    null,
  );
  assert.equal(
    suggestionModule.resolveGrowthProfessorSuggestionParentId(
      { text: "이 과거 생각을 더 이해하려면 무엇을 봐야 하나요?", kind: "continue", axis: "clarify" },
      "assistant-1",
      true,
    ),
    "assistant-1",
    "과거 카드에서 이어가는 중에는 직렬 추천도 선택한 카드를 부모로 유지해야 합니다.",
  );
  assert.equal(
    suggestionModule.resolveGrowthProfessorSuggestionParentId(
      { text: "다른 관점에서는 무엇이 달라질까요?", kind: "branch", axis: "alternative" },
      "assistant-1",
    ),
    "assistant-1",
  );
});

test("한 부모 카드에 실제 자식 대화가 두 개 이상일 때만 병렬 갈래로 판정한다", () => {
  assert.equal(
    typeof conversationMapModule.getParallelBranchParentIds,
    "function",
    "실제 병렬 갈래 부모를 계산하는 함수가 필요합니다.",
  );

  const createdAt = "2026-08-30T00:00:00.000Z";
  const user = (id, content, branchParentMessageId = null) => ({
    id,
    role: "user",
    content,
    createdAt,
    branchParentMessageId,
    reflection: null,
    suggestedPrompts: [],
  });
  const assistant = (id, title) => ({
    id,
    role: "assistant",
    content: `${title} 답변`,
    createdAt,
    branchParentMessageId: null,
    reflection: { title, body: `현재 고민: ${title}` },
    suggestedPrompts: [],
  });

  const singlePath = [
    user("u1", "처음 질문"),
    assistant("a1", "처음 생각"),
    user("u2", "다른 관점 질문", "a1"),
    assistant("a2", "다른 관점"),
  ];
  assert.deepEqual([...conversationMapModule.getParallelBranchParentIds(singlePath)], []);
  assert.equal(
    typeof conversationMapModule.shouldShowParallelBranchLabel,
    "function",
    "실제 병렬 갈래에만 라벨을 붙이는 함수가 필요합니다.",
  );
  assert.equal(conversationMapModule.shouldShowParallelBranchLabel(singlePath, "u2"), false);
  assert.equal(
    typeof conversationMapModule.getParallelBranchUserMessageIds,
    "function",
    "병렬 갈래에 속한 사용자 메시지를 한 번에 계산하는 함수가 필요합니다.",
  );
  assert.deepEqual([...conversationMapModule.getParallelBranchUserMessageIds(singlePath)], []);

  const parallelPaths = [
    ...singlePath,
    user("u3", "두 번째 관점 질문", "a1"),
    assistant("a3", "두 번째 관점"),
  ];
  assert.deepEqual([...conversationMapModule.getParallelBranchParentIds(parallelPaths)], ["a1"]);
  assert.equal(conversationMapModule.shouldShowParallelBranchLabel(parallelPaths, "u2"), true);
  assert.equal(conversationMapModule.shouldShowParallelBranchLabel(parallelPaths, "u3"), true);
  assert.equal(conversationMapModule.shouldShowParallelBranchLabel(parallelPaths, "u1"), false);
  assert.deepEqual(
    [...conversationMapModule.getParallelBranchUserMessageIds(parallelPaths)],
    ["u2", "u3"],
  );
});
