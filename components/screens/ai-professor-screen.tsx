"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Bot,
  Check,
  Clock3,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  MessageCircleMore,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { AiConversationMap } from "@/components/screens/ai-conversation-map";
import { requestGrowthProfessorReply } from "@/lib/ai-client";
import { conversationLineageToAssistant } from "@/lib/ai-conversation-map";
import type {
  GrowthProfessorContext,
  GrowthProfessorMessage,
} from "@/lib/ai-growth-professor";
import {
  useAiProfessorStore,
  type AiProfessorMessage,
} from "@/store/ai-professor-store";
import { useResearchStore } from "@/store/research-store";
import styles from "./ai-professor-screen.module.css";

const QUICK_PROMPTS = [
  "내 진로 고민을 한 문장으로 정리하고 싶어요",
  "지금 프로젝트의 다음 한 걸음을 같이 정해요",
  "교수님께 물어볼 첫 질문을 만들고 싶어요",
] as const;

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

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 저장";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
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
  const savedConversations = useAiProfessorStore((state) => state.savedConversations);
  const activeConversationId = useAiProfessorStore((state) => state.activeConversationId);
  const addUserMessage = useAiProfessorStore((state) => state.addUserMessage);
  const addAssistantMessage = useAiProfessorStore((state) => state.addAssistantMessage);
  const saveReflection = useAiProfessorStore((state) => state.saveReflection);
  const removeGrowthNote = useAiProfessorStore((state) => state.removeGrowthNote);
  const setMapDecision = useAiProfessorStore((state) => state.setMapDecision);
  const clearMapDecision = useAiProfessorStore((state) => state.clearMapDecision);
  const saveCurrentConversation = useAiProfessorStore((state) => state.saveCurrentConversation);
  const startNewConversation = useAiProfessorStore((state) => state.startNewConversation);
  const openConversation = useAiProfessorStore((state) => state.openConversation);
  const removeSavedConversation = useAiProfessorStore((state) => state.removeSavedConversation);
  const clearConversation = useAiProfessorStore((state) => state.clearConversation);

  const [viewMode, setViewMode] = useState<"chat" | "map" | "context">("chat");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [savedMessageId, setSavedMessageId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState("");
  const [branchOrigin, setBranchOrigin] = useState<{ parentId: string; title: string } | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeConversation = savedConversations.find(
    (conversation) => conversation.id === activeConversationId,
  ) ?? null;

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
  const currentCardCount = messages.filter((message) => message.role === "assistant").length;
  const currentBranchCount = messages.filter(
    (message) => message.role === "user" && Boolean(message.branchParentMessageId),
  ).length;
  const branchSourceMessage = branchOrigin
    ? messages.find((message) => message.id === branchOrigin.parentId && message.role === "assistant") ?? null
    : null;
  const suggestionSourceMessage = branchSourceMessage ?? lastAssistantMessage;
  const lastSuggestions = Array.from(new Set(
    (suggestionSourceMessage?.suggestedPrompts ?? [])
      .map((prompt) => prompt.trim())
      .filter(Boolean),
  )).slice(0, 3);
  const visiblePrompts = lastSuggestions.length
    ? lastSuggestions
    : messages.length === 0
      ? [...QUICK_PROMPTS]
      : [];
  const hasBranchChoices = Boolean(suggestionSourceMessage && lastSuggestions.length >= 2);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [isSending, messages.length]);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "map" || requestedView === "context") setViewMode(requestedView);
  }, []);

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

  const resetConversationComposer = () => {
    setBranchOrigin(null);
    setDraft("");
    setError("");
    setSavedMessageId(null);
  };

  const handleSaveConversation = () => {
    if (isSending) return;
    const result = saveCurrentConversation();
    if (result.status === "empty") {
      setConversationStatus("저장할 대화가 아직 없어요.");
      return;
    }
    setConversationStatus(
      result.status === "updated"
        ? `‘${result.conversation.title}’ 저장본을 업데이트했어요.`
        : `‘${result.conversation.title}’ 대화와 생각 지도를 저장했어요.`,
    );
  };

  const handleStartNewConversation = () => {
    if (isSending) return;
    if (draft.trim()) {
      setConversationStatus("작성 중인 메시지를 먼저 보내거나 비워 주세요.");
      setViewMode("chat");
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    const result = startNewConversation();
    resetConversationComposer();
    setViewMode("chat");
    setConversationStatus(
      result.status === "empty"
        ? "저장할 대화가 없어 바로 새 대화를 시작했어요."
        : `‘${result.conversation.title}’ 대화와 지도를 저장하고 새 대화를 시작했어요.`,
    );
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleOpenConversation = (id: string, nextView: "chat" | "map") => {
    if (isSending) return;
    const target = savedConversations.find((conversation) => conversation.id === id);
    if (!target || !openConversation(id)) return;
    resetConversationComposer();
    setViewMode(nextView);
    setConversationStatus(`‘${target.title}’ 저장본을 열었어요.`);
    if (nextView === "chat") {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleRemoveConversation = (id: string) => {
    const target = savedConversations.find((conversation) => conversation.id === id);
    if (!target || isSending) return;
    if (!window.confirm(`‘${target.title}’ 저장본을 삭제할까요? 현재 열려 있는 대화 내용은 남아 있습니다.`)) {
      return;
    }
    removeSavedConversation(id);
    setConversationStatus(`‘${target.title}’ 저장본을 삭제했어요.`);
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
          <div className={styles.boundaryNote} role="note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>실제 교수님의 지도나 학교의 공식 답변을 대신하지 않으며, 중요한 결정은 직접 확인해요.</span>
          </div>
          <div className={styles.viewControlRow}>
            <nav className={styles.viewTabs} aria-label="AI 교수님 보기 방식">
              <button
                type="button"
                aria-current={viewMode === "chat" ? "page" : undefined}
                onClick={() => setViewMode("chat")}
              >
                <MessageCircleMore size={17} aria-hidden="true" /> 대화하기
              </button>
              <button
                type="button"
                aria-current={viewMode === "map" ? "page" : undefined}
                onClick={() => setViewMode("map")}
              >
                <GitBranch size={17} aria-hidden="true" /> 대화 지도
                {messages.some((message) => message.role === "assistant") ? (
                  <span>{messages.filter((message) => message.role === "assistant").length}</span>
                ) : null}
              </button>
              <button
                type="button"
                aria-current={viewMode === "context" ? "page" : undefined}
                onClick={() => setViewMode("context")}
              >
                <BookOpenCheck size={17} aria-hidden="true" /> 내 맥락
                {savedConversations.length ? <span>{savedConversations.length}</span> : null}
              </button>
            </nav>
          </div>
          <p className={styles.sessionStatus} role="status" aria-live="polite">
            {conversationStatus || (activeConversation
              ? `열린 저장본 · ${activeConversation.title}`
              : "대화·생각 카드·지도 분기를 한 묶음으로 저장할 수 있어요.")}
          </p>
        </header>

        {viewMode !== "map" ? <div className={styles.workspace}>
          {viewMode === "chat" ? (
            <section className={styles.conversation} aria-labelledby="ai-professor-conversation">
            <header className={styles.conversationHeader}>
              <div>
                <h2 id="ai-professor-conversation"><MessageCircleMore size={19} /> 가볍게 이야기하기</h2>
              </div>
              {messages.length > 0 ? (
                <div className={styles.conversationHeaderActions} role="group" aria-label="현재 대화 관리">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={handleSaveConversation}
                    className={styles.saveConversationButton}
                    aria-label="현재 대화 저장"
                  >
                    <Save size={15} aria-hidden="true" /> 대화 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("AI 교수님과 나눈 대화를 모두 삭제할까요? 성장 메모는 남아 있습니다.")) {
                        clearConversation();
                        setBranchOrigin(null);
                        setDraft("");
                        setConversationStatus("현재 대화를 비웠어요. 저장한 대화는 내 맥락에 남아 있습니다.");
                      }
                    }}
                    className={styles.clearButton}
                  >
                    <Trash2 size={15} aria-hidden="true" /> 대화 비우기
                  </button>
                </div>
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
                        {message.role === "user" && message.branchParentMessageId ? (
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
                <div className={styles.promptSuggestions} aria-label="이어갈 대화 예시">
                  {visiblePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      aria-label={hasBranchChoices ? `새 대화 갈래 후보: ${prompt}` : prompt}
                      onClick={() => {
                        if (hasBranchChoices && suggestionSourceMessage) {
                          setBranchOrigin({
                            parentId: suggestionSourceMessage.id,
                            title: suggestionSourceMessage.reflection?.title ?? "현재 대화",
                          });
                        } else {
                          setBranchOrigin(null);
                        }
                        setDraft(prompt);
                        inputRef.current?.focus();
                      }}
                    >
                      {hasBranchChoices ? (
                        <span className={styles.branchPromptMark} title="새 대화 갈래 후보" aria-hidden="true">
                          <GitBranch size={12} />
                        </span>
                      ) : null}
                      <span className={styles.promptLabel}>{prompt}</span>
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
            <section className={styles.savedConversationSection} aria-labelledby="saved-conversations-title">
              <header>
                <div>
                  <FolderOpen size={19} aria-hidden="true" />
                  <div>
                    <h2 id="saved-conversations-title">저장한 대화</h2>
                    <p>대화·생각 카드·지도 분기를 골라 다시 이어갈 수 있어요.</p>
                  </div>
                </div>
                <span>{savedConversations.length}개</span>
              </header>
              <div className={styles.savedConversationToolbar}>
                <div className={styles.currentConversationSnapshot}>
                  <span>현재 대화</span>
                  <strong>{messages.length ? "지금까지의 대화와 상상나무" : "새로운 주제로 시작할 준비가 됐어요"}</strong>
                  <p>
                    {messages.length
                      ? `메시지 ${messages.length}개 · 생각 카드 ${currentCardCount}개 · 새 가지 ${currentBranchCount}개`
                      : "저장한 대화는 그대로 두고, 빈 화면에서 다른 고민을 시작할 수 있어요."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSending}
                  aria-label={messages.length ? "현재 내용 저장 후 새 대화 시작" : "새 대화 시작"}
                  onClick={handleStartNewConversation}
                >
                  <Plus size={18} aria-hidden="true" />
                  <span>
                    <strong>{messages.length ? "저장하고 새 대화 시작하기" : "새 대화 시작하기"}</strong>
                    <small>{messages.length ? "대화·생각 카드·지도 분기를 함께 저장해요" : "첫 질문부터 가볍게 시작해요"}</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
                {draft.trim() ? (
                  <p className={styles.draftGuardNote}>작성 중인 메시지가 있어요. 먼저 보내거나 비운 뒤 새 대화를 시작할 수 있어요.</p>
                ) : null}
              </div>
              {savedConversations.length ? (
                <ul>
                  {[...savedConversations].reverse().map((conversation) => {
                    const cardCount = conversation.messages.filter(
                      (message) => message.role === "assistant",
                    ).length;
                    const active = conversation.id === activeConversationId;
                    return (
                      <li key={conversation.id} data-active={active ? "true" : "false"}>
                        <div className={styles.savedConversationCopy}>
                          <div>
                            <strong>{conversation.title}</strong>
                            {active ? <span>현재 열림</span> : null}
                          </div>
                          <p>{conversation.preview}</p>
                          <small>
                            <Clock3 size={13} aria-hidden="true" />
                            <time dateTime={conversation.updatedAt}>{formatSavedDate(conversation.updatedAt)}</time>
                            <span aria-hidden="true">·</span> 생각 카드 {cardCount}개
                          </small>
                        </div>
                        <div className={styles.savedConversationActions}>
                          <button
                            type="button"
                            disabled={isSending}
                            aria-label={`${conversation.title} 대화 열기`}
                            onClick={() => handleOpenConversation(conversation.id, "chat")}
                          >
                            <MessageCircleMore size={15} aria-hidden="true" /> 대화
                          </button>
                          <button
                            type="button"
                            disabled={isSending}
                            aria-label={`${conversation.title} 생각 지도 열기`}
                            onClick={() => handleOpenConversation(conversation.id, "map")}
                          >
                            <GitBranch size={15} aria-hidden="true" /> 지도
                          </button>
                          <button
                            type="button"
                            disabled={isSending}
                            className={styles.savedConversationDelete}
                            aria-label={`${conversation.title} 저장본 삭제`}
                            onClick={() => handleRemoveConversation(conversation.id)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={styles.savedConversationEmpty}>
                  <MessageCircleMore size={22} aria-hidden="true" />
                  <div>
                    <strong>아직 저장한 대화가 없어요</strong>
                    <p>대화 화면에서 ‘대화 저장’을 누르면 이곳에 모여요.</p>
                  </div>
                </div>
              )}
            </section>

            <section className={styles.contextSection}>
              <header><Lightbulb size={18} aria-hidden="true" /><h2>함께 보고 있는 내 맥락</h2></header>
              <dl>
                <div><dt>전공</dt><dd>{context.major}</dd></div>
                <div><dt>관심</dt><dd>{context.interests.length ? context.interests.join(" · ") : "대화로 찾아가는 중"}</dd></div>
                <div><dt>프로젝트</dt><dd>{context.project?.title ?? "아직 선택한 프로젝트 없음"}</dd></div>
                <div><dt>연결 교수</dt><dd>{context.professor ? `${context.professor.name} 교수` : "아직 선택한 교수 없음"}</dd></div>
              </dl>
              <p>저장한 내용만 참고하며, 입력하지 않은 성향이나 적성을 추정하지 않아요.</p>
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
            onSetDecision={setMapDecision}
            onClearDecision={clearMapDecision}
            onSaveReflection={saveReflection}
            onBackToChat={() => setViewMode("chat")}
            onStartBranch={(parentId, prompt, title) => {
              setBranchOrigin({ parentId, title });
              setDraft(prompt);
              setViewMode("chat");
              window.requestAnimationFrame(() => inputRef.current?.focus());
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
