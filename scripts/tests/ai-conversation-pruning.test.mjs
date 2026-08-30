import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadConversationMapModule() {
  const source = readFileSync(new URL("../../lib/ai-conversation-map.ts", import.meta.url), "utf8");
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

const map = loadConversationMapModule();
const storeSource = readFileSync(new URL("../../store/ai-professor-store.ts", import.meta.url), "utf8");
const createdAt = "2026-08-30T00:00:00.000Z";

function user(id, content, branchParentMessageId = null) {
  return {
    id,
    role: "user",
    content,
    createdAt,
    branchParentMessageId,
    reflection: null,
    suggestedPrompts: [],
  };
}

function assistant(id, title) {
  return {
    id,
    role: "assistant",
    content: `${title} 답변`,
    createdAt,
    branchParentMessageId: null,
    reflection: { title, body: `현재 고민: ${title}` },
    suggestedPrompts: [],
  };
}

function fixtureNodes() {
  return map.buildConversationMap([
    user("u1", "처음 질문"),
    assistant("a1", "첫 생각"),
    user("u2", "현재 방향 이어가기"),
    assistant("a2", "현재 방향"),
    user("u3", "다른 관점 질문", "a1"),
    assistant("a3", "다른 관점"),
    user("u4", "다른 관점의 다음 행동"),
    assistant("a4", "다음 행동"),
  ], []);
}

test("선택한 카드의 하위 가지를 원문 삭제 없이 하나의 서브트리로 계산한다", () => {
  assert.equal(typeof map.getConversationSubtreeIds, "function", "하위 가지 계산 함수가 필요합니다.");
  const nodes = fixtureNodes();
  assert.deepEqual(map.getConversationSubtreeIds(nodes, "a3"), ["a3", "a4"]);
  assert.deepEqual(map.getConversationSubtreeIds(nodes, "missing"), []);
  assert.equal(nodes.length, 4, "가지 계산은 원본 노드를 수정하면 안 됩니다.");
});

test("제외한 카드의 하위 가지 전체를 숨기고 자식을 새 루트로 올리지 않는다", () => {
  assert.equal(typeof map.getExcludedConversationNodeIds, "function", "제외 가지 계산 함수가 필요합니다.");
  assert.equal(typeof map.getRenderableConversationMapNodes, "function", "지도 표시 노드 계산 함수가 필요합니다.");
  const nodes = fixtureNodes();
  const decisions = { a3: "exclude" };

  assert.deepEqual([...map.getExcludedConversationNodeIds(nodes, decisions)], ["a3", "a4"]);
  const visible = map.getRenderableConversationMapNodes(nodes, decisions, []);
  assert.deepEqual(visible.map((node) => node.id), ["a1", "a2"]);
  assert.deepEqual(map.getConversationMapRoots(visible).map((node) => node.id), ["a1"]);
});

test("접은 카드는 남기고 하위 카드만 지도 렌더링에서 숨긴다", () => {
  assert.equal(typeof map.getCollapsedConversationDescendantIds, "function", "접힌 가지 계산 함수가 필요합니다.");
  const nodes = fixtureNodes();

  assert.deepEqual([...map.getCollapsedConversationDescendantIds(nodes, ["a3"])], ["a4"]);
  const rendered = map.getRenderableConversationMapNodes(nodes, {}, ["a3"]);
  assert.deepEqual(rendered.map((node) => node.id), ["a1", "a2", "a3"]);
});

test("선택한 가지를 원문 구조는 보존한 채 독립된 최상위 가지로 분리한다", () => {
  assert.equal(typeof map.applyConversationMapDetachments, "function", "가지 분리 계산 함수가 필요합니다.");
  const original = fixtureNodes();
  const detached = map.applyConversationMapDetachments(original, ["a3"]);

  assert.deepEqual(map.getConversationMapRoots(detached).map((node) => node.id), ["a1", "a3"]);
  assert.deepEqual(detached.find((node) => node.id === "a1")?.childIds, ["a2"]);
  assert.equal(detached.find((node) => node.id === "a1")?.nextId, "a2");
  assert.equal(detached.find((node) => node.id === "a3")?.parentId, null);
  assert.equal(detached.find((node) => node.id === "a3")?.previousId, null);
  assert.equal(detached.find((node) => node.id === "a3")?.depth, 0);
  assert.deepEqual(detached.find((node) => node.id === "a3")?.childIds, ["a4"]);
  assert.equal(detached.find((node) => node.id === "a3")?.nextId, "a4");
  assert.equal(detached.find((node) => node.id === "a4")?.parentId, "a3");
  assert.equal(detached.find((node) => node.id === "a4")?.previousId, "a3");
  assert.equal(detached.find((node) => node.id === "a4")?.depth, 1);

  assert.equal(original.find((node) => node.id === "a3")?.parentId, "a1");
  assert.deepEqual(original.find((node) => node.id === "a1")?.childIds, ["a2", "a3"]);
  assert.deepEqual(
    map.applyConversationMapDetachments(original, []).map((node) => ({ id: node.id, parentId: node.parentId, childIds: node.childIds })),
    original.map((node) => ({ id: node.id, parentId: node.parentId, childIds: node.childIds })),
  );
});

test("가지를 숨기면 접힘을 해제하고 숨김 상태만 남긴다", () => {
  assert.equal(
    typeof map.hideConversationMapBranchState,
    "function",
    "숨김과 보관을 하나의 상태 전이로 다루는 함수가 필요합니다.",
  );

  const next = map.hideConversationMapBranchState({
    mapDecisions: { a1: "keep", a2: "exclude" },
    collapsedMapNodeIds: ["a2", "a3"],
    detachedMapNodeIds: ["a3"],
  }, "a3");

  assert.deepEqual(next.mapDecisions, { a1: "keep", a2: "exclude", a3: "exclude" });
  assert.deepEqual(next.collapsedMapNodeIds, ["a2"]);
  assert.deepEqual(next.detachedMapNodeIds, ["a3"], "숨겨진 동안에는 분리 위치를 보존합니다.");
});

test("숨긴 가지를 복원하면 원래 부모 아래로 돌아가도록 분리 상태도 해제한다", () => {
  assert.equal(
    typeof map.restoreConversationMapBranchState,
    "function",
    "숨긴 가지를 원래 위치로 복원하는 상태 전이 함수가 필요합니다.",
  );

  const next = map.restoreConversationMapBranchState({
    mapDecisions: { a1: "keep", a2: "exclude", a3: "exclude" },
    collapsedMapNodeIds: ["a2", "a3"],
    detachedMapNodeIds: ["a3", "a4"],
  }, "a3");

  assert.deepEqual(next.mapDecisions, { a1: "keep", a2: "exclude" });
  assert.deepEqual(next.collapsedMapNodeIds, ["a2"]);
  assert.deepEqual(next.detachedMapNodeIds, ["a4"]);
});

test("대화 보존 한도로 숨긴 루트가 잘려도 첫 생존 자식에 숨김 상태를 이어 붙인다", () => {
  assert.equal(typeof map.reconcileConversationMapStateAfterTrim, "function");
  const messages = [];
  for (let index = 1; index <= 21; index += 1) {
    messages.push(user(`u${index}`, `${index}번째 질문`));
    messages.push(assistant(`a${index}`, `${index}번째 생각`));
  }
  const keptMessages = messages.slice(-40);

  const next = map.reconcileConversationMapStateAfterTrim({
    previousMessages: messages,
    nextMessages: keptMessages,
    mapDecisions: { a1: "exclude" },
    collapsedMapNodeIds: [],
    detachedMapNodeIds: [],
  });

  assert.deepEqual(next.mapDecisions, { a2: "exclude" });
  const visible = map.getRenderableConversationMapNodes(
    map.buildConversationMap(keptMessages, []),
    next.mapDecisions,
    next.collapsedMapNodeIds,
  );
  assert.deepEqual(visible, []);
});

test("분리한 가지 상태를 저장하고 대화 정리 시 함께 정리한다", () => {
  assert.match(storeSource, /detachedMapNodeIds: string\[\]/);
  assert.match(storeSource, /detachMapNode: \(messageId: string\) => void/);
  assert.match(storeSource, /attachMapNode: \(messageId: string\) => void/);
  assert.match(storeSource, /clearDetachedMapNodes: \(\) => void/);
  assert.match(storeSource, /detachedMapNodeIds: state\.detachedMapNodeIds\.filter\(\(id\) => !removedMessageIds\.has\(id\)\)/);
  assert.match(storeSource, /clearConversation: \(\) => set\(\{[\s\S]*?detachedMapNodeIds: \[\],[\s\S]*?\}\),/);
  assert.match(storeSource, /version: 7/);
  assert.match(storeSource, /detachedMapNodeIds: Array\.isArray\(state\?\.detachedMapNodeIds\)/);
});
