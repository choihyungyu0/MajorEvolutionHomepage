"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Brain, Check, CircleAlert, Compass, GitCompareArrows, ScanSearch, Sparkles } from "lucide-react";
import { AppLogo, AppShell, Card, PageHeader, PrimaryButton, cx } from "@/components/app/primitives";
import { IDEA_MODES, type IdeaMode } from "@/data/co-design";
import {
  AVOID_TAGS,
  DATA_ACCESS,
  EXPERIENCE_LEVELS,
  INTEREST_TAGS,
  MAJORS,
  METHOD_TAGS,
  PERIODS,
} from "@/data/research-mvp";
import { useResearchStore } from "@/store/research-store";

const CHIP = (selected: boolean, disabled = false) =>
  cx("choice-chip", selected && "is-selected", disabled && "");

export function ConditionSelectScreen() {
  const router = useRouter();
  const c = useResearchStore((s) => s.conditions);
  const ideaMode = useResearchStore((s) => s.ideaMode);
  const interestsFull = useResearchStore((s) => s.interestsFull);
  const methodsFull = useResearchStore((s) => s.methodsFull);
  const setIdeaMode = useResearchStore((s) => s.setIdeaMode);
  const setMajor = useResearchStore((s) => s.setMajor);
  const toggleInterest = useResearchStore((s) => s.toggleInterest);
  const setExperience = useResearchStore((s) => s.setExperience);
  const toggleMethod = useResearchStore((s) => s.toggleMethod);
  const setPeriod = useResearchStore((s) => s.setPeriod);
  const setDataAccess = useResearchStore((s) => s.setDataAccess);
  const toggleAvoid = useResearchStore((s) => s.toggleAvoid);
  const submit = useResearchStore((s) => s.submit);

  const [errors, setErrors] = useState<string[]>([]);
  const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    ideaMode: useRef(null),
    major: useRef(null),
    interests: useRef(null),
    experience: useRef(null),
    methods: useRef(null),
    period: useRef(null),
    dataAccess: useRef(null),
  };
  const hasError = (k: string) => errors.includes(k);

  const onSubmit = () => {
    const missing = submit();
    setErrors(missing);
    if (missing.length) {
      refs[missing[0]]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    router.push("/co-design");
  };

  const modeIcon: Record<IdeaMode, typeof Brain> = {
    free: Brain,
    trend: ScanSearch,
    fusion: GitCompareArrows,
  };

  return (
    <AppShell
      showHeader={false}
      className="research-screen"
      stickyAction={<PrimaryButton onClick={onSubmit}>AI와 공동설계 시작하기</PrimaryButton>}
    >
      <div className="research-brand">
        <AppLogo />
        <Image src="/mvp-assets/robot-flag.png" alt="" width={64} height={62} priority />
      </div>

      <PageHeader
        eyebrow="연구주제 공동설계"
        title="탐색 방식을 고르고, AI와 질문을 좁혀 보세요"
        description="한 번에 한 질문씩 답하면 현재 조건에 맞는 후보 2개와 비교 근거를 만들어요."
      />

      <Card className="research-notice">
        <span><Sparkles size={18} /></span>
        <div>
          <strong>점수가 아니라 근거로 비교해요</strong>
          <p>사용자 확인 사실, AI 제안, 확인 필요 항목을 분리해 보여드려요. 연구실 합격·교수 답변·독창성은 보장하지 않아요.</p>
        </div>
      </Card>

      <div ref={refs.ideaMode} className={cx("cond-group", "mode-select-group", hasError("ideaMode") && "has-error")}>
        <div className="field-label">아이디어 탐색 방식 <small>필수 · 1개 선택</small></div>
        <div className="mode-option-list">
          {IDEA_MODES.map((mode) => {
            const Icon = modeIcon[mode.id];
            const selected = ideaMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                className={cx("mode-option", selected && "is-selected")}
                onClick={() => setIdeaMode(mode.id)}
                aria-pressed={selected}
              >
                <span className="mode-option__icon"><Icon size={21} /></span>
                <span className="mode-option__copy">
                  <strong>{mode.label}</strong>
                  <small>{mode.description}</small>
                </span>
                <span className="mode-option__check" aria-hidden="true">{selected ? <Check size={16} /> : null}</span>
              </button>
            );
          })}
        </div>
        {hasError("ideaMode") && <p className="field-error">아이디어 탐색 방식을 선택해 주세요.</p>}
      </div>

      {/* 학과·전공 */}
      <div ref={refs.major} className={cx("cond-group", hasError("major") && "has-error")}>
        <div className="field-label">학과·전공 <small>필수</small></div>
        <div className="chip-grid">
          {MAJORS.map((m) => (
            <button key={m} type="button" className={CHIP(c.major === m)} onClick={() => setMajor(m)} aria-pressed={c.major === m}>
              {m}
            </button>
          ))}
        </div>
        {hasError("major") && <p className="field-error">전공을 선택해 주세요.</p>}
      </div>

      {/* 관심 연구 분야 1~3 */}
      <div ref={refs.interests} className={cx("cond-group", hasError("interests") && "has-error")}>
        <div className="field-label">관심 연구 분야 <small>필수 · 최대 3개</small></div>
        <div className="chip-grid">
          {INTEREST_TAGS.map((t) => {
            const on = c.interests.includes(t);
            return (
              <button key={t} type="button" className={CHIP(on)} disabled={!on && interestsFull} onClick={() => toggleInterest(t)} aria-pressed={on}>
                {t}
              </button>
            );
          })}
        </div>
        {interestsFull && <p className="cond-hint">최대 3개를 골랐어요. 바꾸려면 하나를 해제하세요.</p>}
        {hasError("interests") && <p className="field-error">관심 분야를 1개 이상 골라 주세요.</p>}
      </div>

      {/* 관련 경험 수준 */}
      <div ref={refs.experience} className={cx("cond-group", hasError("experience") && "has-error")}>
        <div className="field-label">관련 경험 수준 <small>필수</small></div>
        <div className="option-list">
          {EXPERIENCE_LEVELS.map((e) => (
            <button key={e} type="button" className={c.experience === e ? "is-selected" : ""} onClick={() => setExperience(e)} aria-pressed={c.experience === e}>
              <span>{e}</span>
            </button>
          ))}
        </div>
        {hasError("experience") && <p className="field-error">경험 수준을 골라 주세요.</p>}
      </div>

      {/* 사용할 수 있는 방법·도구 1~2 */}
      <div ref={refs.methods} className={cx("cond-group", hasError("methods") && "has-error")}>
        <div className="field-label">사용할 수 있는 방법·도구 <small>필수 · 최대 2개</small></div>
        <div className="chip-grid">
          {METHOD_TAGS.map((t) => {
            const on = c.methods.includes(t);
            return (
              <button key={t} type="button" className={CHIP(on)} disabled={!on && methodsFull} onClick={() => toggleMethod(t)} aria-pressed={on}>
                {t}
              </button>
            );
          })}
        </div>
        {methodsFull && <p className="cond-hint">최대 2개를 골랐어요. 바꾸려면 하나를 해제하세요.</p>}
        {hasError("methods") && <p className="field-error">방법·도구를 1개 이상 골라 주세요.</p>}
      </div>

      {/* 준비 가능 기간 */}
      <div ref={refs.period} className={cx("cond-group", hasError("period") && "has-error")}>
        <div className="field-label">준비 가능 기간 <small>필수</small></div>
        <div className="segmented" style={{ "--segments": 3 } as React.CSSProperties}>
          {PERIODS.map((p) => (
            <button key={p.label} type="button" className={c.period === p.label ? "is-selected" : ""} onClick={() => setPeriod(p.label)} aria-pressed={c.period === p.label}>
              {p.label}
            </button>
          ))}
        </div>
        {hasError("period") && <p className="field-error">준비 가능 기간을 골라 주세요.</p>}
      </div>

      {/* 데이터 접근 상황 */}
      <div ref={refs.dataAccess} className={cx("cond-group", hasError("dataAccess") && "has-error")}>
        <div className="field-label">데이터 접근 상황 <small>필수</small></div>
        <div className="option-list">
          {DATA_ACCESS.map((d) => (
            <button key={d} type="button" className={c.dataAccess === d ? "is-selected" : ""} onClick={() => setDataAccess(d)} aria-pressed={c.dataAccess === d}>
              <span>{d}</span>
            </button>
          ))}
        </div>
        {hasError("dataAccess") && <p className="field-error">데이터 접근 상황을 골라 주세요.</p>}
      </div>

      {/* 피하고 싶은 주제·방식 (선택) */}
      <div className="cond-group">
        <div className="field-label">피하고 싶은 방식 <small>선택</small></div>
        <div className="chip-grid">
          {AVOID_TAGS.map((t) => (
            <button key={t} type="button" className={CHIP(c.avoid.includes(t))} onClick={() => toggleAvoid(t)} aria-pressed={c.avoid.includes(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="cond-error-banner" role="alert">
          <CircleAlert size={18} /> 추천을 받으려면 표시된 조건을 모두 선택해 주세요.
        </div>
      )}

      <p className="research-foot"><Compass size={14} /> 공식 근거가 없는 정보는 ‘확인 필요’로 남기며, 현재 입력과 선택은 이 브라우저에 저장해요.</p>
    </AppShell>
  );
}
