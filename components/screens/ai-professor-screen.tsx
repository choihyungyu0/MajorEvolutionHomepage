"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Bot,
  Check,
  GitBranch,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  MessageCircleMore,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { AiConversationMap } from "@/components/screens/ai-conversation-map";
import { requestGrowthProfessorReply } from "@/lib/ai-client";
import {
  conversationLineageToAssistant,
  getParallelBranchUserMessageIds,
} from "@/lib/ai-conversation-map";
import {
  resolveGrowthProfessorSuggestionParentId,
  type GrowthProfessorSuggestion,
  type GrowthProfessorContext,
  type GrowthProfessorMessage,
} from "@/lib/ai-growth-professor";
import {
  useAiProfessorStore,
  type AiProfessorMessage,
} from "@/store/ai-professor-store";
import { useResearchStore } from "@/store/research-store";
import styles from "./ai-professor-screen.module.css";

const QUICK_PROMPTS = [
  {
    text: "진로 고민을 어디서부터 정리하면 좋을까요?",
    kind: "continue",
    axis: "clarify",
  },
  {
    text: "지금 프로젝트에서 제가 먼저 결정해야 할 것은 무엇인가요?",
    kind: "continue",
    axis: "evidence_action",
  },
  {
    text: "교수님께 처음에는 어떤 질문을 드리면 좋을까요?",
    kind: "continue",
    axis: "alternative",
  },
] satisfies readonly GrowthProfessorSuggestion[];

const CURRENT_REPLY_LIMIT = 220;

