"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  GitCompareArrows,
  Heart,
  Info,
  LockOpen,
  LoaderCircle,
  MessageCircleMore,
  ScanSearch,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  AppShell,
  PrimaryButton,
  SecondaryButton,
  cx,
} from "@/components/app/primitives";
import { guideCharacter } from "@/lib/brand-assets";
import {
  CO_DESIGN_BASE_QUESTION_COUNT,
  CO_DESIGN_TOTAL_QUESTION_COUNT,
  DEFAULT_FOLLOW_UP_QUESTIONS,
  IDEA_MODES,
  composeCoDesignQuestions,
  conditionContext,
  modeById,
  type IdeaMode,
} from "@/data/co-design";
import {
  requestCoDesignCandidates,
  requestCoDesignFollowUpQuestions,
} from "@/lib/ai-client";
import { candidatesToTopics } from "@/lib/co-design-ai";
import { missingRequired } from "@/lib/recommend";
import { useResearchStore } from "@/store/research-store";

const modeIcon: Record<IdeaMode, typeof Brain> = {
  free: Brain,
  trend: ScanSearch,
  fusion: GitCompareArrows,
};

const optionIcon = [TrendingUp, Database, UsersRound, LockOpen] as const;

const optionDescription: Record<string, string> = {
  "연구 방법의 변화": "AI 도입으로 연구 설계와 방법론이 어떻게 달라졌는지 살펴봐요.",
  "새로운 데이터 활용": "새롭게 활용되는 데이터 유형과 접근 방식을 비교해요.",
  "현장 문제 해결": "AI 융합이 실제 현장·산업 문제 해결에 미치는 영향을 확인해요.",
  "아직 열어두기": "가능성을 열어두고 여러 방향을 폭넓게 탐색해요.",
};

function getOptionDescription(option: string) {
  return optionDescription[option]
    ?? `‘${option}’ 방향을 기준으로 다음 질문과 필요한 근거를 구체화해요.`;
}

function getEvidenceStatus(mode: IdeaMode) {
  if (mode === "trend") return "공식·논문 근거 확인 중";
  if (mode === "fusion") return "전공별 근거 분리 확인";
  return "사용자 확인 맥락 중심";
}

