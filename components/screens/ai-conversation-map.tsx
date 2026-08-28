"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Bookmark,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Eye,
  EyeOff,
  GitBranch,
  Scissors,
  Lightbulb,
  ListChecks,
  LocateFixed,
  Map as MapIcon,
  MessageCircleMore,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  buildConversationMap,
  getConversationMapRoots,
  getPrunedNodeIds,
  summarizePrunedBranch,
  type ConversationMapNode,
  type ConversationMapNodeType,
} from "@/lib/ai-conversation-map";
import type {
  AiConversationMapDecision,
  AiGrowthNote,
  AiProfessorMessage,
} from "@/store/ai-professor-store";
import styles from "./ai-professor-screen.module.css";

type AiConversationMapProps = {
  messages: AiProfessorMessage[];
  growthNotes: AiGrowthNote[];
  mapDecisions: Record<string, AiConversationMapDecision>;
  onSetDecision: (messageId: string, decision: AiConversationMapDecision) => void;
  onClearDecision: (messageId: string) => void;
  onSaveReflection: (messageId: string) => "saved" | "already-saved" | "missing";
  onBackToChat: () => void;
  onStartBranch: (parentId: string, prompt: string, title: string) => void;
};

const TYPE_ICONS = {
  question: CircleHelp,
  insight: Lightbulb,
  decision: Target,
  action: ListChecks,
} satisfies Record<ConversationMapNodeType, typeof CircleHelp>;

const JOURNEY_LABELS = {
  question: "생각 씨앗",
  insight: "발견한 단서",
  decision: "선택한 갈림길",
  action: "다음 발걸음",
} satisfies Record<ConversationMapNodeType, string>;

const BRANCH_AXES = ["비교·결정", "근거·역량", "프로젝트·실행", "교수 대화"] as const;

const FALLBACK_BRANCH_PROMPTS = {
  "진로 방향": [
    "비슷한 진로를 기준별로 비교해 볼래요",
    "이 방향에 필요한 역량을 확인할래요",
    "일주일 안에 해볼 작은 경험을 정할래요",
    "교수님께 물어볼 첫 질문을 만들래요",
  ],
  프로젝트: [
    "두 아이디어의 장단점을 비교해 볼래요",
    "이 주제에 필요한 근거와 역량을 볼래요",
    "가장 작은 실험부터 설계해 볼래요",
    "교수님께 검토받을 질문을 만들래요",
  ],
  "교수 만남": [
    "어떤 교수님부터 만날지 비교해 볼래요",
    "대화 전 확인할 근거를 정리할래요",
    "면담 뒤 실행할 한 걸음을 정할래요",
    "교수님께 드릴 핵심 질문을 다듬을래요",
  ],
  "생각 정리": [
    "선택 기준을 세워 비교해 볼래요",
    "내 생각의 근거와 빈틈을 확인할래요",
    "작게 시험해 볼 행동을 정할래요",
    "교수님께 물어볼 말로 바꿔 볼래요",
  ],
} satisfies Record<ConversationMapNode["topic"], [string, string, string, string]>;

function getBranchPrompts(node: ConversationMapNode) {
  const prompts = node.assistantMessage.suggestedPrompts.filter(Boolean);
  return prompts.length >= 4 ? prompts.slice(0, 4) : FALLBACK_BRANCH_PROMPTS[node.topic];
}

