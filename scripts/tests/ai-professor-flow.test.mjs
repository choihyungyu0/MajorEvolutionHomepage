import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const NodeModule = require("node:module");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const screen = source("components/screens/ai-professor-screen.tsx");
const conversationMap = source("components/screens/ai-conversation-map.tsx");
const screenStyles = source("components/screens/ai-professor-screen.module.css");
const conversationMapModel = source("lib/ai-conversation-map.ts");
const store = source("store/ai-professor-store.ts");
const server = source("lib/openai-server.ts");
const route = source("app/api/ai/growth-professor/route.ts");
const portfolio = source("components/screens/portfolio-hub-screen.tsx");
const home = source("components/screens/unified-home-screen.tsx");
const homeMapPreview = source("components/screens/home-ai-map-preview.tsx");
const homeStyles = source("components/screens/home-dashboard.module.css");
const dataControls = source("components/screens/data-controls.tsx");

function loadAiProfessorStoreModule() {
  const filename = path.join(repositoryRoot, "store", "ai-professor-store.ts");
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "AI 교수님 저장소 테스트용 변환 실패");

  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
    clear: () => memory.clear(),
    key: (index) => Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size;
    },
  };

  const runtimeModule = new NodeModule(filename);
  runtimeModule.filename = filename;
  runtimeModule.paths = NodeModule._nodeModulePaths(path.dirname(filename));
  runtimeModule._compile(compiled.outputText, filename);
  return { ...runtimeModule.exports, memory };
}