function clipCopy(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max).trim()}…` : normalized;
}

function reflectionPart(body: string, label: string, nextLabels: string[]) {
  const start = body.indexOf(label);
  if (start < 0) return "";
  const remaining = body.slice(start + label.length).trim();
  const nextIndexes = nextLabels
    .map((nextLabel) => remaining.indexOf(nextLabel))
    .filter((index) => index >= 0);
  const end = nextIndexes.length ? Math.min(...nextIndexes) : remaining.length;
  return remaining.slice(0, end).trim();
}

function legacyReplyPreview(message: AiProfessorMessage) {
  const reflection = message.reflection?.body ?? "";
  const concern = reflectionPart(reflection, "현재 고민:", ["시도할 방향:", "다음 행동:"]);
  const action = reflectionPart(reflection, "다음 행동:", []);
  const preview = [
    concern ? `지금 고민: ${clipCopy(concern, 92)}` : "",
    action ? `먼저 해볼 일: ${clipCopy(action, 92)}` : "",
  ].filter(Boolean);
  if (preview.length) return preview;

  return [clipCopy(
    message.content.replace(/^당신의 진로 고민 핵심은\s*/u, "지금 고민은 "),
    138,
  )];
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AiProfessorScreen() {
  const hasResearchHydrated = useResearchStore((state) => state.hasHydrated);
  const conditions = useResearchStore((state) => state.conditions);
  const discovery = useResearchStore((state) => state.professorDiscoverySummary);
  const directionBaseline = useResearchStore((state) => state.growthDirectionBaseline);
  const projects = useResearchStore((state) => state.growthProjectHistory);
  const professors = useResearchStore((state) => state.growthProfessorHistory);

  const hasAiHydrated = useAiProfessorStore((state) => state.hasHydrated);
  const messages = useAiProfessorStore((state) => state.messages);
  const growthNotes = useAiProfessorStore((state) => state.growthNotes);
  const mapDecisions = useAiProfessorStore((state) => state.mapDecisions);
  const collapsedMapNodeIds = useAiProfessorStore((state) => state.collapsedMapNodeIds);
  const detachedMapNodeIds = useAiProfessorStore((state) => state.detachedMapNodeIds);
  const addUserMessage = useAiProfessorStore((state) => state.addUserMessage);
  const addAssistantMessage = useAiProfessorStore((state) => state.addAssistantMessage);
  const saveReflection = useAiProfessorStore((state) => state.saveReflection);
  const removeGrowthNote = useAiProfessorStore((state) => state.removeGrowthNote);
  const setMapDecision = useAiProfessorStore((state) => state.setMapDecision);
  const clearMapDecision = useAiProfessorStore((state) => state.clearMapDecision);
  const toggleCollapsedMapNode = useAiProfessorStore((state) => state.toggleCollapsedMapNode);
  const clearCollapsedMapNode = useAiProfessorStore((state) => state.clearCollapsedMapNode);
  const detachMapNode = useAiProfessorStore((state) => state.detachMapNode);
  const attachMapNode = useAiProfessorStore((state) => state.attachMapNode);
  const hideMapBranch = useAiProfessorStore((state) => state.hideMapBranch);
  const restoreMapBranch = useAiProfessorStore((state) => state.restoreMapBranch);
  const clearConversation = useAiProfessorStore((state) => state.clearConversation);

  const [viewMode, setViewMode] = useState<"chat" | "map" | "context">("chat");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [savedMessageId, setSavedMessageId] = useState<string | null>(null);
  const [branchOrigin, setBranchOrigin] = useState<{ parentId: string; title: string } | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const context = useMemo<GrowthProfessorContext>(() => {
    const latestProject = projects.at(-1) ?? null;
    const latestProfessor = [...professors].reverse().find((item) => item.selectedAt)
      ?? null;
    return {
      major: conditions.major || discovery?.major || directionBaseline?.major || "전공 미입력",
      interests: conditions.interests.length
        ? conditions.interests
        : discovery?.interests.length
          ? discovery.interests
          : directionBaseline?.interests ?? [],
      careerConcerns: discovery?.careerConcerns.length
        ? discovery.careerConcerns
        : directionBaseline?.careerConcerns ?? [],
      project: latestProject ? {
        title: latestProject.title,
        question: latestProject.question,
        firstAction: "다음 행동을 대화로 구체화하는 중",
      } : null,
      professor: latestProfessor ? {
        name: latestProfessor.name,
        department: latestProfessor.department || latestProfessor.college,
        reason: latestProfessor.reason,
      } : null,
    };
  }, [conditions, directionBaseline, discovery, professors, projects]);

  const lastMessage = messages.at(-1) ?? null;
  const lastAssistantMessage = lastMessage?.role === "assistant" ? lastMessage : null;
  const branchSourceMessage = branchOrigin
    ? messages.find((message) => message.id === branchOrigin.parentId && message.role === "assistant") ?? null
    : null;
  const suggestionSourceMessage = branchSourceMessage ?? lastAssistantMessage;
  const lastSuggestions = suggestionSourceMessage?.suggestedPrompts ?? [];
  const visiblePrompts = lastSuggestions.length
    ? lastSuggestions
    : messages.length === 0
      ? QUICK_PROMPTS
      : [];
  const parallelBranchUserMessageIds = useMemo(
    () => getParallelBranchUserMessageIds(messages),
    [messages],
  );

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [isSending, messages.length]);

  useEffect(() => {
    const syncViewFromUrl = () => {
      const requestedView = new URLSearchParams(window.location.search).get("view");
      setViewMode(requestedView === "map" || requestedView === "context" ? requestedView : "chat");
    };
    syncViewFromUrl();
    window.addEventListener("popstate", syncViewFromUrl);
    return () => window.removeEventListener("popstate", syncViewFromUrl);
  }, []);

  const changeViewMode = (nextView: "chat" | "map" | "context") => {
    if (nextView === viewMode) return;
    const url = new URL(window.location.href);
    if (nextView === "chat") url.searchParams.delete("view");
    else url.searchParams.set("view", nextView);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setViewMode(nextView);
  };

  const requestReply = async (conversation: GrowthProfessorMessage[]) => {
    setError("");
    setSavedMessageId(null);
    setIsSending(true);
    try {
      addAssistantMessage(await requestGrowthProfessorReply({ context, messages: conversation }));
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "대화를 이어가지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSending(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const sendMessage = async (preset?: string) => {
    const content = (preset ?? draft).trim();
    if (!content || isSending) return;
    setDraft("");
    const userMessage = addUserMessage(content, branchOrigin?.parentId ?? null);
    const parentAssistantId = branchOrigin?.parentId ?? lastAssistantMessage?.id ?? null;
    const conversationBase = parentAssistantId
      ? conversationLineageToAssistant(messages, parentAssistantId)
      : messages;
    setBranchOrigin(null);
    await requestReply(
      [...conversationBase, userMessage]
        .slice(-8)
        .map(({ role, content: messageContent }) => ({ role, content: messageContent })),
    );
  };

  const retryLastMessage = async () => {
    if (isSending || messages.at(-1)?.role !== "user") return;
    const lastUserMessage = messages.at(-1);
    const previousAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant") ?? null;
    const retryParentId = lastUserMessage?.branchParentMessageId ?? previousAssistant?.id ?? null;
    const retryMessages = retryParentId && lastUserMessage
      ? [...conversationLineageToAssistant(messages, retryParentId), lastUserMessage]
      : messages;
    await requestReply(
      retryMessages.slice(-8).map(({ role, content }) => ({ role, content })),
    );
  };

  if (!hasResearchHydrated || !hasAiHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>나의 AI 교수님과 성장 기록을 불러오고 있어요.</p>
      </div>
    );
  }

  return (
    <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <Link href="/portfolio" className={styles.backLink}>
            <ArrowLeft size={18} aria-hidden="true" /> 나의 성장과정
          </Link>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon}><Bot size={28} aria-hidden="true" /></span>
            <div>
              <h1>나의 AI 교수님</h1>
              <p>교수님을 만나기 전후, 내 고민과 프로젝트 방향을 함께 정리하는 AI 성장 파트너예요.</p>
            </div>
          </div>
          <nav className={styles.viewTabs} aria-label="AI 교수님 보기 방식" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "chat"}
              aria-current={viewMode === "chat" ? "page" : undefined}
              onClick={() => changeViewMode("chat")}
            >
              <MessageCircleMore size={17} aria-hidden="true" /> 대화하기
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "map"}
              aria-current={viewMode === "map" ? "page" : undefined}
              onClick={() => changeViewMode("map")}
            >
              <GitBranch size={17} aria-hidden="true" /> 대화 지도
              {messages.some((message) => message.role === "assistant") ? (
                <span>{messages.filter((message) => message.role === "assistant").length}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "context"}
              aria-current={viewMode === "context" ? "page" : undefined}
              onClick={() => changeViewMode("context")}
            >
              <BookOpenCheck size={17} aria-hidden="true" /> 내 맥락
              {growthNotes.length ? <span>{growthNotes.length}</span> : null}
            </button>
          </nav>
        </header>

        {viewMode !== "map" ? <div className={styles.workspace}>
          {viewMode === "chat" ? (
            <section className={styles.conversation} aria-labelledby="ai-professor-conversation">
            <header className={styles.conversationHeader}>
              <div>
                <h2 id="ai-professor-conversation"><MessageCircleMore size={19} /> 가볍게 이야기하기</h2>
              </div>
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("AI 교수님과 나눈 대화를 모두 삭제할까요? 성장 메모는 남아 있습니다.")) {
                      clearConversation();
                      setBranchOrigin(null);
                      setDraft("");
                    }
                  }}
                  className={styles.clearButton}
                >
                  <Trash2 size={15} aria-hidden="true" /> 대화 비우기
                </button>
              ) : null}
            </header>

            <div ref={messageListRef} className={styles.messageList} aria-live="polite">
              <article className={`${styles.message} ${styles.assistantMessage}`}>
                <span className={styles.avatar}><Sparkles size={17} aria-hidden="true" /></span>
                <div>
                  <div className={styles.bubble}>
                    <p>지금 가장 막막한 걸 한 가지만 편하게 말해 주세요. 바로 해볼 수 있는 다음 한 걸음을 같이 찾아볼게요.</p>
                  </div>
                  <time>대화 시작</time>
                </div>
              </article>

              {messages.map((message) => {
                const isSaved = growthNotes.some((note) => note.sourceMessageId === message.id);
                const isLegacyLongReply = message.role === "assistant"
                  && message.content.length > CURRENT_REPLY_LIMIT;
                const legacyPreview = isLegacyLongReply ? legacyReplyPreview(message) : [];
                return (
                  <article
                    key={message.id}
                    className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}
                  >
                    {message.role === "assistant" ? (
                      <span className={styles.avatar}><Sparkles size={17} aria-hidden="true" /></span>
                    ) : null}
                    <div>
                      <div className={styles.bubble}>
                        {message.role === "user" && parallelBranchUserMessageIds.has(message.id) ? (
                          <span className={styles.branchMessageLabel}><GitBranch size={12} /> 새 갈래에서 이어짐</span>
                        ) : null}
                        {isLegacyLongReply ? (
                          <>
                            {legacyPreview.map((paragraph, index) => (
                              <p key={`${message.id}-preview-${index}`}>{paragraph}</p>
                            ))}
                            <details className={styles.legacyReply}>
                              <summary>예전 답변 전체 보기</summary>
                              <div>
                                {message.content.split("\n").filter(Boolean).map((paragraph, index) => (
                                  <p key={`${message.id}-full-${index}`}>{paragraph}</p>
                                ))}
                              </div>
                            </details>
                          </>
                        ) : message.content.split("\n").filter(Boolean).map((paragraph, index) => (
                          <p key={`${message.id}-${index}`}>{paragraph}</p>
                        ))}
                      </div>
                      <div className={styles.messageMeta}>
                        <time>{formatTime(message.createdAt)}</time>
                        {message.role === "assistant" && message.reflection ? (
                          <button
                            type="button"
                            disabled={isSaved}
                            onClick={() => {
                              const result = saveReflection(message.id);
                              if (result === "saved") setSavedMessageId(message.id);
                            }}
                          >
                            {isSaved ? <Check size={14} aria-hidden="true" /> : <BookOpenCheck size={14} aria-hidden="true" />}
                            {isSaved ? "성장 메모에 저장됨" : "성장 메모로 남기기"}
                          </button>
                        ) : null}
                      </div>
                      {savedMessageId === message.id ? (
                        <p className={styles.savedStatus} role="status">내 성장 메모에 남겼어요.</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {isSending ? (
                <article className={`${styles.message} ${styles.assistantMessage}`}>
                  <span className={styles.avatar}><Sparkles size={17} aria-hidden="true" /></span>
                  <div className={`${styles.bubble} ${styles.thinkingBubble}`}>
                    <LoaderCircle className="spin" size={18} aria-hidden="true" />
                    <p>지금까지의 성장 맥락과 대화를 함께 살펴보고 있어요.</p>
                  </div>
                </article>
              ) : null}
            </div>

            <div className={styles.composerArea}>
              {error ? (
                <div className={styles.errorRow} role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => void retryLastMessage()}>다시 보내기</button>
                </div>
              ) : null}
              {branchOrigin ? (
                <div className={styles.branchComposerContext} role="status">
                  <GitBranch size={16} aria-hidden="true" />
                  <span><strong>선택한 대화에서 이어가는 중</strong><small>{branchOrigin.title}</small></span>
                  <button
                    type="button"
                    aria-label="선택한 대화에서 이어가기 취소"
                    onClick={() => setBranchOrigin(null)}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
              {visiblePrompts.length ? (
                <div className={styles.promptSuggestions} role="group" aria-label="이어갈 대화 예시">
                  {visiblePrompts.map((suggestion) => (
                    <button
                      key={suggestion.text}
                      type="button"
                      aria-label={suggestion.kind === "branch"
                        ? `새 대화 갈래 시작: ${suggestion.text}`
                        : suggestion.text}
                      onClick={() => {
                        const parentId = resolveGrowthProfessorSuggestionParentId(
                          suggestion,
                          suggestionSourceMessage?.id ?? null,
                          Boolean(branchOrigin),
                        );
                        if (parentId && suggestionSourceMessage) {
                          setBranchOrigin({
                            parentId,
                            title: suggestionSourceMessage.reflection?.title ?? "현재 대화",
                          });
                        } else {
                          setBranchOrigin(null);
                        }
                        setDraft(suggestion.text);
                        inputRef.current?.focus();
                      }}
                    >
                      {suggestion.kind === "branch" ? (
                        <span className={styles.branchPromptMark} title="새 대화 갈래 시작" aria-hidden="true">
                          <GitBranch size={12} />
                        </span>
                      ) : null}
                      <span className={styles.promptLabel}>{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className={styles.composer}>
                <textarea
                  ref={inputRef}
                  value={draft}
                  rows={2}
                  maxLength={600}
                  placeholder="요즘 막막한 점이나 같이 정리하고 싶은 생각을 적어보세요"
                  aria-label="나의 AI 교수님께 보낼 내용"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!draft.trim() || isSending}
                  aria-label="메시지 보내기"
                  onClick={() => void sendMessage()}
                >
                  {isSending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}
                </button>
              </div>
            </div>
            </section>
          ) : null}

          {viewMode === "context" ? (
            <aside className={styles.growthRail} aria-label="나의 성장 맥락과 저장 메모">
            <section className={styles.contextSection}>
              <header><Lightbulb size={18} aria-hidden="true" /><h2>함께 보고 있는 내 맥락</h2></header>
              <dl>
                <div><dt>전공</dt><dd>{context.major}</dd></div>
                <div><dt>관심</dt><dd>{context.interests.length ? context.interests.join(" · ") : "대화로 찾아가는 중"}</dd></div>
                <div><dt>프로젝트</dt><dd>{context.project?.title ?? "아직 선택한 프로젝트 없음"}</dd></div>
                <div><dt>연결 교수</dt><dd>{context.professor ? `${context.professor.name} 교수` : "아직 선택한 교수 없음"}</dd></div>
              </dl>
              <p>저장한 전공·관심·프로젝트·교수 정보를 대화 맥락으로 함께 볼 수 있어요.</p>
            </section>

            <section className={styles.noteSection}>
              <header>
                <div><BookOpenCheck size={18} aria-hidden="true" /><h2>내 성장 메모</h2></div>
                <span>{growthNotes.length}개</span>
              </header>
              {growthNotes.length ? (
                <ul>
                  {[...growthNotes].reverse().slice(0, 5).map((note) => (
                    <li key={note.id}>
                      <div><strong>{note.title}</strong><p>{note.body}</p></div>
                      <button
                        type="button"
                        aria-label={`${note.title} 메모 삭제`}
                        onClick={() => {
                          if (window.confirm("이 성장 메모를 삭제할까요? 삭제한 메모는 되돌릴 수 없습니다.")) {
                            removeGrowthNote(note.id);
                          }
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyNote}>대화 중 남기고 싶은 내용을 직접 선택하면 여기에 쌓여요.</p>
              )}
            </section>

            <nav className={styles.nextLinks} aria-label="다음 성장 행동">
              <Link href="/quest">
                <GraduationCap size={19} aria-hidden="true" />
                <span><strong>실제 교수님 만남 준비</strong><small>첫 질문과 연락 초안 만들기</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/research/tutorial">
                <Lightbulb size={19} aria-hidden="true" />
                <span><strong>프로젝트로 구체화</strong><small>AI 공동설계 시작하기</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </nav>
            </aside>
          ) : null}
        </div> : (
          <AiConversationMap
            messages={messages}
            growthNotes={growthNotes}
            mapDecisions={mapDecisions}
            collapsedMapNodeIds={collapsedMapNodeIds}
            detachedMapNodeIds={detachedMapNodeIds}
            onSetDecision={setMapDecision}
            onClearDecision={clearMapDecision}
            onToggleCollapsedMapNode={toggleCollapsedMapNode}
            onClearCollapsedMapNode={clearCollapsedMapNode}
            onDetachMapNode={detachMapNode}
            onAttachMapNode={attachMapNode}
            onHideMapBranch={hideMapBranch}
            onRestoreMapBranch={restoreMapBranch}
            onSaveReflection={saveReflection}
            onBackToChat={() => changeViewMode("chat")}
            onStartBranch={(parentId, prompt, title) => {
              setBranchOrigin({ parentId, title });
              setDraft(prompt);
              changeViewMode("chat");
              window.requestAnimationFrame(() => inputRef.current?.focus());
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