function excerpt(value: string, max = 260) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max).trim()}…` : normalized;
}

export function AiConversationMap({
  messages,
  growthNotes,
  mapDecisions,
  onSetDecision,
  onClearDecision,
  onSaveReflection,
  onBackToChat,
  onStartBranch,
}: AiConversationMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [status, setStatus] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const nodeDetailRef = useRef<HTMLElement>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const nodes = useMemo(
    () => buildConversationMap(messages, growthNotes),
    [growthNotes, messages],
  );
  // 접은 노드와 그 아래 자란 생각까지 함께 감춘다.
  // 후손을 남기면 부모 없는 자식이 최상위 루트로 승격돼 지도가 흩어진다.
  const prunedIds = useMemo(
    () => getPrunedNodeIds(nodes, mapDecisions),
    [mapDecisions, nodes],
  );
  const visibleNodes = useMemo(
    () => nodes.filter((node) => showExcluded || !prunedIds.has(node.id)),
    [nodes, prunedIds, showExcluded],
  );
  const roots = useMemo(() => getConversationMapRoots(visibleNodes), [visibleNodes]);
  const prunedCount = prunedIds.size;
  // 부모까지 접혀 사라진 갈래는 자식 자리에 칩이 붙지만, 최상위에서 접힌 갈래는
  // 붙을 부모가 없다. 지도 맨 앞에 따로 자리를 남긴다.
  const prunedRoots = useMemo(
    () => (showExcluded ? [] : nodes
      .filter((node) => mapDecisions[node.id] === "exclude"
        && (!node.parentId || !prunedIds.has(node.parentId)))
      .filter((node) => !node.parentId || !nodes.some((candidate) => candidate.id === node.parentId))
      .map((node) => ({ id: node.id, ...summarizePrunedBranch(nodes, node.id, mapDecisions) }))),
    [mapDecisions, nodes, prunedIds, showExcluded],
  );
  const selectedNode = nodes.find((node) => node.id === selectedId) ?? visibleNodes[0] ?? null;
  const branchPrompts = selectedNode ? getBranchPrompts(selectedNode) : [];
  const branchPointCount = useMemo(
    () => nodes.filter((node) => node.childIds.length > 1).length,
    [nodes],
  );
  const activePathIds = useMemo(() => {
    const path = new Set<string>();
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    let cursor: ConversationMapNode | null = selectedNode;

    while (cursor && !path.has(cursor.id)) {
      path.add(cursor.id);
      cursor = cursor.parentId ? nodeById.get(cursor.parentId) ?? null : null;
    }

    return path;
  }, [nodes, selectedNode]);

  const focusMap = useCallback((behavior: ScrollBehavior = "smooth") => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;

    canvas.scrollTo({
      left: Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2),
      top: 0,
      behavior,
    });
  }, []);

  const beginMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [role='button']")) return;

    const canvas = event.currentTarget;
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: canvas.scrollLeft,
      top: canvas.scrollTop,
    };
    canvas.setPointerCapture(event.pointerId);
    isPanningRef.current = true;
    setIsPanning(true);
  };

  const moveMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const canvas = event.currentTarget;
    canvas.scrollLeft = panStartRef.current.left - (event.clientX - panStartRef.current.x);
    canvas.scrollTop = panStartRef.current.top - (event.clientY - panStartRef.current.y);
    event.preventDefault();
  };

  const endMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    isPanningRef.current = false;
    setIsPanning(false);
  };

  const moveMapWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const distances: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-80, 0],
      ArrowRight: [80, 0],
      ArrowUp: [0, -80],
      ArrowDown: [0, 80],
    };
    if (event.key === "Home") {
      event.preventDefault();
      focusMap();
      return;
    }
    const distance = distances[event.key];
    if (!distance) return;
    event.preventDefault();
    event.currentTarget.scrollBy({ left: distance[0], top: distance[1], behavior: "smooth" });
  };

  const selectNode = (id: string) => {
    setSelectedId(id);
    setStatus("");
    window.requestAnimationFrame(() => {
      nodeDetailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  useEffect(() => {
    if (!selectedId && visibleNodes[0]) setSelectedId(visibleNodes[0].id);
    if (selectedId && !nodes.some((node) => node.id === selectedId)) {
      setSelectedId(visibleNodes[0]?.id ?? null);
      setStatus("");
    }
  }, [nodes, selectedId, visibleNodes]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => focusMap("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusMap, showExcluded, visibleNodes.length]);

  if (!nodes.length) {
    return (
      <section className={styles.mapEmpty} aria-labelledby="conversation-map-title">
        <span className={styles.mapEmptyIcon}><GitBranch size={31} aria-hidden="true" /></span>
        <p className={styles.mapEyebrow}>나의 상상나무</p>
        <h2 id="conversation-map-title">AI와 대화하면 생각이 한 그루의 나무로 자라요</h2>
        <p>질문에서 발견한 단서와 선택, 다음 행동을 카드로 연결해 내가 어떻게 고민하고 성장했는지 보여드려요.</p>
        <button type="button" onClick={onBackToChat}>
          <MessageCircleMore size={18} aria-hidden="true" /> 첫 대화 시작하기
        </button>
      </section>
    );
  }

  return (
    <section className={styles.mapSection} aria-labelledby="conversation-map-title">
      <header className={styles.mapHeader}>
        <div>
          <p className={styles.mapEyebrow}><Sparkles size={14} aria-hidden="true" /> AI 대화에서 자동으로 자라요</p>
          <h2 id="conversation-map-title">AI 대화로 자라는 나의 상상나무</h2>
          <p>어떤 대화를 거쳐 생각이 갈라지고, 발견이 선택과 행동으로 이어졌는지 한눈에 확인해요.</p>
        </div>
        <div className={styles.mapSummary} aria-label="상상나무 요약">
          <span><strong>{nodes.length}</strong>개 생각 카드</span>
          <span><strong>{branchPointCount}</strong>개 갈림점</span>
          <span><strong>{growthNotes.length}</strong>개 성장 메모</span>
        </div>
      </header>

      <div className={styles.mapWorkspace}>
        <div className={styles.mapCanvasWrap}>
          <div className={styles.mapCanvasToolbar}>
            <div>
              <MapIcon size={17} aria-hidden="true" />
              <strong>나의 상상나무</strong>
              <span>질문 씨앗부터 성장의 다음 걸음까지</span>
            </div>
            {prunedCount ? (
              <button
                type="button"
                aria-pressed={showExcluded}
                onClick={() => setShowExcluded((value) => !value)}
              >
                {showExcluded ? <EyeOff size={15} /> : <Eye size={15} />}
                접은 생각 {prunedCount}개 {showExcluded ? "숨기기" : "보기"}
              </button>
            ) : null}
          </div>

          <div
            ref={mapCanvasRef}
            className={styles.mapCanvas}
            data-panning={isPanning ? "true" : "false"}
            aria-label="AI 대화로 자라는 나의 상상나무. 빈 공간을 드래그하거나 방향키로 이동할 수 있습니다."
            tabIndex={0}
            onKeyDown={moveMapWithKeyboard}
            onPointerDown={beginMapPan}
            onPointerMove={moveMapPan}
            onPointerUp={endMapPan}
            onPointerCancel={endMapPan}
          >
            <div className={styles.mapGraph}>
              <p className={styles.mapSignatureNote}>
                <GitBranch size={14} aria-hidden="true" /> 카드를 고르면 지나온 생각 줄기가 빛나요 · 오른쪽에서 가지치기할 수 있어요
              </p>
              <div className={styles.mapStartNode}>
                <span><MessageCircleMore size={17} aria-hidden="true" /></span>
                <div><strong>대화 시작</strong><small>내 고민을 말했어요</small></div>
              </div>
              <ArrowDown className={styles.mapDownArrow} size={18} aria-hidden="true" />

              <ol className={styles.mapTree}>
                {prunedRoots.map((branch) => (
                  <li key={`pruned-root-${branch.id}`} className={styles.mapTreeItem} data-depth={0}>
                    <button
                      type="button"
                      className={styles.prunedBranch}
                      onClick={() => {
                        onClearDecision(branch.id);
                        setStatus(`접었던 갈래 ${branch.total}개를 다시 펼쳤어요.`);
                      }}
                    >
                      <Scissors size={14} aria-hidden="true" />
                      <span>
                        <strong>생각 {branch.total}개 접힘</strong>
                        <small>{branch.keptInside ? `핵심 ${branch.keptInside}개 포함 · 펼치기` : "펼치기"}</small>
                      </span>
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {roots.map((node) => (
                  <ConversationTreeNode
                    key={node.id}
                    node={node}
                    nodes={visibleNodes}
                    allNodes={nodes}
                    selectedId={selectedNode?.id ?? null}
                    activePathIds={activePathIds}
                    decisions={mapDecisions}
                    onSelect={selectNode}
                    onRestoreBranch={(id) => {
                      const { total } = summarizePrunedBranch(nodes, id, mapDecisions);
                      onClearDecision(id);
                      setStatus(`접었던 갈래 ${total}개를 다시 펼쳤어요.`);
                    }}
                  />
                ))}
              </ol>

              {!visibleNodes.length ? (
                <div className={styles.allExcluded}>
                  <EyeOff size={21} aria-hidden="true" />
                  <p>지금 펼쳐진 흐름이 없어요.</p>
                  <button type="button" onClick={() => setShowExcluded(true)}>접은 흐름 확인하기</button>
                </div>
              ) : (
                <>
                  <ArrowDown className={styles.mapOutcomeArrow} size={18} aria-hidden="true" />
                  <div className={styles.mapOutcomeNode}>
                    <Compass size={18} aria-hidden="true" />
                    <div><strong>지금의 나침반</strong><small>남긴 핵심을 교수 만남과 프로젝트로 이어가요</small></div>
                  </div>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.mapFocusButton}
            onClick={() => focusMap()}
            aria-label="생각 지도의 시작점으로 초점 맞추기"
          >
            <LocateFixed size={16} aria-hidden="true" /> 초점
          </button>
        </div>

        {selectedNode ? (
          <aside ref={nodeDetailRef} className={styles.nodeDetail} aria-label="선택한 대화 주제 세부 카드">
            <header className={styles.nodeDetailHeader}>
              <div className={styles.nodeTags}>
                <span data-type={selectedNode.type}>{selectedNode.typeLabel}</span>
                <span>{selectedNode.topic}</span>
                <span>AI 정리</span>
              </div>
              <h3>{selectedNode.title}</h3>
              <p>{selectedNode.mapSummary}</p>
              <button
                type="button"
                className={styles.nodeBranchButton}
                aria-label={`‘${selectedNode.title}’ 생각에서 가지치기하여 새 대화 시작하기`}
                onClick={() => onStartBranch(selectedNode.id, "", selectedNode.title)}
              >
                <span className={styles.nodeBranchIcon}><GitBranch size={17} aria-hidden="true" /></span>
                <span className={styles.nodeBranchCopy}>
                  <strong>이 카드에서 가지치기</strong>
                  <small>이 생각을 출발점으로 새 질문을 시작해요</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </header>

            <section className={styles.nodeBranches} aria-label="선택한 생각에서 만들 수 있는 새 가지">
              <div className={styles.nodeBranchesHeading}>
                <div>
                  <h4><GitBranch size={15} aria-hidden="true" /> 추천 가지</h4>
                  <p>비교·근거·실행·교수 대화 중 하나를 고르면 이 카드 옆에서 새 흐름이 자라요.</p>
                </div>
                <span>{selectedNode.childIds.length ? `현재 ${selectedNode.childIds.length}개` : `${branchPrompts.length}개 제안`}</span>
              </div>
              {branchPrompts.length ? (
                <div className={styles.branchSuggestions}>
                  {branchPrompts.map((prompt, index) => (
                    <button
                      key={prompt}
                      type="button"
                      aria-label={`‘${selectedNode.title}’에서 ${BRANCH_AXES[index]} 가지 만들기: ${prompt}`}
                      onClick={() => onStartBranch(selectedNode.id, prompt, selectedNode.title)}
                    >
                      <span>{index + 1}</span>
                      <span className={styles.branchSuggestionCopy}>
                        <small>{BRANCH_AXES[index]}</small>
                        <strong>{prompt}</strong>
                      </span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <div className={styles.nodeDecisionBox}>
              <strong>지도 표시</strong>
              <p>원문 대화는 삭제되지 않아요.</p>
              <div>
                <button
                  type="button"
                  data-active={mapDecisions[selectedNode.id] === "keep"}
                  aria-pressed={mapDecisions[selectedNode.id] === "keep"}
                  onClick={() => {
                    onSetDecision(selectedNode.id, "keep");
                    setStatus("이 생각을 핵심 흐름으로 남겼어요.");
                  }}
                >
                  <Bookmark size={16} aria-hidden="true" /> 핵심으로 남기기
                </button>
                <button
                  type="button"
                  data-active={mapDecisions[selectedNode.id] === "exclude"}
                  aria-pressed={mapDecisions[selectedNode.id] === "exclude"}
                  onClick={() => {
                    const { total } = summarizePrunedBranch(nodes, selectedNode.id, mapDecisions);
                    onSetDecision(selectedNode.id, "exclude");
                    setStatus(
                      total > 1
                        ? `이 갈래에 달린 생각 ${total}개를 함께 접었어요. 접힌 자리에서 다시 펼칠 수 있어요.`
                        : "이 생각을 접었어요. 접힌 자리에서 다시 펼칠 수 있어요.",
                    );
                  }}
                >
                  <Scissors size={16} aria-hidden="true" />
                  {(() => {
                    const { total } = summarizePrunedBranch(nodes, selectedNode.id, mapDecisions);
                    return total > 1 ? `이 갈래 접기 (${total}개)` : "이 생각 접기";
                  })()}
                </button>
              </div>
              {mapDecisions[selectedNode.id] ? (
                <button
                  type="button"
                  className={styles.resetDecision}
                  onClick={() => {
                    onClearDecision(selectedNode.id);
                    setStatus("지도 표시를 기본 상태로 되돌렸어요.");
                  }}
                >
                  <RotateCcw size={13} aria-hidden="true" /> 선택 되돌리기
                </button>
              ) : null}
            </div>

            <details key={`source-${selectedNode.id}`} className={styles.nodeSources}>
              <summary>
                <span>
                  <strong>원문 대화</strong>
                  <small>내 질문과 AI 답변 전체 보기</small>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className={styles.nodeSourcesBody}>
                <article>
                  <span>내 질문</span>
                  <p>{selectedNode.userMessage ? excerpt(selectedNode.userMessage.content) : "연결된 질문이 없어요."}</p>
                </article>
                <article>
                  <span>AI 교수님 답변</span>
                  <p className={styles.nodeSourceFullText}>{selectedNode.assistantMessage.content}</p>
                </article>
              </div>
            </details>

            <section className={styles.nodeConnections}>
              <h4><GitBranch size={15} aria-hidden="true" /> 연결된 흐름</h4>
              <div>
                <ConnectionButton
                  direction="previous"
                  node={nodes.find((node) => node.id === selectedNode.previousId) ?? null}
                  onSelect={selectNode}
                />
                {selectedNode.childIds.length ? selectedNode.childIds.map((childId) => (
                  <ConnectionButton
                    key={childId}
                    direction="next"
                    node={nodes.find((node) => node.id === childId) ?? null}
                    onSelect={selectNode}
                  />
                )) : (
                  <ConnectionButton direction="next" node={null} onSelect={selectNode} />
                )}
              </div>
            </section>

            <button
              type="button"
              className={styles.saveToGrowth}
              disabled={selectedNode.isSaved || !selectedNode.assistantMessage.reflection}
              onClick={() => {
                const result = onSaveReflection(selectedNode.id);
                setStatus(result === "saved" ? "나의 성장과정 메모에 반영했어요." : "이미 성장 메모에 반영된 내용이에요.");
              }}
            >
              {selectedNode.isSaved ? <Check size={17} /> : <BookOpenCheck size={17} />}
              {selectedNode.isSaved ? "성장 메모에 반영됨" : "나의 성장과정에 반영하기"}
            </button>
            {status ? <p className={styles.nodeStatus} role="status">{status}</p> : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function ConversationTreeNode({
  node,
  nodes,
  allNodes,
  selectedId,
  activePathIds,
  decisions,
  onSelect,
  onRestoreBranch,
}: {
  node: ConversationMapNode;
  nodes: ConversationMapNode[];
  allNodes: ConversationMapNode[];
  selectedId: string | null;
  activePathIds: Set<string>;
  decisions: Record<string, AiConversationMapDecision>;
  onRestoreBranch: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[node.type];
  const journeyLabel = JOURNEY_LABELS[node.type];
  const decision = decisions[node.id];
  const children = node.childIds
    .map((id) => nodes.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ConversationMapNode => Boolean(candidate));
  // 접혀서 지금 지도에 없는 자식. 자리를 비워 두지 않고 되돌릴 수 있는 표시를 남긴다.
  const prunedChildren = node.childIds
    .filter((id) => !children.some((child) => child.id === id))
    .map((id) => ({ id, ...summarizePrunedBranch(allNodes, id, decisions) }))
    .filter((entry) => entry.total > 0);

  return (
    <li
      className={styles.mapTreeItem}
      data-depth={node.depth}
      data-level={node.depth === 0 ? "trunk" : node.depth === 1 ? "branch" : "twig"}
      data-child-count={children.length}
      data-on-path={activePathIds.has(node.id) ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.mapNode}
        data-type={node.type}
        data-selected={selectedId === node.id ? "true" : "false"}
        data-on-path={activePathIds.has(node.id) ? "true" : "false"}
        data-decision={decision ?? "none"}
        data-branching={children.length > 1 ? "true" : "false"}
        aria-pressed={selectedId === node.id}
        aria-label={`${journeyLabel}, ${node.title}, ${children.length}개 가지${selectedId === node.id ? ", 선택됨" : ""}`}
        onClick={() => onSelect(node.id)}
      >
        <span className={styles.mapNodeMeta}>
          <span><Icon size={14} aria-hidden="true" /> {journeyLabel}</span>
          <small>{node.topic}</small>
        </span>
        <strong>{node.title}</strong>
        <p>{node.mapSummary}</p>
        <span className={styles.mapNodeState}>
          {decision === "keep" ? <><Bookmark size={13} fill="currentColor" /> 핵심으로 남김</> : null}
          {decision === "exclude" ? <><Scissors size={13} /> 접힌 갈래</> : null}
          {!decision && children.length > 1 ? <><GitBranch size={13} /> 생각 가지 {children.length}개가 열렸어요</> : null}
          {!decision && children.length <= 1 && node.isSaved ? <><Check size={13} /> 성장 메모에 반영</> : null}
          {!decision && children.length <= 1 && !node.isSaved ? <>원문 대화 열기 <ArrowRight size={13} /></> : null}
        </span>
      </button>
      {children.length || prunedChildren.length ? (
        <ol>
          {children.map((child) => (
            <ConversationTreeNode
              key={child.id}
              node={child}
              nodes={nodes}
              allNodes={allNodes}
              selectedId={selectedId}
              activePathIds={activePathIds}
              decisions={decisions}
              onRestoreBranch={onRestoreBranch}
              onSelect={onSelect}
            />
          ))}
          {prunedChildren.map((branch) => (
            <li key={`pruned-${branch.id}`} className={styles.mapTreeItem} data-depth={node.depth + 1}>
              <button
                type="button"
                className={styles.prunedBranch}
                onClick={() => onRestoreBranch(branch.id)}
              >
                <Scissors size={14} aria-hidden="true" />
                <span>
                  <strong>생각 {branch.total}개 접힘</strong>
                  <small>
                    {branch.keptInside
                      ? `핵심 ${branch.keptInside}개 포함 · 펼치기`
                      : "펼치기"}
                  </small>
                </span>
                <RotateCcw size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function ConnectionButton({
  direction,
  node,
  onSelect,
}: {
  direction: "previous" | "next";
  node: ConversationMapNode | null;
  onSelect: (id: string) => void;
}) {
  return (
    <button type="button" disabled={!node} onClick={() => node && onSelect(node.id)}>
      {direction === "previous" ? <ArrowLeft size={14} /> : null}
      <span>
        <small>{direction === "previous" ? "이전 흐름" : "다음 흐름"}</small>
        <strong>{node?.title ?? (direction === "previous" ? "대화 시작" : "현재 마지막 흐름")}</strong>
      </span>
      {direction === "next" ? <ArrowRight size={14} /> : null}
    </button>
  );
}
