import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

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
  assert.match(server, /minItems: 3/);
  assert.match(server, /maxItems: 3/);
  assert.match(server, /kind: \{ type: "string", enum: \["continue", "branch"\] \}/);
  assert.match(store, /function trimMultilineText/);
  assert.match(store, /content: trimMultilineText\(response\.reply, 220\)/);
  assert.match(store, /body: trimMultilineText\(response\.reflection\.body, 180\)/);
  assert.match(store, /normalizeGrowthProfessorSuggestions\(response\.suggestedPrompts\)/);
});

test("긴 대화와 실제 원문에 근거한 대화 지도를 오갈 수 있다", () => {
  assert.match(screen, /대화하기/);
  assert.match(screen, /대화 지도/);
  assert.match(screen, /내 맥락/);
  assert.match(screen, /viewMode === "context"/);
  assert.match(screen, /AiConversationMap/);
  assert.match(conversationMap, /생각 진화 지도/);
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
  assert.match(conversationMap, /대화가 깊어지면 새 질문은 옆 가지로 자라요/);
  assert.match(conversationMap, /data-branching=\{originalChildCount > 1/);
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

test("사용자가 선택한 카드에서 하위 가지를 접거나 숨기고 다시 복원한다", () => {
  assert.match(conversationMap, /핵심으로 남기기/);
  assert.match(conversationMap, /하위 가지 접기/);
  assert.match(conversationMap, /하위 가지 펼치기/);
  assert.match(conversationMap, /이 가지 숨기기/);
  assert.match(conversationMap, /숨긴 가지 \{archivedRoots\.length\}개/);
  assert.match(conversationMap, /지도에 복원/);
  assert.match(conversationMap, /getRenderableConversationMapNodes/);
  assert.match(conversationMap, /getConversationSubtreeIds/);
  assert.match(conversationMap, /visibleNodes\.some\(\(node\) => node\.id === selectedId\)/);
  assert.match(conversationMap, /원문 대화는 삭제되지 않아요/);
  assert.match(conversationMap, /나의 성장과정에 반영하기/);
  assert.match(store, /mapDecisions/);
  assert.match(store, /collapsedMapNodeIds/);
  assert.match(store, /setMapDecision/);
  assert.match(store, /clearMapDecision/);
  assert.match(store, /toggleCollapsedMapNode/);
  assert.match(store, /clearCollapsedMapNode/);
  assert.match(store, /version: 7/);
  assert.match(store, /migrate:/);
  assert.match(screenStyles, /\.mapArchiveDrawer/);
  assert.match(screenStyles, /\.mapArchiveButton/);
});

test("선택한 카드의 가지를 독립 루트로 분리하고 원래 위치로 되돌린다", () => {
  assert.match(conversationMap, /applyConversationMapDetachments\(originalNodes, detachedMapNodeIds\)/);
  assert.match(conversationMap, /이 가지 분리/);
  assert.match(conversationMap, /원래 위치로 되돌리기/);
  assert.match(conversationMap, /분리된 가지/);
  assert.match(conversationMap, /onDetachMapNode/);
  assert.match(conversationMap, /onAttachMapNode/);
  assert.match(conversationMap, /data-multiple-roots/);
  assert.match(screen, /detachedMapNodeIds=\{detachedMapNodeIds\}/);
  assert.match(screen, /onDetachMapNode=\{detachMapNode\}/);
  assert.match(screen, /onAttachMapNode=\{attachMapNode\}/);
  assert.match(screenStyles, /\.detachedNodeBadge/);
  assert.match(screenStyles, /\.mapTree\[data-multiple-roots="true"\]/);
});

test("생각 지도는 70에서 130퍼센트까지 확대·축소하고 100퍼센트로 돌아간다", () => {
  assert.match(conversationMap, /Math\.min\(130, Math\.max\(70, nextZoom\)\)/);
  assert.match(conversationMap, /aria-label="생각 지도 축소"/);
  assert.match(conversationMap, /aria-label="생각 지도 확대"/);
  assert.match(conversationMap, /100퍼센트로 되돌리기/);
  assert.match(conversationMap, /style=\{\{ zoom: mapZoom \/ 100/);
  assert.match(screenStyles, /\.mapZoomControls/);
});

test("과거 노드에서 새 갈래를 시작하고 트리에서 여러 자식 흐름을 확인한다", () => {
  assert.match(conversationMap, /이 생각에서 새 갈래 만들기/);
  assert.match(conversationMap, /ConversationTreeNode/);
  assert.match(conversationMap, /childIds/);
  assert.match(conversationMap, /onStartBranch/);
  assert.match(conversationMapModel, /branchParentMessageId/);
  assert.match(conversationMapModel, /childrenByParent/);
  assert.match(conversationMapModel, /getConversationMapRoots/);
  assert.match(screen, /선택한 대화에서 이어가는 중/);
  assert.match(screen, /branchOrigin/);
  assert.match(screen, /suggestion\.kind === "branch"/);
  assert.match(screen, /새 대화 갈래 시작/);
  assert.match(screen, /lastMessage\?\.role === "assistant"/);
  assert.match(screen, /messages\.length === 0[\s\S]*?QUICK_PROMPTS/);
  assert.match(screen, /진로 고민을 어디서부터 정리하면 좋을까요\?/);
  assert.match(screen, /지금 프로젝트에서 제가 먼저 결정해야 할 것은 무엇인가요\?/);
  assert.match(screen, /교수님께 처음에는 어떤 질문을 드리면 좋을까요\?/);
  assert.match(screen, /resolveGrowthProfessorSuggestionParentId/);
  assert.match(screen, /suggestionSourceMessage\.reflection\?\.title \?\? "현재 대화"/);
  assert.match(screenStyles, /\.branchPromptMark/);
  assert.match(screen, /getParallelBranchUserMessageIds/);
  assert.match(screen, /parallelBranchUserMessageIds\.has\(message\.id\)/);
  assert.match(screen, /conversationLineageToAssistant\(messages, parentAssistantId\)/);
  assert.match(screen, /conversationLineageToAssistant\(messages, retryParentId\)/);
  assert.match(conversationMapModel, /export function conversationLineageToAssistant/);
  assert.match(screen, /clearConversation\(\);[\s\S]*setBranchOrigin\(null\);[\s\S]*setDraft\(""\);/);
  assert.match(store, /branchParentMessageId/);
  assert.match(server, /앞의 두 개는 현재 답변을 자연스럽게 이어가는 질문/);
  assert.match(server, /세 번째도 기본값은 'continue'/);
  assert.match(server, /필요한 자료, 설명 구체화, 예시, 바로 할 행동처럼 현재 답변을 깊게 잇는 질문은 'branch'가 아닙니다/);
  assert.match(conversationMap, /suggestion\.text/);
  assert.match(conversationMap, /isStudentQuestionText\(suggestion\.text\)/);
  assert.match(conversationMap, /\.\.\.FALLBACK_BRANCH_PROMPTS\[node\.topic\]/);
  assert.doesNotMatch(conversationMap, /해볼래요|할게요|정리할래요|만들래요|볼래요/);
  assert.match(conversationMap, /BRANCH_AXES = \["비교·결정", "근거·역량", "프로젝트·실행", "교수 대화"\]/);
  assert.match(conversationMap, /branchPrompts\.map/);
  assert.match(conversationMap, /이 대화에서 이어가기/);
  assert.match(conversationMap, /className=\{styles\.nodeResumeButton\}/);
  assert.match(screenStyles, /\.nodeResumeButton/);
  assert.match(conversationMap, /onClick=\{\(\) => onStartBranch\(selectedNode\.id, "", selectedNode\.title\)\}/);
  assert.match(conversationMap, /nodeDetailRef\.current\?\.scrollIntoView\(\{ block: "start", behavior: "smooth" \}\)/);
  assert.doesNotMatch(conversationMap, /manualBranchButton/);
  assert.match(screen, /setBranchOrigin\(\{ parentId, title \}\)/);
  assert.match(screen, /changeViewMode\("chat"\)/);
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
  assert.match(mobileBlock, /\.mapTree > \.mapTreeItem > \.mapNode \{[\s\S]*?width: 252px/);
  assert.match(mobileBlock, /\.mapTree ol \.mapNode \{[\s\S]*?width: 200px/);
  assert.match(mobileBlock, /\.mapCanvas \{[\s\S]*?overflow: auto/);
  assert.doesNotMatch(mobileBlock, /overflow-x: hidden/);
  assert.match(screenStyles, /\.mapFocusButton \{/);
  assert.match(mobileBlock, /\.nodeDecisionBox \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(mobileBlock, /\.nodeDecisionBox > div button \{[\s\S]*?min-height: 40px/);
  assert.match(mobileBlock, /\.nodeConnections > div \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(conversationMap, /mapOutcomeArrow/);
});
