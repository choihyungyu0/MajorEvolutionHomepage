"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArchiveRestore,
  BookOpenCheck,
  Bookmark,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  EyeOff,
  GitBranch,
  Lightbulb,
  ListChecks,
  LocateFixed,
  Map as MapIcon,
  MessageCircleMore,
  Minus,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Target,
} from "lucide-react";
import {
  applyConversationMapDetachments,
  buildConversationMap,
  countConversationMapTypes,
  getConversationMapRoots,
  getConversationSubtreeIds,
  getRenderableConversationMapNodes,
  type ConversationMapNode,
  type ConversationMapNodeType,
} from "@/lib/ai-conversation-map";
import type {
  AiConversationMapDecision,
  AiGrowthNote,
  AiProfessorMessage,
} from "@/store/ai-professor-store";
import { isStudentQuestionText } from "@/lib/ai-growth-professor";
import styles from "./ai-professor-screen.module.css";

type AiConversationMapProps = {
  messages: AiProfessorMessage[];
  growthNotes: AiGrowthNote[];
  mapDecisions: Record<string, AiConversationMapDecision>;
  collapsedMapNodeIds: string[];
  detachedMapNodeIds: string[];
  onSetDecision: (messageId: string, decision: AiConversationMapDecision) => void;
  onClearDecision: (messageId: string) => void;
  onToggleCollapsedMapNode: (messageId: string) => void;
  onClearCollapsedMapNode: (messageId: string) => void;
  onDetachMapNode: (messageId: string) => void;
  onAttachMapNode: (messageId: string) => void;
  onHideMapBranch: (messageId: string) => void;
  onRestoreMapBranch: (messageId: string) => void;
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
    "비슷해 보이는 진로는 어떤 기준으로 비교하면 좋을까요?",
    "이 진로를 이해하려면 어떤 역량과 근거를 먼저 확인해야 하나요?",
    "제 상황에서는 어떤 작은 경험부터 시작하면 좋을까요?",
    "교수님께 진로 방향을 여쭤볼 때 무엇부터 질문하면 좋을까요?",
  ],
  프로젝트: [
    "두 아이디어는 어떤 기준으로 비교하면 좋을까요?",
    "이 주제를 검토하려면 어떤 자료와 역량이 필요한가요?",
    "이 프로젝트는 어떻게 작게 실험해 볼 수 있나요?",
    "교수님께 프로젝트를 설명할 때 어떤 질문부터 드리면 좋을까요?",
  ],
  "교수 만남": [
    "어떤 교수님께 먼저 여쭤볼지 무엇을 기준으로 비교하면 좋을까요?",
    "면담 전에 제가 확인해야 할 공식 정보는 무엇인가요?",
    "면담 내용을 실제 행동으로 옮기려면 무엇부터 하면 좋을까요?",
    "교수님께 제 고민을 어떻게 질문하면 좋을까요?",
  ],
  "생각 정리": [
    "두 선택지를 비교하려면 어떤 기준이 필요한가요?",
    "제 생각에서 근거가 부족한 부분은 무엇인가요?",
    "지금 상황에서 무엇부터 작게 확인하면 좋을까요?",
    "이 고민을 교수님께 어떻게 질문하면 좋을까요?",
  ],
} satisfies Record<ConversationMapNode["topic"], [string, string, string, string]>;

function getBranchPrompts(node: ConversationMapNode) {
  const prompts = node.assistantMessage.suggestedPrompts
    .filter((suggestion) => isStudentQuestionText(suggestion.text))
    .map((suggestion) => suggestion.text);
  return Array.from(new Set([
    ...prompts,
    ...FALLBACK_BRANCH_PROMPTS[node.topic],
  ])).slice(0, 4);
}