export function CoDesignScreen() {
  const router = useRouter();
  const questionPanelRef = useRef<HTMLElement>(null);
  const desktopQuestionPanelRef = useRef<HTMLElement>(null);
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const conditions = useResearchStore((state) => state.conditions);
  const ideaMode = useResearchStore((state) => state.ideaMode);
  const step = useResearchStore((state) => state.coDesignStep);
  const answers = useResearchStore((state) => state.coDesignAnswers);
  const followUpQuestions = useResearchStore((state) => state.coDesignFollowUpQuestions);
  const questionSource = useResearchStore((state) => state.coDesignQuestionSource);
  const setIdeaMode = useResearchStore((state) => state.setIdeaMode);
  const answerCoDesign = useResearchStore((state) => state.answerCoDesign);
  const setFollowUpQuestions = useResearchStore((state) => state.setCoDesignFollowUpQuestions);
  const previousQuestion = useResearchStore((state) => state.previousCoDesignQuestion);
  const completeCoDesign = useResearchStore((state) => state.completeCoDesign);

  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingFollowUps, setGeneratingFollowUps] = useState(false);
  const [followUpNotice, setFollowUpNotice] = useState("");

  const mode = modeById(ideaMode);
  const questions = useMemo(
    () => (ideaMode ? composeCoDesignQuestions(ideaMode, followUpQuestions) : []),
    [followUpQuestions, ideaMode],
  );
  const question = questions[step];

  useEffect(() => {
    if (!hasHydrated) return;
    if (!ideaMode || missingRequired(conditions).length > 0) {
      router.replace("/research/tutorial");
    }
  }, [conditions, hasHydrated, ideaMode, router]);

  useEffect(() => {
    const previous = question
      ? answers.find((answer) => answer.questionId === question.id)?.value ?? ""
      : "";
    const isPreset = question?.options.includes(previous);
    setSelected(isPreset ? previous : "");
    setCustom(isPreset ? "" : previous);
    setError("");
  }, [answers, question]);

  useEffect(() => {
    if (step === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = window.matchMedia("(min-width: 960px)").matches
        ? desktopQuestionPanelRef.current
        : questionPanelRef.current;
      if (!panel) return;
      const top = panel.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  if (!hasHydrated) {
    return (
      <div className="research-loading" role="status">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>저장한 프로젝트 조건을 불러오고 있어요.</p>
      </div>
    );
  }

  if (!ideaMode || !mode || !question) {
    return (
      <div className="research-loading" role="status">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>프로젝트 조건을 확인하고 시작 화면으로 이동하고 있어요.</p>
      </div>
    );
  }

  const isFirstQuestion = step === 0;
  const mobileQuestionHelper = isFirstQuestion
    ? "첫 질문에는 정답이 없어요. 가장 가까운 방향을 고르거나 직접 입력해 주세요."
    : question.helper;

  const submitAnswer = async () => {
    if (generating || generatingFollowUps) return;
    const value = (custom.trim() || selected).trim();
    if (!value) {
      setError("답변을 하나 선택하거나 직접 입력해 주세요.");
      return;
    }
    const isFollowUpGate = step === CO_DESIGN_BASE_QUESTION_COUNT - 1
      && followUpQuestions.length === 0;
    if (isFollowUpGate) {
      const confirmedBaseAnswers = [
        ...answers.filter((answer) => answer.questionId !== question.id),
        {
          questionId: question.id,
          label: question.contextLabel,
          value,
          status: "사용자 확인" as const,
        },
      ];
      setGeneratingFollowUps(true);
      setFollowUpNotice("");
      try {
        const response = await requestCoDesignFollowUpQuestions({
          mode: ideaMode,
          conditions,
          answers: confirmedBaseAnswers,
        });
        setFollowUpQuestions(response.questions, "ai");
      } catch {
        setFollowUpQuestions(DEFAULT_FOLLOW_UP_QUESTIONS, "fallback");
        setFollowUpNotice("AI 연결이 지연되어 검수된 기본 후속 질문으로 이어갑니다.");
      } finally {
        setGeneratingFollowUps(false);
      }
      answerCoDesign(value);
      return;
    }

    const isLast = answerCoDesign(value);
    if (isLast) {
      const finalAnswers = [
        ...answers.filter((answer) => answer.questionId !== question.id),
        {
          questionId: question.id,
          label: question.contextLabel,
          value,
          status: "사용자 확인" as const,
        },
      ];
      setGenerating(true);
      try {
        const response = await requestCoDesignCandidates({
          mode: ideaMode,
          conditions,
          answers: finalAnswers,
        });
        completeCoDesign(
          candidatesToTopics(response, conditions),
          response.grounding.note,
        );
      } catch (requestError) {
        const message = requestError instanceof Error
          ? requestError.message
          : "AI 연결을 사용할 수 없습니다.";
        completeCoDesign(
          undefined,
          `${message} 검수된 로컬 후보로 흐름을 이어갑니다.`,
        );
      } finally {
        router.replace("/result");
      }
    }
  };

  const primaryContextRows = conditionContext(conditions);
  const contextRows = [
    ...primaryContextRows,
    ...answers.slice(0, step).map((answer) => ({
      label: answer.label,
      value: answer.value,
    })),
  ];

  return (
    <AppShell
      title="전공 진화 실험실 — 만들다"
      onBack={() => router.replace("/research")}
      topAction={(
        <div className="co-studio-top-actions">
          <span className="step-count">{step + 1} / {CO_DESIGN_TOTAL_QUESTION_COUNT}</span>
          <button
            type="button"
            className="co-guide-button"
            onClick={() => setShowEvidence((value) => !value)}
            aria-expanded={showEvidence}
          >
            <Info size={15} /> 실험실 가이드
          </button>
          <Image src={guideCharacter.makeLab} alt="" width={38} height={38} unoptimized />
        </div>
      )}
      className={`research-screen co-design-screen co-design-mode-${ideaMode}`}
    >
      <section className="co-desktop-studio" aria-label="AI 공동설계 스튜디오">
        <div className="co-studio-context" aria-label="현재 프로젝트 맥락">
          <div className="co-studio-context__item">
            <Building2 size={22} />
            <span><small>{primaryContextRows[0]?.label}</small><strong>{primaryContextRows[0]?.value}</strong></span>
          </div>
          <div className="co-studio-context__item">
            <Heart size={22} />
            <span><small>{primaryContextRows[1]?.label}</small><strong>{primaryContextRows[1]?.value}</strong></span>
          </div>
          <div className="co-studio-context__item">
            <Clock3 size={22} />
            <span><small>{primaryContextRows[2]?.label}</small><strong>{primaryContextRows[2]?.value}</strong></span>
          </div>
          <button
            type="button"
            className="co-studio-context__item co-studio-context__evidence"
            onClick={() => setShowEvidence((value) => !value)}
            aria-expanded={showEvidence}
          >
            <ShieldCheck size={22} />
            <span><small>근거 상태</small><strong>{getEvidenceStatus(ideaMode)}</strong></span>
          </button>
          <div className="co-studio-mode" role="radiogroup" aria-label="아이디어 탐색 방식">
            <small>탐색 방식</small>
            <div>
              {IDEA_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={ideaMode === item.id}
                  className={cx(ideaMode === item.id && "is-selected")}
                  onClick={() => setIdeaMode(item.id)}
                >
                  {item.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showEvidence && (
          <div className="co-studio-evidence" role="note">
            <Info size={17} />
            <p><strong>{mode.evidenceNote}</strong> 공식 정보가 없거나 수집이 제한되면 ‘확인 필요’로 남겨요.</p>
          </div>
        )}

        <div className="co-studio-workspace">
          <section
            ref={desktopQuestionPanelRef}
            className="co-studio-conversation"
            aria-labelledby="co-desktop-question-title"
          >
            <div className="co-studio-label"><MessageCircleMore size={16} /> AI 공동설계</div>

            <div className="co-studio-message co-studio-message--question">
              <span className="co-studio-message__icon"><MessageCircleMore size={19} /></span>
              <div>
                <h1 id="co-desktop-question-title">{question.prompt}</h1>
                <small>질문 {step + 1} · {mode.shortLabel}</small>
              </div>
            </div>

            <div className="co-studio-message co-studio-message--coach">
              <span className="co-studio-message__avatar">
                <Image src={guideCharacter.makeLab} alt="" width={42} height={42} unoptimized />
              </span>
              <div>
                {isFirstQuestion ? (
                  <>
                    <p><strong>반가워요, {conditions.major ?? "전공"}에서 시작해 볼게요.</strong></p>
                    <p>앞에서 정리한 관심과 준비 조건을 바탕으로 프로젝트 방향을 한 단계씩 좁혀볼게요. 첫 질문에는 정답이 없으니, 오른쪽 제안 중 가장 가까운 방향을 고르거나 떠오르는 생각을 직접 적어 주세요.</p>
                  </>
                ) : (
                  <>
                    <p><strong>앞선 답변을 반영했어요.</strong> {question.helper}</p>
                    <p>가장 가까운 방향을 고르거나 직접 입력하면 다음 질문을 더 구체화할게요.</p>
                  </>
                )}
              </div>
            </div>

            {question.allowCustom && (
              <label className="co-studio-composer">
                <span>내 답변</span>
                <textarea
                  value={custom}
                  maxLength={160}
                  rows={4}
                  placeholder={question.id === "problem"
                    ? "문제를 해결하고자 하는 대상이 겪는 어려움을 짧게 적어 주세요."
                    : "자유롭게 답변을 입력해 주세요."}
                  onChange={(event) => {
                    setCustom(event.target.value);
                    if (event.target.value) setSelected("");
                    setError("");
                  }}
                />
                <small>{custom.length} / 160</small>
              </label>
            )}

            <div className="co-studio-conversation__foot">
              <button
                type="button"
                onClick={previousQuestion}
                disabled={step === 0 || generating || generatingFollowUps}
              >
                이전 질문
              </button>
              <span><MessageCircleMore size={15} /> 선택하거나 직접 입력하면 다음 질문이 맞춤 구성돼요.</span>
            </div>
          </section>

          <section className="co-studio-decisions" aria-labelledby="co-studio-decisions-title">
            <header>
              <h2 id="co-studio-decisions-title">제안된 답변 방향</h2>
              <p>아래 방향 중 선택하거나, 왼쪽에 직접 입력해도 괜찮아요.</p>
              <small>선택하면 근거 탐색이 더 빠르게 진행돼요.</small>
            </header>

            <div className="co-studio-options">
              {question.options.map((option, index) => {
                const OptionIcon = optionIcon[index % optionIcon.length];
                const active = selected === option && !custom;
                return (
                  <button
                    key={option}
                    type="button"
                    className={cx("co-studio-option", active && "is-selected")}
                    aria-pressed={active}
                    onClick={() => {
                      setSelected(option);
                      setCustom("");
                      setError("");
                    }}
                  >
                    <span className="co-studio-option__icon"><OptionIcon size={23} /></span>
                    <span><strong>{option}</strong><small>{getOptionDescription(option)}</small></span>
                    <span className="co-studio-option__check" aria-hidden="true">
                      {active ? <Check size={17} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && <p className="co-studio-error" role="alert">{error}</p>}

            <PrimaryButton
              type="button"
              className="co-studio-next"
              onClick={() => void submitAnswer()}
              disabled={generating || generatingFollowUps}
            >
              <ArrowRight size={18} />
              {generating
                ? "후보 2개 구성 중…"
                : generatingFollowUps
                  ? "내 답변에 맞는 질문 만드는 중…"
                  : step === CO_DESIGN_TOTAL_QUESTION_COUNT - 1
                    ? "후보 2개 만들기"
                    : "답변하고 다음 질문"}
            </PrimaryButton>
          </section>
        </div>

        {followUpNotice && (
          <p className="co-studio-helper"><Info size={16} /> {followUpNotice}</p>
        )}
      </section>

      <div className="co-mobile-layout">
      <div className="co-design-heading">
        <div>
          <h1>어떤 방식으로 연구 아이디어를 발전시킬까요?</h1>
          <p>한 번에 한 질문씩 답하며 확인된 맥락을 쌓아요.</p>
        </div>
        <Image src={guideCharacter.makeLab} alt="" width={76} height={72} priority unoptimized />
      </div>

      <div className="co-mode-grid" role="radiogroup" aria-label="아이디어 탐색 방식">
        {IDEA_MODES.map((item) => {
          const Icon = modeIcon[item.id];
          const active = ideaMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={cx("co-mode-card", active && "is-selected")}
              onClick={() => setIdeaMode(item.id)}
            >
              <span className="co-mode-card__icon"><Icon size={23} /></span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              <span className="co-mode-card__check" aria-hidden="true">
                {active ? <Check size={16} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="co-source-strip">
        <span><ShieldCheck size={17} /> {mode.evidenceNote} · 수집 상태 확인</span>
        <button type="button" onClick={() => setShowEvidence((value) => !value)} aria-expanded={showEvidence}>
          근거 보기 <ChevronRight size={15} />
        </button>
      </div>

      {showEvidence && (
        <div className="co-evidence-note" role="note">
          <Info size={17} />
          <p>
            공식 프로필에 연구분야·논문 목록이 없으면 공란으로 채우지 않고
            <strong> 공식 프로필 미기재</strong>로 표시해요. 크롤링 실패나 robots 차단도 별도 상태로 구분해요.
          </p>
        </div>
      )}

      <div className="co-workspace">
        <section ref={questionPanelRef} className="co-question-panel" aria-labelledby="co-question-title">
          <div className="co-ai-label">
            <span><MessageCircleMore size={15} /> AI 공동설계</span>
            <small>
              {step >= CO_DESIGN_BASE_QUESTION_COUNT
                ? questionSource === "fallback" ? "기본 후속 질문" : "내 답변 맞춤 질문"
                : mode.shortLabel}
            </small>
          </div>
          <h2 id="co-question-title">{question.prompt}</h2>
          <p className="co-question-helper">{mobileQuestionHelper}</p>

          <div className="co-answer-grid">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                className={cx("co-answer-option", selected === option && !custom && "is-selected")}
                aria-pressed={selected === option && !custom}
                onClick={() => {
                  setSelected(option);
                  setCustom("");
                  setError("");
                }}
              >
                <span className="co-radio" aria-hidden="true">
                  {selected === option && !custom ? <span /> : null}
                </span>
                {option}
              </button>
            ))}
          </div>

          {question.allowCustom && (
            <label className="co-custom-answer">
              <span>직접 입력</span>
              <input
                value={custom}
                maxLength={160}
                placeholder={question.id === "problem"
                  ? "문제를 해결하고자 하는 대상이 겪는 어려움을 짧게 적어 주세요"
                  : "관찰한 문제나 원하는 방향을 짧게 적어 주세요"}
                onChange={(event) => {
                  setCustom(event.target.value);
                  if (event.target.value) setSelected("");
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitAnswer();
                }}
              />
            </label>
          )}

          {error && <p className="co-answer-error" role="alert">{error}</p>}

          <div className="co-question-actions">
            <SecondaryButton
              type="button"
              onClick={previousQuestion}
              disabled={step === 0 || generating || generatingFollowUps}
            >
              이전 질문
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => void submitAnswer()} disabled={generating || generatingFollowUps}>
              {generating
                ? "후보 2개 구성 중…"
                : generatingFollowUps
                  ? "내 답변에 맞는 질문 만드는 중…"
                : step === CO_DESIGN_TOTAL_QUESTION_COUNT - 1
                  ? "후보 2개 만들기"
                  : "답변하고 다음 질문"}
              <ArrowRight size={17} />
            </PrimaryButton>
          </div>
        </section>

        <aside className="co-context-panel" aria-label="지금까지 확인한 맥락">
          <h2><CalendarDays size={19} /> 지금까지 확인한 맥락</h2>
          <dl>
            {contextRows.map((row, index) => {
              const Icon = index === 0 ? Building2 : index === 1 ? Heart : CheckCircle2;
              return (
                <div key={`${row.label}-${index}`}>
                  <dt><Icon size={16} /> {row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              );
            })}
          </dl>

          <div className="co-status-legend">
            <div><CheckCircle2 size={17} /><strong>사용자 확인</strong><span>직접 답한 내용</span></div>
            <div><ScanSearch size={17} /><strong>AI 제안</strong><span>근거를 바탕으로 제안</span></div>
            <div><CircleHelp size={17} /><strong>확인 필요</strong><span>추가 확인할 항목</span></div>
          </div>
        </aside>
      </div>

      <p className="co-helper-strip">
        <Info size={17} /> {followUpNotice || "공통 질문 3개 뒤에는 앞선 답변에 맞는 후속 질문 2개가 이어져요."}
      </p>
      </div>
    </AppShell>
  );
}
