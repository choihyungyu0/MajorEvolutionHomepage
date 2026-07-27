"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  GitCompareArrows,
  Heart,
  Info,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  AppShell,
  PrimaryButton,
  SecondaryButton,
  cx,
} from "@/components/app/primitives";
import {
  IDEA_MODES,
  conditionContext,
  modeById,
  questionsForMode,
  type IdeaMode,
} from "@/data/co-design";
import { requestCoDesignCandidates } from "@/lib/ai-client";
import { candidatesToTopics } from "@/lib/co-design-ai";
import { missingRequired } from "@/lib/recommend";
import { useResearchStore } from "@/store/research-store";

const modeIcon: Record<IdeaMode, typeof Brain> = {
  free: Brain,
  trend: ScanSearch,
  fusion: GitCompareArrows,
};

export function CoDesignScreen() {
  const router = useRouter();
  const conditions = useResearchStore((state) => state.conditions);
  const ideaMode = useResearchStore((state) => state.ideaMode);
  const step = useResearchStore((state) => state.coDesignStep);
  const answers = useResearchStore((state) => state.coDesignAnswers);
  const setIdeaMode = useResearchStore((state) => state.setIdeaMode);
  const answerCoDesign = useResearchStore((state) => state.answerCoDesign);
  const previousQuestion = useResearchStore((state) => state.previousCoDesignQuestion);
  const completeCoDesign = useResearchStore((state) => state.completeCoDesign);

  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const mode = modeById(ideaMode);
  const questions = useMemo(
    () => (ideaMode ? questionsForMode(ideaMode) : []),
    [ideaMode],
  );
  const question = questions[step];

  useEffect(() => {
    if (!ideaMode || missingRequired(conditions).length > 0) {
      router.replace("/research");
    }
  }, [conditions, ideaMode, router]);

  useEffect(() => {
    const previous = question
      ? answers.find((answer) => answer.questionId === question.id)?.value ?? ""
      : "";
    const isPreset = question?.options.includes(previous);
    setSelected(isPreset ? previous : "");
    setCustom(isPreset ? "" : previous);
    setError("");
  }, [answers, question]);

  if (!ideaMode || !mode || !question) return null;

  const submitAnswer = async () => {
    if (generating) return;
    const value = (custom.trim() || selected).trim();
    if (!value) {
      setError("답변을 하나 선택하거나 직접 입력해 주세요.");
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
        router.push("/result");
      }
    }
  };

  const contextRows = [
    ...conditionContext(conditions),
    ...answers.slice(0, step).map((answer) => ({
      label: answer.label,
      value: answer.value,
    })),
  ];

  return (
    <AppShell
      title="전공진화소"
      onBack={() => router.push("/research")}
      step={{ current: step + 1, total: questions.length }}
      className="research-screen co-design-screen"
    >
      <div className="co-design-heading">
        <div>
          <h1>어떤 방식으로 연구 아이디어를 발전시킬까요?</h1>
          <p>한 번에 한 질문씩 답하며 확인된 맥락을 쌓아요.</p>
        </div>
        <Image src="/mvp-assets/robot-pose-3.png" alt="" width={76} height={72} priority />
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
        <section className="co-question-panel" aria-labelledby="co-question-title">
          <div className="co-ai-label">
            <span><Sparkles size={15} /> AI 공동설계</span>
            <small>{mode.shortLabel}</small>
          </div>
          <h2 id="co-question-title">{question.prompt}</h2>
          <p className="co-question-helper">{question.helper}</p>

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
                placeholder="관찰한 문제나 원하는 방향을 짧게 적어 주세요"
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
              disabled={step === 0 || generating}
            >
              이전 질문
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => void submitAnswer()} disabled={generating}>
              {generating
                ? "후보 2개 구성 중…"
                : step === questions.length - 1
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
            <div><Sparkles size={17} /><strong>AI 제안</strong><span>근거를 바탕으로 제안</span></div>
            <div><CircleHelp size={17} /><strong>확인 필요</strong><span>추가 확인할 항목</span></div>
          </div>
        </aside>
      </div>

      <p className="co-helper-strip">
        <Info size={17} /> 한 번에 한 질문씩 답하면 비교 가능한 후보 2개로 정리해 드려요.
      </p>
    </AppShell>
  );
}