function loadConversationMapModule() {
  const compiled = ts.transpileModule(conversationMapModel, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

test("성장과정에서 나의 AI 교수님 대화로 바로 이어진다", () => {
  assert.match(portfolio, /나의 AI 교수님/);
  assert.match(portfolio, /\/portfolio\/ai-professor/);
  assert.match(screen, /가볍게 이야기하기/);
  assert.match(screen, /실제 교수님 만남 준비/);
  assert.match(screen, /프로젝트로 구체화/);
});

test("AI는 실제 교수를 대신하지 않고 사용자가 고른 요약만 성장 메모로 저장한다", () => {
  assert.match(server, /실제 교수, 지도교수, 상담사, 학사 담당자가 아닙니다/);
  assert.match(server, /입력에 없는 성격, 적성, 성과/);
  assert.match(screen, /성장 메모로 남기기/);
  assert.match(store, /saveReflection/);
  assert.match(store, /sourceMessageId/);
  assert.match(store, /MAX_MESSAGES = 40/);
  assert.match(store, /MAX_NOTES = 20/);
});

test("OpenAI 키는 서버 경로에서만 사용하고 오류에도 학생 메시지를 보존한다", () => {
  assert.match(route, /generateGrowthProfessorReply/);
  assert.match(server, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(screen, /OPENAI_API_KEY/);
  assert.match(screen, /addUserMessage\(content, branchOrigin\?\.parentId \?\? null\)/);
  assert.match(screen, /다시 보내기/);
  assert.match(route, /작성한 내용은 그대로 남아 있어요/);
  assert.match(route, /FRIENDLY_ERROR_MESSAGES\[serviceError\.code\]/);
});

test("AI 교수님은 사용자가 실제로 선택한 교수만 연결 맥락으로 사용한다", () => {
  const contextBlock = screen.slice(
    screen.indexOf("const context = useMemo"),
    screen.indexOf("const lastMessage ="),
  );
  assert.match(contextBlock, /find\(\(item\) => item\.selectedAt\)/);
  assert.doesNotMatch(contextBlock, /professors\.at\(-1\)/);
  assert.match(screen, /아직 선택한 교수 없음/);
});

test("AI 교수님은 대학생에게 핵심, 두 선택지, 질문 순서로 짧게 답한다", () => {
  assert.match(server, /친한 선배가 옆에서 함께 정리해 주는 듯한/);
  assert.match(server, /따뜻하고 자연스러운 존댓말/);
  assert.match(server, /'당신', '학생은', '정답은'/);
  assert.match(server, /중학생도 한 번에 이해할 수 있는 쉬운 말/);
  assert.match(server, /'구체적 경로', '탐색', '역량', '시도할 방향'/);
  assert.match(server, /1\. 지금 고민:[\s\S]*2\. 먼저 해볼 일:[\s\S]*3\. 다른 방법:[\s\S]*4\. 이어갈 질문:/);
  assert.match(server, /한 번에 여러 질문을 묻지 마세요/);
  assert.match(server, /reply: \{ type: "string", minLength: 1, maxLength: 220 \}/);
  assert.match(server, /reply는 220자 이내, 2~4개의 짧은 문장/);
  assert.match(server, /\.slice\(-8\)/);
  assert.match(server, /message\?\.role === "assistant" \? 220 : 600/);
});

test("성장 메모와 이어갈 말도 짧고 학생이 직접 말하는 형식을 유지한다", () => {
  assert.match(server, /'현재 고민:', '시도할 방향:', '다음 행동:'/);
  assert.match(server, /title은 24자 이내의 명사형/);
  assert.match(server, /학생이 직접 말하는 10~24자의 자연스러운 존댓말/);
  assert.match(server, /body: \{ type: "string", minLength: 1, maxLength: 180 \}/);
  assert.match(server, /items: \{ type: "string", minLength: 1, maxLength: 40 \}/);
  assert.match(store, /function trimMultilineText/);
  assert.match(store, /content: trimMultilineText\(response\.reply, 220\)/);
  assert.match(store, /body: trimMultilineText\(response\.reflection\.body, 180\)/);
  assert.match(store, /response\.suggestedPrompts\.map\(\(item\) => trimText\(item, 40\)\)/);
});

test("긴 대화와 실제 원문에 근거한 대화 지도를 오갈 수 있다", () => {
  assert.match(screen, /대화하기/);
  assert.match(screen, /대화 지도/);
  assert.match(screen, /내 맥락/);
  assert.match(screen, /viewMode === "context"/);
  assert.match(screen, /AiConversationMap/);
  assert.match(conversationMap, /나의 상상나무/);
  assert.match(conversationMap, /<details key=\{`source-\$\{selectedNode\.id\}`\} className=\{styles\.nodeSources\}>/);
  assert.match(conversationMap, /내 질문과 AI 답변 전체 보기/);
  assert.match(conversationMap, /내 질문/);
  assert.match(conversationMap, /AI 교수님 답변/);
  assert.match(conversationMap, /nodeSourceFullText/);
  assert.match(conversationMap, /\{selectedNode\.assistantMessage\.content\}/);
  assert.match(conversationMap, /\{selectedNode\.mapSummary\}/);
  assert.match(conversationMap, /원문 대화는 삭제되지 않아요/);
  assert.doesNotMatch(conversationMap, /excerpt\(selectedNode\.assistantMessage\.content/);
  assert.match(conversationMapModel, /buildConversationMap/);
  assert.match(conversationMapModel, /userMessage/);
  assert.match(conversationMapModel, /assistantMessage/);
  assert.match(conversationMapModel, /mapSummary/);
  assert.match(conversationMapModel, /buildMapSummary/);
  assert.match(conversationMap, /\{node\.mapSummary\}/);
  assert.match(conversationMap, /생각 씨앗/);
  assert.match(conversationMap, /발견한 단서/);
  assert.match(conversationMap, /선택한 갈림길/);
  assert.match(conversationMap, /다음 발걸음/);
  assert.match(conversationMap, /카드를 고르면 지나온 생각 줄기가 빛나요/);
  assert.match(conversationMap, /data-branching=\{children\.length > 1/);
  assert.match(screenStyles, /\.mapNode\[data-branching="true"\]/);
});

test("대화와 성장 맥락을 분리해 대화창은 전체 너비를 안정적으로 사용한다", () => {
  assert.match(screen, /useState<"chat" \| "map" \| "context">/);
  assert.match(screen, /viewMode === "chat" \? \(/);
  assert.match(screen, /viewMode === "context" \? \(/);
  assert.match(screenStyles, /\.conversation \{[\s\S]*?height: clamp\([\s\S]*?100dvh[\s\S]*?min-height: 0/);
  assert.match(screenStyles, /\.messageList \{[\s\S]*?overflow-y: auto/);
  assert.match(screenStyles, /\.workspace \{[\s\S]*?min-width: 0/);
  assert.match(screenStyles, /\.promptSuggestions \{[\s\S]*?grid-template-columns: repeat\(3/);
  assert.match(screenStyles, /\.viewTabs \{[\s\S]*?grid-template-columns: repeat\(3/);
  assert.match(screenStyles, /@media \(min-width: 720px\) and \(max-width: 1279px\)[\s\S]*?100dvh\) - 450px/);
  assert.match(screenStyles, /@media \(min-width: 1280px\)[\s\S]*?100dvh\) - 330px/);
  assert.match(screen, /messageList\.scrollTop = messageList\.scrollHeight/);
  assert.doesNotMatch(screen, /messageEndRef/);
});

test("예전 장문 답변은 지우지 않고 핵심을 먼저 보여준 뒤 펼쳐 읽는다", () => {
  assert.match(screen, /CURRENT_REPLY_LIMIT = 220/);
  assert.match(screen, /legacyReplyPreview/);
  assert.match(screen, /예전 답변 전체 보기/);
  assert.match(screen, /message\.content\.length > CURRENT_REPLY_LIMIT/);
  assert.match(screenStyles, /\.legacyReply/);
});

test("홈에서 실제 AI 대화 지도 요약을 확인하고 전체 지도 탭으로 이어진다", () => {
  const progressIndex = home.indexOf("styles.progressSection");
  const previewIndex = home.indexOf("<HomeAiMapPreview />");
  const lowerGridIndex = home.indexOf("styles.lowerGrid");

  assert.match(home, /HomeAiMapPreview/);
  assert.ok(progressIndex < previewIndex && previewIndex < lowerGridIndex);
  assert.match(homeMapPreview, /buildConversationMap/);
  assert.match(homeMapPreview, /mapDecisions\[node\.id\] !== "exclude"/);
  assert.match(homeMapPreview, /대화로 정리된 나의 생각 지도/);
  assert.match(homeMapPreview, /\/portfolio\/ai-professor\?view=map/);
  assert.match(homeMapPreview, /아직 만들어진 대화 지도가 없어요/);
  assert.match(screen, /new URLSearchParams\(window\.location\.search\)\.get\("view"\)/);
  assert.match(homeStyles, /\.aiMapNode \{[\s\S]*?margin-inline: auto/);
});

test("사용자가 핵심 흐름을 남기거나 제외해도 원문 대화는 보존한다", () => {
  assert.match(conversationMap, /핵심으로 남기기/);
  assert.match(conversationMap, /이 갈래 접기/);
  assert.match(conversationMap, /원문 대화는 삭제되지 않아요/);
  assert.match(conversationMap, /나의 성장과정에 반영하기/);
  assert.match(store, /mapDecisions/);
  assert.match(store, /setMapDecision/);
  assert.match(store, /clearMapDecision/);
  assert.match(store, /version: 4/);
  assert.match(store, /migrate:/);
});

test("갈래를 접으면 그 아래 자란 생각까지 함께 접히고 자리에서 되돌릴 수 있다", () => {
  const { buildConversationMap, getPrunedNodeIds, summarizePrunedBranch, getConversationMapRoots } =
    loadConversationMapModule();
  const createdAt = "2026-08-27T00:00:00.000Z";
  const user = (id, content, branchParentMessageId = null) => ({
    id, role: "user", content, createdAt, branchParentMessageId,
  });
  const assistant = (id, content, title) => ({
    id, role: "assistant", content, createdAt, branchParentMessageId: null,
    reflection: { title, body: content }, suggestedPrompts: [],
  });

  // a → b → c 로 이어지고, a에서 갈라진 d가 하나 더 있다.
  const messages = [
    user("u1", "진로가 고민이에요"), assistant("a", "먼저 범위를 좁혀요", "생각 씨앗"),
    user("u2", "더 좁혀볼래요"), assistant("b", "데이터 원천을 정해요", "데이터 원천"),
    user("u3", "그럼 지표는요"), assistant("c", "핵심 변수부터", "핵심 변수"),
    user("u4", "다른 관점도 볼래요", "a"), assistant("d", "설문과 비교해요", "설문 비교"),
  ];
  const nodes = buildConversationMap(messages, []);
  assert.equal(nodes.length, 4);

  // b를 접으면 b와 그 후손 c가 함께 접힌다. 형제 갈래 d는 남는다.
  const pruned = getPrunedNodeIds(nodes, { b: "exclude" });
  assert.ok(pruned.has("b"), "접은 노드가 포함되어야 한다");
  assert.ok(pruned.has("c"), "접은 노드의 후손도 함께 접혀야 한다");
  assert.ok(!pruned.has("a"), "부모는 접히지 않아야 한다");
  assert.ok(!pruned.has("d"), "형제 갈래는 남아야 한다");

  // 접힌 자식이 최상위 루트로 승격되지 않는다.
  const visible = nodes.filter((node) => !pruned.has(node.id));
  const roots = getConversationMapRoots(visible);
  assert.deepEqual(roots.map((node) => node.id), ["a"], "접기 후 루트는 a 하나여야 한다");

  // 접힌 자리에 몇 개가 감춰졌는지 알려준다.
  const summary = summarizePrunedBranch(nodes, "b", { b: "exclude", c: "keep" });
  assert.equal(summary.total, 2, "자기 자신과 후손을 합해 센다");
  assert.equal(summary.keptInside, 1, "안에 든 핵심 개수를 함께 알려준다");

  // 되돌릴 수 있는 자리와 안내가 화면에 있다.
  assert.match(conversationMap, /prunedBranch/);
  assert.match(conversationMap, /생각 \{branch\.total\}개 접힘/);
  assert.match(conversationMap, /onRestoreBranch/);
  assert.match(conversationMap, /접은 생각 \{prunedCount\}개/);
  assert.match(conversationMapModel, /getPrunedNodeIds/);
  assert.match(conversationMapModel, /collectDescendantIds/);
});

test("대화·생각 카드·지도 상태를 저장하고 내 맥락에서 다시 선택한다", () => {
  assert.match(screen, /현재 대화 저장/);
  assert.match(screen, /저장하고 새 대화 시작하기/);
  assert.match(screen, /aria-label=\{messages\.length \? "현재 내용 저장 후 새 대화 시작" : "새 대화 시작"\}/);
  assert.match(screen, /대화·생각 카드·지도 분기를 함께 저장해요/);
  assert.match(screen, /저장한 대화/);
  assert.match(screen, /handleOpenConversation/);
  assert.match(screen, /viewMode === "context"/);
  assert.match(store, /savedConversations/);
  assert.match(store, /activeConversationId/);
  assert.match(store, /saveCurrentConversation/);
  assert.match(store, /startNewConversation/);
  assert.match(store, /openConversation/);
  assert.match(dataControls, /savedConversations: aiSavedConversations/);
  assert.match(dataControls, /activeConversationId: aiActiveConversationId/);

  const handlerStart = screen.indexOf("const handleStartNewConversation");
  const handlerEnd = screen.indexOf("const handleOpenConversation", handlerStart);
  const handler = screen.slice(handlerStart, handlerEnd);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  assert.ok(handler.indexOf("draft.trim()") < handler.indexOf("startNewConversation()"));
  assert.match(handler, /작성 중인 메시지를 먼저 보내거나 비워 주세요/);
  assert.match(handler, /startNewConversation\(\)/);
  assert.match(handler, /resetConversationComposer\(\)/);
  assert.match(handler, /setViewMode\("chat"\)/);
  assert.doesNotMatch(handler, /clearConversation\(\)/);
});

test("저장본 전환은 분기·카드·지도 선택과 성장 메모를 잃지 않는다", () => {
  const { useAiProfessorStore, migrateAiProfessorState, memory } = loadAiProfessorStoreModule();
  const createdAt = "2026-08-25T00:00:00.000Z";
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
    content: `${title}에 대한 쉬운 답변`,
    createdAt,
    branchParentMessageId: null,
    reflection: { title: `${title} 카드`, body: `현재 고민: ${title}\n다음 행동: 작게 비교하기` },
    suggestedPrompts: ["비교해 줘", "준비를 알려줘", "직접 해볼래", "교수님께 물어볼래"],
  });
  const conversationA = [
    user("user-a1", "데이터 진로를 비교하고 싶어요"),
    assistant("assistant-a1", "데이터 진로 비교"),
    user("user-a2", "직무 하루를 비교해 줘", "assistant-a1"),
    assistant("assistant-a2", "직무 하루 비교"),
  ];
  const growthNote = {
    id: "note-a1",
    title: "진로 비교 메모",
    body: "두 직무를 작은 경험으로 비교하기",
    sourceMessageId: "assistant-a1",
    createdAt,
  };
  const reset = (extra = {}) => {
    useAiProfessorStore.setState({
      hasHydrated: true,
      messages: [],
      growthNotes: [],
      mapDecisions: {},
      savedConversations: [],
      activeConversationId: null,
      ...extra,
    });
    memory.clear();
  };

  reset({
    messages: conversationA,
    growthNotes: [growthNote],
    mapDecisions: { "assistant-a1": "keep", "assistant-a2": "exclude" },
  });

  const firstSave = useAiProfessorStore.getState().saveCurrentConversation();
  assert.equal(firstSave.status, "saved");
  const firstId = firstSave.conversation.id;
  assert.equal(firstSave.conversation.messages[2].branchParentMessageId, "assistant-a1");
  assert.equal(firstSave.conversation.messages[1].reflection.title, "데이터 진로 비교 카드");
  assert.deepEqual(firstSave.conversation.messages[1].suggestedPrompts, [
    "비교해 줘", "준비를 알려줘", "직접 해볼래", "교수님께 물어볼래",
  ]);
  assert.deepEqual(firstSave.conversation.mapDecisions, {
    "assistant-a1": "keep",
    "assistant-a2": "exclude",
  });

  const secondSave = useAiProfessorStore.getState().saveCurrentConversation();
  assert.equal(secondSave.status, "updated");
  assert.equal(secondSave.conversation.id, firstId);
  assert.equal(useAiProfessorStore.getState().savedConversations.length, 1);

  const newConversation = useAiProfessorStore.getState().startNewConversation();
  assert.equal(newConversation.status, "updated");
  assert.deepEqual(useAiProfessorStore.getState().messages, []);
  assert.deepEqual(useAiProfessorStore.getState().mapDecisions, {});
  assert.deepEqual(useAiProfessorStore.getState().growthNotes, [growthNote]);

  useAiProfessorStore.setState({
    messages: [user("user-b1", "프로젝트를 새로 시작할래요"), assistant("assistant-b1", "새 프로젝트")],
    mapDecisions: { "assistant-b1": "keep" },
  });
  const beforeInvalid = useAiProfessorStore.getState().messages.map((message) => message.id);
  assert.equal(useAiProfessorStore.getState().openConversation("missing"), false);
  assert.deepEqual(
    useAiProfessorStore.getState().messages.map((message) => message.id),
    beforeInvalid,
  );

  assert.equal(useAiProfessorStore.getState().openConversation(firstId), true);
  assert.deepEqual(
    useAiProfessorStore.getState().messages.map((message) => message.id),
    conversationA.map((message) => message.id),
  );
  assert.deepEqual(useAiProfessorStore.getState().mapDecisions, {
    "assistant-a1": "keep",
    "assistant-a2": "exclude",
  });
  assert.equal(useAiProfessorStore.getState().savedConversations.length, 2);

  useAiProfessorStore.getState().removeSavedConversation(firstId);
  assert.equal(useAiProfessorStore.getState().activeConversationId, null);
  assert.deepEqual(
    useAiProfessorStore.getState().messages.map((message) => message.id),
    conversationA.map((message) => message.id),
  );
  assert.deepEqual(useAiProfessorStore.getState().growthNotes, [growthNote]);

  const migrated = migrateAiProfessorState({
    messages: conversationA,
    growthNotes: [growthNote],
    mapDecisions: { "assistant-a1": "keep" },
  });
  assert.deepEqual(migrated.savedConversations, []);
  assert.equal(migrated.activeConversationId, null);
  assert.equal(migrated.messages[2].branchParentMessageId, "assistant-a1");
});

test("저장본이 가득 차도 열려는 오래된 대화를 목록에서 밀어내지 않는다", () => {
  const { useAiProfessorStore } = loadAiProfessorStoreModule();
  const createdAt = "2026-08-25T00:00:00.000Z";
  const makeMessage = (id, role, content) => ({
    id,
    role,
    content,
    createdAt,
    branchParentMessageId: null,
    reflection: role === "assistant" ? { title: `${content} 카드`, body: content } : null,
    suggestedPrompts: role === "assistant" ? ["다음 질문"] : [],
  });
  const savedConversations = Array.from({ length: 12 }, (_, index) => ({
    schemaVersion: 1,
    id: `saved-${index}`,
    title: `저장 대화 ${index}`,
    preview: `저장 대화 ${index} 요약`,
    createdAt,
    updatedAt: createdAt,
    messages: [
      makeMessage(`user-${index}`, "user", `고민 ${index}`),
      makeMessage(`assistant-${index}`, "assistant", `답변 ${index}`),
    ],
    mapDecisions: { [`assistant-${index}`]: "keep" },
  }));
  useAiProfessorStore.setState({
    hasHydrated: true,
    savedConversations,
    activeConversationId: null,
    messages: [
      makeMessage("current-user", "user", "미저장 고민"),
      makeMessage("current-assistant", "assistant", "미저장 답변"),
    ],
    mapDecisions: { "current-assistant": "keep" },
    growthNotes: [],
  });

  assert.equal(useAiProfessorStore.getState().openConversation("saved-0"), true);
  const state = useAiProfessorStore.getState();
  assert.equal(state.savedConversations.length, 12);
  assert.equal(state.savedConversations.some((conversation) => conversation.id === "saved-0"), true);
  assert.equal(state.activeConversationId, "saved-0");
  assert.deepEqual(state.messages.map((message) => message.id), ["user-0", "assistant-0"]);
});

test("과거 노드에서 새 갈래를 시작하고 트리에서 여러 자식 흐름을 확인한다", () => {
  assert.match(conversationMap, /AI 대화로 자라는 나의 상상나무/);
  assert.match(conversationMap, /추천 가지/);
  assert.match(conversationMap, /ConversationTreeNode/);
  assert.match(conversationMap, /childIds/);
  assert.match(conversationMap, /onStartBranch/);
  assert.match(conversationMapModel, /branchParentMessageId/);
  assert.match(conversationMapModel, /childrenByParent/);
  assert.match(conversationMapModel, /getConversationMapRoots/);
  assert.match(screen, /선택한 대화에서 이어가는 중/);
  assert.match(screen, /branchOrigin/);
  assert.match(screen, /hasBranchChoices/);
  assert.match(screen, /새 대화 갈래 후보/);
  assert.match(screen, /lastMessage\?\.role === "assistant"/);
  assert.match(screen, /Array\.from\(new Set/);
  assert.match(screen, /messages\.length === 0[\s\S]*?QUICK_PROMPTS/);
  assert.match(screen, /parentId: suggestionSourceMessage\.id/);
  assert.match(screen, /suggestionSourceMessage\.reflection\?\.title \?\? "현재 대화"/);
  assert.match(screenStyles, /\.branchPromptMark/);
  assert.match(screen, /conversationLineageToAssistant\(messages, parentAssistantId\)/);
  assert.match(screen, /conversationLineageToAssistant\(messages, retryParentId\)/);
  assert.match(conversationMapModel, /export function conversationLineageToAssistant/);
  assert.match(screen, /clearConversation\(\);[\s\S]*setBranchOrigin\(null\);[\s\S]*setDraft\(""\);/);
  assert.match(store, /branchParentMessageId/);
  assert.match(server, /1\. 비교하기:[\s\S]*2\. 필요한 준비:[\s\S]*3\. 직접 해보기:[\s\S]*4\. 교수님께 묻기:/);
  assert.match(server, /minItems: 4/);
  assert.match(server, /maxItems: 4/);
  assert.match(conversationMap, /prompts\.length >= 4 \? prompts\.slice\(0, 4\) : FALLBACK_BRANCH_PROMPTS\[node\.topic\]/);
  assert.match(conversationMap, /BRANCH_AXES = \["비교·결정", "근거·역량", "프로젝트·실행", "교수 대화"\]/);
  assert.match(conversationMap, /branchPrompts\.map/);
  assert.match(conversationMap, /이 카드에서 가지치기/);
  assert.match(conversationMap, /className=\{styles\.nodeBranchButton\}/);
  assert.match(screenStyles, /\.nodeBranchButton/);
  assert.match(conversationMap, /onClick=\{\(\) => onStartBranch\(selectedNode\.id, "", selectedNode\.title\)\}/);
  assert.match(conversationMap, /onClick=\{\(\) => onStartBranch\(selectedNode\.id, prompt, selectedNode\.title\)\}/);
  assert.match(conversationMap, /activePathIds/);
  assert.match(conversationMap, /data-on-path=\{activePathIds\.has\(node\.id\)/);
  assert.match(screenStyles, /\.mapTreeItem\[data-on-path="true"\]/);
  assert.doesNotMatch(conversationMap, /removeConversationBranch/);
  assert.match(conversationMap, /nodeDetailRef\.current\?\.scrollIntoView\(\{ block: "start", behavior: "smooth" \}\)/);
  assert.doesNotMatch(conversationMap, /manualBranchButton/);
  assert.match(screen, /setBranchOrigin\(\{ parentId, title \}\)/);
  assert.match(screen, /setViewMode\("chat"\)/);
  assert.match(screen, /inputRef\.current\?\.focus\(\)/);
});

test("선택한 카드에서 이어가면 관계없는 형제 갈래를 빼고 조상 대화만 복원한다", () => {
  const { buildConversationMap, conversationLineageToAssistant } = loadConversationMapModule();
  const createdAt = "2026-08-25T00:00:00.000Z";
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
    suggestedPrompts: ["비교해 줘", "준비를 알려줘", "직접 해볼래", "교수님께 물어볼래"],
  });
  const messages = [
    user("u1", "처음 고민"), assistant("a1", "처음 고민"),
    user("u2", "첫 번째 갈래"), assistant("a2", "첫 번째 갈래"),
    user("u3", "두 번째 갈래", "a1"), assistant("a3", "두 번째 갈래"),
    user("u4", "첫 갈래의 다음 질문", "a2"), assistant("a4", "첫 갈래의 다음 질문"),
  ];

  const nodes = buildConversationMap(messages, []);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  assert.deepEqual(nodeById.get("a1").childIds, ["a2", "a3"]);
  assert.deepEqual(nodeById.get("a2").childIds, ["a4"]);
  assert.equal(nodeById.get("a1").childIds.length > 1, true);
  assert.equal(nodeById.get("a2").childIds.length > 1, false);
  assert.deepEqual(
    conversationLineageToAssistant(messages, "a3").map((message) => message.id),
    ["u1", "a1", "u3", "a3"],
  );
  assert.deepEqual(
    conversationLineageToAssistant(messages, "a4").map((message) => message.id),
    ["u1", "a1", "u2", "a2", "u4", "a4"],
  );

  const orphanNodes = buildConversationMap([
    user("orphan-user", "오래된 대화에서 이어가기", "missing-parent"),
    assistant("orphan-assistant", "부모가 잘린 대화"),
  ], []);
  assert.equal(orphanNodes[0].parentId, null);
});

test("태블릿과 모바일에서도 가지 구조를 유지하고 드래그와 초점 복귀를 지원한다", () => {
  const compactDetailStart = screenStyles.indexOf("@container (max-width: 920px)");
  const compactDetailEnd = screenStyles.indexOf("@container (min-width: 1000px)", compactDetailStart);
  const compactDetailBlock = screenStyles.slice(compactDetailStart, compactDetailEnd);
  const mobileStart = screenStyles.indexOf("@container (max-width: 760px)");
  const mobileEnd = screenStyles.indexOf("@media (min-width: 720px)", mobileStart);
  const mobileBlock = screenStyles.slice(mobileStart, mobileEnd);

  assert.match(screenStyles, /container-type: inline-size/);
  assert.match(screenStyles, /@container \(max-width: 760px\)/);
  assert.ok(compactDetailStart >= 0 && compactDetailEnd > compactDetailStart);
  assert.match(compactDetailBlock, /\.branchSuggestions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(screenStyles, /@container \(min-width: 1000px\)/);
  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart);
  assert.match(conversationMap, /onPointerDown=\{beginMapPan\}/);
  assert.match(conversationMap, /className=\{styles\.mapFocusButton\}/);
  assert.match(conversationMap, /aria-label="생각 지도의 시작점으로 초점 맞추기"/);
  assert.match(conversationMap, /data-depth=\{node\.depth\}/);
  assert.match(mobileBlock, /\.mapGraph \{[\s\S]*?min-width: 680px/);
  assert.match(mobileBlock, /\.mapTree > \.mapTreeItem > \.mapNode \{[\s\S]*?width: 268px/);
  assert.match(mobileBlock, /\.mapTree ol \.mapNode \{[\s\S]*?width: 220px/);
  assert.match(mobileBlock, /\.mapCanvas \{[\s\S]*?overflow: auto/);
  assert.doesNotMatch(mobileBlock, /overflow-x: hidden/);
  assert.match(screenStyles, /\.mapFocusButton \{/);
  assert.match(mobileBlock, /\.nodeDecisionBox \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(mobileBlock, /\.nodeDecisionBox > div button \{[\s\S]*?min-height: 40px/);
  assert.match(mobileBlock, /\.nodeConnections > div \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobileBlock, /\.branchSuggestions \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(conversationMap, /mapOutcomeArrow/);
});
