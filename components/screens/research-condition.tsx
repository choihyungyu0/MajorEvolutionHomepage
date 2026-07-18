"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CircleAlert, Compass, Sparkles } from "lucide-react";
import { AppLogo, AppShell, Card, PageHeader, PrimaryButton, cx } from "@/components/app/primitives";
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
  const interestsFull = useResearchStore((s) => s.interestsFull);
  const methodsFull = useResearchStore((s) => s.methodsFull);
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
    router.push("/result");
  };

  return (
    <AppShell
      showHeader={false}
      className="research-screen"
      stickyAction={<PrimaryButton onClick={onSubmit}>연구주제 추천받기</PrimaryButton>}
    >
      <div className="research-brand">
        <AppLogo />
        <Image src="/mvp-assets/robot-flag.png" alt="" width={64} height={62} priority />
      </div>

      <PageHeader
        eyebrow="연구주제 설계"
        title="교수님께 가져갈 연구주제 후보 2개를 비교해 보세요"
        description="전공명만이 아니라 실제 수강·경험·조건을 반영해, 검수된 데이터에서 후보를 찾아드려요."
      />

      <Card className="research-notice">
        <span><Sparkles size={18} /></span>
        <div>
          <strong>점수가 아니라 근거로 비교해요</strong>
          <p>연구실 합격·교수 답변·독창성은 보장하지 않아요. 실제 가능 여부는 학교 공식 채널에서 확인해요.</p>
        </div>
      </Card>

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

      <p className="research-foot"><Compass size={14} /> 모든 후보는 검수된 로컬 데이터에서 찾아요. 새로고침하면 조건은 초기화돼요.</p>
    </AppShell>
  );
}