function excerpt(value: string, max = 260) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max).trim()}…` : normalized;
}

export function AiConversationMap({
  messages,
  growthNotes,
  mapDecisions,
  collapsedMapNodeIds,
  detachedMapNodeIds,
  onSetDecision,
  onClearDecision,
  onToggleCollapsedMapNode,
  onClearCollapsedMapNode,
  onDetachMapNode,
  onAttachMapNode,
  onHideMapBranch,
  onRestoreMapBranch,
  onSaveReflection,
  onBackToChat,
  onStartBranch,
}: AiConversationMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(100);
  const [status, setStatus] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const nodeDetailRef = useRef<HTMLElement>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const originalNodes = useMemo(
    () => buildConversationMap(messages, growthNotes),
    [growthNotes, messages],
  );
  const nodes = useMemo(
    () => applyConversationMapDetachments(originalNodes, detachedMapNodeIds),
    [detachedMapNodeIds, originalNodes],
  );
  const collapsedNodeIdSet = useMemo(
    () => new Set(collapsedMapNodeIds),
    [collapsedMapNodeIds],
  );
  const detachedNodeIdSet = useMemo(
    () => new Set(detachedMapNodeIds),
    [detachedMapNodeIds],
  );
  const visibleNodes = useMemo(
    () => getRenderableConversationMapNodes(nodes, mapDecisions, collapsedMapNodeIds),
    [collapsedMapNodeIds, mapDecisions, nodes],
  );
  const counts = useMemo(() => countConversationMapTypes(nodes), [nodes]);
  const roots = useMemo(() => getConversationMapRoots(visibleNodes), [visibleNodes]);
  const archivedRoots = useMemo(() => nodes.filter((node) => {
    if (mapDecisions[node.id] !== "exclude") return false;
    let parentId = node.parentId;
    while (parentId) {
      if (mapDecisions[parentId] === "exclude") return false;
      parentId = nodes.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }
    return true;
  }), [mapDecisions, nodes]);
  const selectedNode = visibleNodes.find((node) => node.id === selectedId) ?? visibleNodes[0] ?? null;
  const selectedOriginalNode = selectedNode
    ? originalNodes.find((node) => node.id === selectedNode.id) ?? selectedNode
    : null;
  const selectedSubtreeCount = selectedNode
    ? Math.max(0, getConversationSubtreeIds(nodes, selectedNode.id).length - 1)
    : 0;
  const selectedIsCollapsed = selectedNode ? collapsedNodeIdSet.has(selectedNode.id) : false;
  const selectedIsDetached = selectedNode ? detachedNodeIdSet.has(selectedNode.id) : false;
  const selectedCanDetach = Boolean(selectedOriginalNode?.parentId);
  const branchPrompts = selectedNode ? getBranchPrompts(selectedNode) : [];

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

  const changeMapZoom = (nextZoom: number) => {
    setMapZoom(Math.min(130, Math.max(70, nextZoom)));
  };

  useEffect(() => {
    if (!selectedId && visibleNodes[0]) setSelectedId(visibleNodes[0].id);
    if (selectedId && !visibleNodes.some((node) => node.id === selectedId)) {
      setSelectedId(visibleNodes[0]?.id ?? null);
      setStatus("");
    }
  }, [nodes, selectedId, visibleNodes]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => focusMap("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusMap, visibleNodes.length]);

  if (!nodes.length) {
    return (
      <section className={styles.mapEmpty} aria-labelledby="conversation-map-title">
        <span className={styles.mapEmptyIcon}><GitBranch size={31} aria-hidden="true" /></span>
        <p className={styles.mapEyebrow}>대화 지도</p>
        <h2 id="conversation-map-title">대화를 나누면 생각의 흐름이 여기에 연결돼요</h2>
        <p>내 질문과 AI 교수님의 답변을 바탕으로 질문·발견·결정·다음 행동 카드를 만들어요.</p>
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
          <p className={styles.mapEyebrow}><Sparkles size={14} aria-hidden="true" /> 대화에서 자동 정리</p>
          <h2 id="conversation-map-title">대화가 자라는 나의 생각 지도</h2>
          <p>긴 대화는 한 줄 핵심으로 접고, 새 질문이 생기면 실제 가지처럼 갈라져요. 노드를 누르면 원문과 앞뒤 흐름이 열려요.</p>
        </div>
        <div className={styles.mapSummary} aria-label="대화 지도 요약">
          <span><strong>{nodes.length}</strong>개 주제</span>
          <span><strong>{counts.decision + counts.action}</strong>개 결정·행동</span>
          <span><strong>{growthNotes.length}</strong>개 성장 메모</span>
        </div>
      </header>

      <div className={styles.mapWorkspace}>
        <div className={styles.mapCanvasWrap}>
          <div className={styles.mapCanvasToolbar}>
            <div>
              <MapIcon size={17} aria-hidden="true" />
              <strong>생각 진화 지도</strong>
              <span>씨앗부터 다음 발걸음까지</span>
            </div>
            <span className={styles.mapCanvasHint}>카드를 눌러 가지를 관리하세요</span>
          </div>

          <div
            ref={mapCanvasRef}
            className={styles.mapCanvas}
            data-panning={isPanning ? "true" : "false"}
            aria-label="나의 생각 진화 갈래 지도. 빈 공간을 드래그하거나 방향키로 이동할 수 있습니다."
            tabIndex={0}
            onKeyDown={moveMapWithKeyboard}
            onPointerDown={beginMapPan}
            onPointerMove={moveMapPan}
            onPointerUp={endMapPan}
            onPointerCancel={endMapPan}
          >
            <div
              className={styles.mapGraph}
              style={{ zoom: mapZoom / 100, minWidth: `${10000 / mapZoom}%` }}
            >
              <p className={styles.mapSignatureNote}>
                <GitBranch size={14} aria-hidden="true" /> 대화가 깊어지면 새 질문은 옆 가지로 자라요 · 빈 공간을 드래그해 살펴보세요
              </p>
              <div className={styles.mapStartNode}>
                <span><MessageCircleMore size={17} aria-hidden="true" /></span>
                <div><strong>대화 시작</strong><small>내 고민을 말했어요</small></div>
              </div>
              <ArrowDown className={styles.mapDownArrow} size={18} aria-hidden="true" />

              <ol
                className={styles.mapTree}
                data-multiple-roots={roots.length > 1 ? "true" : "false"}
              >
                {roots.map((node) => (
                  <ConversationTreeNode
                    key={node.id}
                    node={node}
                    nodes={visibleNodes}
                    selectedId={selectedNode?.id ?? null}
                    decisions={mapDecisions}
                    allNodes={nodes}
                    collapsedNodeIds={collapsedNodeIdSet}
                    detachedNodeIds={detachedNodeIdSet}
                    onSelect={selectNode}
                  />
                ))}
              </ol>

              {!visibleNodes.length ? (
                <div className={styles.allExcluded}>
                  <EyeOff size={21} aria-hidden="true" />
                  <p>모든 가지가 숨겨져 있어요.</p>
                  <button type="button" onClick={() => setIsArchiveOpen(true)}>숨긴 가지 확인하기</button>
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
          <div className={styles.mapLowerControls}>
            <div className={styles.mapZoomControls} aria-label="생각 지도 확대와 축소">
              <button
                type="button"
                aria-label="생각 지도 축소"
                disabled={mapZoom <= 70}
                onClick={() => changeMapZoom(mapZoom - 10)}
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.mapZoomReset}
                aria-label={`현재 배율 ${mapZoom}퍼센트. 100퍼센트로 되돌리기`}
                onClick={() => changeMapZoom(100)}
              >
                {mapZoom}%
              </button>
              <button
                type="button"
                aria-label="생각 지도 확대"
                disabled={mapZoom >= 130}
                onClick={() => changeMapZoom(mapZoom + 10)}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className={styles.mapArchiveButton}
              aria-expanded={isArchiveOpen}
              aria-controls="conversation-map-archive"
              onClick={() => setIsArchiveOpen((value) => !value)}
            >
              <EyeOff size={15} aria-hidden="true" /> 숨긴 가지 {archivedRoots.length}개
            </button>
          </div>
          {isArchiveOpen ? (
            <aside
              id="conversation-map-archive"
              className={styles.mapArchiveDrawer}
              aria-label="숨긴 대화 가지"
            >
              <header>
                <div>
                  <strong>숨긴 가지</strong>
                  <span>원문 대화는 삭제되지 않아요.</span>
                </div>
                <button type="button" onClick={() => setIsArchiveOpen(false)} aria-label="숨긴 가지 목록 닫기">×</button>
              </header>
              {archivedRoots.length ? (
                <ul>
                  {archivedRoots.map((node) => {
                    const archivedCardCount = getConversationSubtreeIds(nodes, node.id).length;
                    return (
                      <li key={node.id}>
                        <div>
                          <small>{node.topic} · 카드 {archivedCardCount}개</small>
                          <strong>{node.title}</strong>
                          <p>{node.mapSummary}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreMapBranch(node.id);
                            setSelectedId(node.id);
                            setStatus("숨긴 가지를 원래 위치에 복원했어요.");
                          }}
                        >
                          <ArchiveRestore size={14} aria-hidden="true" /> 지도에 복원
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.mapArchiveEmpty}>숨긴 가지가 아직 없어요.</p>
              )}
            </aside>
          ) : null}
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
                className={styles.nodeResumeButton}
                aria-label={`‘${selectedNode.title}’ 대화에서 새 갈래 이어가기`}
                onClick={() => onStartBranch(selectedNode.id, "", selectedNode.title)}
              >
                <span className={styles.nodeResumeIcon}><GitBranch size={17} aria-hidden="true" /></span>
                <span className={styles.nodeResumeCopy}>
                  <strong>이 대화에서 이어가기</strong>
                  <small>선택한 대화까지 이어받아 새 질문을 시작해요</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.nodeDecisionBox}>
              <strong>이 카드에서 가지치기</strong>
              <p>현재 카드와 하위 카드 {selectedSubtreeCount}개를 접거나, 독립된 가지로 분리하고 지도에서 숨길 수 있어요.</p>
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
                {selectedSubtreeCount ? (
                  <button
                    type="button"
                    data-active={selectedIsCollapsed}
                    aria-expanded={!selectedIsCollapsed}
                    onClick={() => {
                      onToggleCollapsedMapNode(selectedNode.id);
                      setStatus(selectedIsCollapsed
                        ? `하위 카드 ${selectedSubtreeCount}개를 다시 펼쳤어요.`
                        : `하위 카드 ${selectedSubtreeCount}개를 접었어요.`);
                    }}
                  >
                    <GitBranch size={16} aria-hidden="true" />
                    {selectedIsCollapsed ? "하위 가지 펼치기" : "하위 가지 접기"}
                  </button>
                ) : null}
                {selectedCanDetach ? (
                  <button
                    type="button"
                    data-detach="true"
                    data-active={selectedIsDetached}
                    aria-pressed={selectedIsDetached}
                    onClick={() => {
                      if (selectedIsDetached) {
                        onAttachMapNode(selectedNode.id);
                        setStatus("분리한 가지를 원래 부모 카드 아래로 되돌렸어요.");
                      } else {
                        onDetachMapNode(selectedNode.id);
                        setStatus("이 카드에서 시작하는 가지를 독립된 갈래로 분리했어요.");
                      }
                    }}
                  >
                    <Scissors size={16} aria-hidden="true" />
                    {selectedIsDetached ? "원래 위치로 되돌리기" : "이 가지 분리"}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-archive="true"
                  data-active={mapDecisions[selectedNode.id] === "exclude"}
                  aria-pressed={mapDecisions[selectedNode.id] === "exclude"}
                  onClick={() => {
                    onHideMapBranch(selectedNode.id);
                    setIsArchiveOpen(true);
                    setStatus("이 카드에서 시작하는 가지를 숨겼어요.");
                  }}
                >
                  <EyeOff size={16} aria-hidden="true" /> 이 가지 숨기기
                </button>
              </div>
              {mapDecisions[selectedNode.id] || selectedIsCollapsed || selectedIsDetached ? (
                <button
                  type="button"
                  className={styles.resetDecision}
                  onClick={() => {
                    onRestoreMapBranch(selectedNode.id);
                    setStatus("가지 관리 설정을 기본 상태로 되돌렸어요.");
                  }}
                >
                  <RotateCcw size={13} aria-hidden="true" /> 가지 관리 되돌리기
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
                  node={originalNodes.find((node) => node.id === selectedOriginalNode?.previousId) ?? null}
                  onSelect={selectNode}
                />
                {selectedOriginalNode?.childIds.length ? selectedOriginalNode.childIds.map((childId) => (
                  <ConnectionButton
                    key={childId}
                    direction="next"
                    node={originalNodes.find((node) => node.id === childId) ?? null}
                    onSelect={selectNode}
                  />
                )) : (
                  <ConnectionButton direction="next" node={null} onSelect={selectNode} />
                )}
              </div>
            </section>

            <section className={styles.nodeBranches}>
              <div className={styles.nodeBranchesHeading}>
                <div>
                  <h4><GitBranch size={15} aria-hidden="true" /> 이 생각에서 새 갈래 만들기</h4>
                  <p>비교·근거·실행·교수 대화 중 다른 관점을 골라 별도 흐름으로 이어가요.</p>
                </div>
                <span>{branchPrompts.length}개 관점</span>
              </div>
              {branchPrompts.length ? (
                <div className={styles.branchSuggestions}>
                  {branchPrompts.map((prompt, index) => (
                    <button
                      key={prompt}
                      type="button"
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
  decisions,
  collapsedNodeIds,
  detachedNodeIds,
  onSelect,
}: {
  node: ConversationMapNode;
  nodes: ConversationMapNode[];
  allNodes: ConversationMapNode[];
  selectedId: string | null;
  decisions: Record<string, AiConversationMapDecision>;
  collapsedNodeIds: Set<string>;
  detachedNodeIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[node.type];
  const journeyLabel = JOURNEY_LABELS[node.type];
  const decision = decisions[node.id];
  const isCollapsed = collapsedNodeIds.has(node.id);
  const isDetached = detachedNodeIds.has(node.id);
  const originalNode = allNodes.find((candidate) => candidate.id === node.id) ?? node;
  const originalChildCount = originalNode.childIds.length;
  const hiddenDescendantCount = isCollapsed
    ? Math.max(0, getConversationSubtreeIds(allNodes, node.id).length - 1)
    : 0;
  const children = node.childIds
    .map((id) => nodes.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ConversationMapNode => Boolean(candidate));

  return (
    <li
      className={styles.mapTreeItem}
      data-depth={node.depth}
      data-child-count={children.length}
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.mapNode}
        data-type={node.type}
        data-selected={selectedId === node.id ? "true" : "false"}
        data-decision={decision ?? "none"}
        data-branching={originalChildCount > 1 ? "true" : "false"}
        data-collapsed={isCollapsed ? "true" : "false"}
        data-detached={isDetached ? "true" : "false"}
        aria-pressed={selectedId === node.id}
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
          {decision === "exclude" ? <><EyeOff size={13} /> 지도에서 제외됨</> : null}
          {!decision && isCollapsed ? <><GitBranch size={13} /> 하위 카드 {hiddenDescendantCount}개 접음</> : null}
          {!decision && !isCollapsed && children.length > 1 ? <><GitBranch size={13} /> 생각 가지 {children.length}개가 열렸어요</> : null}
          {!decision && !isCollapsed && children.length <= 1 && node.isSaved ? <><Check size={13} /> 성장 메모에 반영</> : null}
          {!decision && !isCollapsed && children.length <= 1 && !node.isSaved ? <>원문 대화 열기 <ArrowRight size={13} /></> : null}
        </span>
        {isDetached ? (
          <span className={styles.detachedNodeBadge}>
            <Scissors size={12} aria-hidden="true" /> 분리된 가지
          </span>
        ) : null}
      </button>
      {!isCollapsed && children.length ? (
        <ol>
          {children.map((child) => (
            <ConversationTreeNode
              key={child.id}
              node={child}
              nodes={nodes}
              allNodes={allNodes}
              selectedId={selectedId}
              decisions={decisions}
              collapsedNodeIds={collapsedNodeIds}
              detachedNodeIds={detachedNodeIds}
              onSelect={onSelect}
            />
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
