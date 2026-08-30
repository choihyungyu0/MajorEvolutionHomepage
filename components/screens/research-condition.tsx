"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CircleAlert,
  Compass,
  GitCompareArrows,
  Route,
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
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  MAJOR_AREAS,
  MAJOR_SUGGESTIONS,
  UNIVERSITY_SUGGESTIONS,
  UNIVERSAL_INTEREST_TAGS,
} from "@/data/academic-options";
import { IDEA_MODES, type IdeaMode } from "@/data/co-design";
import {
  AVOID_TAGS,
  DATA_ACCESS,
  EXPERIENCE_LEVELS,
  METHOD_TAGS,
  PERIODS,
} from "@/data/research-mvp";
import { guideCharacter } from "@/lib/brand-assets";
import { useResearchStore } from "@/store/research-store";

const CHIP = (selected: boolean, disabled = false) =>
  cx("choice-chip", selected && "is-selected", disabled && "");
const INTEREST_TAG_SET = new Set<string>(UNIVERSAL_INTEREST_TAGS);

const RESEARCH_STEPS = [
  { id: "direction", label: "방향", title: "어떤 방식으로 프로젝트를 탐색할까요?", description: "지금 가장 끌리는 방식 하나를 고르세요. 다음 단계에서도 언제든 다시 바꿀 수 있어요." },
  { id: "major", label: "전공", title: "출발점이 될 전공을 알려주세요", description: "학교는 선택 사항이에요. 전공 계열과 학과만 확인하면 다음으로 넘어갈 수 있어요." },
  { id: "interests", label: "관심", title: "어떤 문제를 더 알아보고 싶나요?", description: "관심 분야를 최대 3개까지 고르거나 직접 입력해 주세요." },
  { id: "readiness", label: "준비", title: "지금 활용할 수 있는 경험과 도구는 무엇인가요?", description: "잘하는 정도보다 이번 프로젝트에서 실제로 시도할 수 있는 범위를 선택해요." },
  { id: "feasibility", label: "실행", title: "실행 가능한 범위를 정해볼까요?", description: "기간과 자료 접근 상황을 정하면 현실적인 프로젝트 후보로 좁힐 수 있어요." },
  { id: "review", label: "확인", title: "입력한 조건을 확인해 주세요", description: "비어 있는 항목은 바로 수정하고, 준비가 끝났다면 AI 공동설계로 이어가세요." },
] as const;

type ResearchStep = (typeof RESEARCH_STEPS)[number]["id"];

const ERROR_STEP: Record<string, ResearchStep> = {
  ideaMode: "direction",
  majorArea: "major",
  major: "major",
  interests: "interests",
  experience: "readiness",
  methods: "readiness",
  period: "feasibility",
  dataAccess: "feasibility",
};

export function ConditionSelectScreen({
  initialStep = "direction",
  returnHref = "/research/tutorial?source=full",
  returnLabel = "단계별 설계로 돌아가기",
}: {
  initialStep?: ResearchStep;
  returnHref?: string;
  returnLabel?: string;
} = {}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const c = useResearchStore((s) => s.conditions);
  const ideaMode = useResearchStore((s) => s.ideaMode);
  const setIdeaMode = useResearchStore((s) => s.setIdeaMode);
  const setSchool = useResearchStore((s) => s.setSchool);
  const setMajorArea = useResearchStore((s) => s.setMajorArea);
  const setMajor = useResearchStore((s) => s.setMajor);
  const toggleInterest = useResearchStore((s) => s.toggleInterest);
  const addInterest = useResearchStore((s) => s.addInterest);
  const setExperience = useResearchStore((s) => s.setExperience);
  const toggleMethod = useResearchStore((s) => s.toggleMethod);
  const setPeriod = useResearchStore((s) => s.setPeriod);
  const setDataAccess = useResearchStore((s) => s.setDataAccess);
  const toggleAvoid = useResearchStore((s) => s.toggleAvoid);
  const submit = useResearchStore((s) => s.submit);

  const [activeStep, setActiveStep] = useState<ResearchStep>(initialStep);
  const [errors, setErrors] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [interestInputError, setInterestInputError] = useState<string | null>(null);

  const interestsFull = c.interests.length >= 3;
  const methodsFull = c.methods.length >= 2;
  const majorSuggestions = c.majorArea ? MAJOR_SUGGESTIONS[c.majorArea] : [];
  const customInterests = c.interests.filter((interest) => !INTEREST_TAG_SET.has(interest));
  const activeIndex = RESEARCH_STEPS.findIndex((step) => step.id === activeStep);
  const activeCopy = RESEARCH_STEPS[activeIndex];

  const isStepComplete = (step: ResearchStep): boolean => {
    if (step === "direction") return Boolean(ideaMode);
    if (step === "major") return Boolean(c.majorArea && c.major?.trim());
    if (step === "interests") return c.interests.length > 0;
    if (step === "readiness") return Boolean(c.experience && c.methods.length);
    if (step === "feasibility") return Boolean(c.period && c.dataAccess);
    return RESEARCH_STEPS.slice(0, -1).every((item) => isStepComplete(item.id));
  };

  const completedCount = RESEARCH_STEPS.slice(0, -1).filter((step) => isStepComplete(step.id)).length;
  const hasError = (key: string) => errors.includes(key);

  const focusTop = () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      headingRef.current?.focus({ preventScroll: true });
    });
  };

  const moveTo = (step: ResearchStep) => {
    setErrors([]);
    setInterestInputError(null);
    setActiveStep(step);
    focusTop();
  };

  const missingForStep = (step: ResearchStep) => {
    if (step === "direction") return ideaMode ? [] : ["ideaMode"];
    if (step === "major") return [!c.majorArea && "majorArea", !c.major?.trim() && "major"].filter(Boolean) as string[];
    if (step === "interests") return c.interests.length ? [] : ["interests"];
    if (step === "readiness") return [!c.experience && "experience", !c.methods.length && "methods"].filter(Boolean) as string[];
    if (step === "feasibility") return [!c.period && "period", !c.dataAccess && "dataAccess"].filter(Boolean) as string[];
    return [];
  };

  const goNext = () => {
    const missing = missingForStep(activeStep);
    setErrors(missing);
    if (missing.length) return;
    if (activeIndex < RESEARCH_STEPS.length - 1) moveTo(RESEARCH_STEPS[activeIndex + 1].id);
  };

  const goBack = () => {
    if (activeIndex === 0) {
      router.replace(returnHref);
      return;
    }
    moveTo(RESEARCH_STEPS[activeIndex - 1].id);
  };

  const onAddInterest = () => {
    const result = addInterest(customInterest);
    if (result === "added") {
      setCustomInterest("");
      setInterestInputError(null);
      setErrors((current) => current.filter((key) => key !== "interests"));
      return;
    }
    if (result === "duplicate") {
      setInterestInputError("이미 선택한 관심 분야예요.");
      return;
    }
    if (result === "full") {
      setInterestInputError("관심 분야는 최대 3개까지 선택할 수 있어요.");
      return;
    }
    setInterestInputError("관심 분야를 입력해 주세요.");
  };

  const onSubmit = () => {
    const missing = submit();
    if (missing.length) {
      const target = ERROR_STEP[missing[0]] ?? "direction";
      setActiveStep(target);
      window.requestAnimationFrame(() => setErrors(missing));
      focusTop();
      return;
    }
    router.replace("/co-design");
  };

  const modeIcon: Record<IdeaMode, typeof Brain> = {
    free: Brain,
    trend: ScanSearch,
    fusion: GitCompareArrows,
  };

  const renderDirection = () => (
    <section className="research-step-body" aria-labelledby="research-step-heading">
      <div className={cx("mode-option-list", hasError("ideaMode") && "has-error")}>
        {IDEA_MODES.map((mode) => {
          const Icon = modeIcon[mode.id];
          const selected = ideaMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              className={cx("mode-option", selected && "is-selected")}
              onClick={() => {
                setIdeaMode(mode.id);
                setErrors([]);
              }}
              aria-pressed={selected}
            >
              <span className="mode-option__icon"><Icon size={21} /></span>
              <span className="mode-option__copy"><strong>{mode.label}</strong><small>{mode.description}</small></span>
              <span className="mode-option__check" aria-hidden="true">{selected ? <Check size={16} /> : null}</span>
            </button>
          );
        })}
      </div>
      {hasError("ideaMode") && <p className="field-error">아이디어 탐색 방식을 선택해 주세요.</p>}
      <div className="research-inline-note">
        <Sparkles size={18} />
        <p><strong>점수 대신 근거로 비교해요.</strong> 선택한 방향은 AI 질문과 후보 구성에만 사용돼요.</p>
      </div>
    </section>
  );

  const renderMajor = () => (
    <section className="research-step-body research-major-grid" aria-labelledby="research-step-heading">
      <div className="cond-group research-school-field">
        <label htmlFor="school-input" className="field-label">학교 <small>선택 · 직접 입력 가능</small></label>
        <input id="school-input" className="input" type="text" list="university-options" value={c.school} maxLength={80} placeholder="예) 단국대학교" onChange={(event) => setSchool(event.target.value)} />
        <datalist id="university-options">
          {UNIVERSITY_SUGGESTIONS.map((university) => <option key={university} value={university} />)}
        </datalist>
      </div>

      <div className={cx("cond-group", "research-major-area", hasError("majorArea") && "has-error")}>
        <div className="field-label">전공 계열 <small>필수 · 1개</small></div>
        <div className="chip-grid">
          {MAJOR_AREAS.map((area) => (
            <button key={area} type="button" className={CHIP(c.majorArea === area)} onClick={() => { setMajorArea(area); setErrors((current) => current.filter((key) => key !== "majorArea")); }} aria-pressed={c.majorArea === area}>{area}</button>
          ))}
        </div>
        {hasError("majorArea") && <p className="field-error">전공 계열을 선택해 주세요.</p>}
      </div>

      <div className={cx("cond-group", "research-major-field", hasError("major") && "has-error")}>
        <label htmlFor="major-input" className="field-label">학과·전공 <small>필수 · 검색 또는 직접 입력</small></label>
        <input
          id="major-input"
          className="input"
          type="text"
          list="major-options"
          value={c.major ?? ""}
          maxLength={80}
          disabled={!c.majorArea}
          placeholder={c.majorArea ? "예) 컴퓨터공학과" : "먼저 전공 계열을 선택해 주세요"}
          onChange={(event) => { setMajor(event.target.value); setErrors((current) => current.filter((key) => key !== "major")); }}
          aria-invalid={hasError("major")}
        />
        <datalist id="major-options">
          {majorSuggestions.map((major) => <option key={major} value={major} />)}
        </datalist>
        <p className="field-help">목록에 없는 학과·학부·전공도 직접 입력할 수 있어요.</p>
        {hasError("major") && <p className="field-error">학과·전공을 입력해 주세요.</p>}
      </div>
    </section>
  );

  const renderInterests = () => (
    <section className="research-step-body" aria-labelledby="research-step-heading">
      <div className={cx("cond-group", "research-focus-group", hasError("interests") && "has-error")}>
        <div className="field-label">관심 연구 분야 <small>필수 · 최대 3개</small></div>
        <div className="chip-grid research-interest-grid">
          {UNIVERSAL_INTEREST_TAGS.map((interest) => {
            const selected = c.interests.includes(interest);
            return <button key={interest} type="button" className={CHIP(selected)} disabled={!selected && interestsFull} onClick={() => { toggleInterest(interest); setErrors([]); }} aria-pressed={selected}>{interest}</button>;
          })}
          {customInterests.map((interest) => (
            <button key={interest} type="button" className={CHIP(true)} onClick={() => toggleInterest(interest)} aria-pressed={true}>{interest} ×</button>
          ))}
        </div>
        <div className="research-custom-interest">
          <input
            id="custom-interest-input"
            className="input"
            type="text"
            value={customInterest}
            maxLength={60}
            disabled={interestsFull}
            placeholder="목록에 없다면 직접 입력"
            onChange={(event) => { setCustomInterest(event.target.value); setInterestInputError(null); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAddInterest(); } }}
          />
          <button type="button" className="choice-chip" disabled={interestsFull || !customInterest.trim()} onClick={onAddInterest}>추가</button>
        </div>
        {interestInputError && <p className="field-error" role="alert">{interestInputError}</p>}
        {interestsFull && <p className="cond-hint">최대 3개를 골랐어요. 바꾸려면 하나를 해제하세요.</p>}
        {hasError("interests") && <p className="field-error">관심 분야를 1개 이상 골라 주세요.</p>}
      </div>
    </section>
  );

  const renderReadiness = () => (
    <section className="research-step-body research-two-column" aria-labelledby="research-step-heading">
      <div className={cx("cond-group", hasError("experience") && "has-error")}>
        <div className="field-label">관련 경험 수준 <small>필수 · 1개</small></div>
        <div className="option-list">
          {EXPERIENCE_LEVELS.map((experience) => (
            <button key={experience} type="button" className={c.experience === experience ? "is-selected" : ""} onClick={() => { setExperience(experience); setErrors((current) => current.filter((key) => key !== "experience")); }} aria-pressed={c.experience === experience}><span>{experience}</span></button>
          ))}
        </div>
        {hasError("experience") && <p className="field-error">경험 수준을 골라 주세요.</p>}
      </div>

      <div className={cx("cond-group", hasError("methods") && "has-error")}>
        <div className="field-label">사용할 수 있는 방법·도구 <small>필수 · 최대 2개</small></div>
        <div className="chip-grid">
          {METHOD_TAGS.map((method) => {
            const selected = c.methods.includes(method);
            return <button key={method} type="button" className={CHIP(selected)} disabled={!selected && methodsFull} onClick={() => { toggleMethod(method); setErrors([]); }} aria-pressed={selected}>{method}</button>;
          })}
        </div>
        {methodsFull && <p className="cond-hint">최대 2개를 골랐어요. 바꾸려면 하나를 해제하세요.</p>}
        {hasError("methods") && <p className="field-error">방법·도구를 1개 이상 골라 주세요.</p>}
      </div>
    </section>
  );

  const renderFeasibility = () => (
    <section className="research-step-body research-two-column" aria-labelledby="research-step-heading">
      <div className={cx("cond-group", hasError("period") && "has-error")}>
        <div className="field-label">준비 가능 기간 <small>필수 · 1개</small></div>
        <div className="segmented" style={{ "--segments": 3 } as React.CSSProperties}>
          {PERIODS.map((period) => (
            <button key={period.label} type="button" className={c.period === period.label ? "is-selected" : ""} onClick={() => { setPeriod(period.label); setErrors((current) => current.filter((key) => key !== "period")); }} aria-pressed={c.period === period.label}>{period.label}</button>
          ))}
        </div>
        {hasError("period") && <p className="field-error">준비 가능 기간을 골라 주세요.</p>}
      </div>

      <div className={cx("cond-group", hasError("dataAccess") && "has-error")}>
        <div className="field-label">자료 접근 상황 <small>필수 · 1개</small></div>
        <div className="option-list">
          {DATA_ACCESS.map((access) => (
            <button key={access} type="button" className={c.dataAccess === access ? "is-selected" : ""} onClick={() => { setDataAccess(access); setErrors((current) => current.filter((key) => key !== "dataAccess")); }} aria-pressed={c.dataAccess === access}><span>{access}</span></button>
          ))}
        </div>
        {hasError("dataAccess") && <p className="field-error">자료 접근 상황을 골라 주세요.</p>}
      </div>

      <div className="cond-group research-avoid-group">
        <div className="field-label">피하고 싶은 방식 <small>선택</small></div>
        <div className="chip-grid">
          {AVOID_TAGS.map((avoid) => (
            <button key={avoid} type="button" className={CHIP(c.avoid.includes(avoid))} onClick={() => toggleAvoid(avoid)} aria-pressed={c.avoid.includes(avoid)}>{avoid}</button>
          ))}
        </div>
      </div>
    </section>
  );

  const reviewRows: Array<{ label: string; value: string; step: ResearchStep }> = [
    { label: "탐색 방향", value: IDEA_MODES.find((mode) => mode.id === ideaMode)?.label ?? "확인 필요", step: "direction" },
    { label: "학교·전공", value: [c.school, c.majorArea, c.major].filter(Boolean).join(" · ") || "확인 필요", step: "major" },
    { label: "관심 분야", value: c.interests.join(" · ") || "확인 필요", step: "interests" },
    { label: "경험·도구", value: [c.experience, ...c.methods].filter(Boolean).join(" · ") || "확인 필요", step: "readiness" },
    { label: "기간·자료", value: [c.period, c.dataAccess].filter(Boolean).join(" · ") || "확인 필요", step: "feasibility" },
  ];

  const renderReview = () => (
    <section className="research-step-body" aria-labelledby="research-step-heading">
      <div className="research-review-list">
        {reviewRows.map((row) => (
          <div key={row.label}>
            <strong>{row.label}</strong>
            <span className={row.value === "확인 필요" ? "is-missing" : ""}>{row.value}</span>
            <button type="button" onClick={() => moveTo(row.step)}>수정 <ArrowRight size={15} /></button>
          </div>
        ))}
      </div>
      <div className="research-inline-note research-inline-note--trust">
        <ShieldCheck size={19} />
        <p>확인한 정보와 AI 제안을 나눠 보여드려 비교하면서 선택할 수 있어요.</p>
      </div>
      {errors.length > 0 && <div className="cond-error-banner" role="alert"><CircleAlert size={18} /> 비어 있는 필수 조건을 먼저 확인해 주세요.</div>}
    </section>
  );

  const renderCurrentStep = () => {
    if (activeStep === "direction") return renderDirection();
    if (activeStep === "major") return renderMajor();
    if (activeStep === "interests") return renderInterests();
    if (activeStep === "readiness") return renderReadiness();
    if (activeStep === "feasibility") return renderFeasibility();
    return renderReview();
  };

  return (
    <AppShell
      showHeader={false}
      className="research-screen research-step-screen"
      bottomNav={<ServiceBottomNav />}
      stickyAction={(
        <div className="research-step-actions" data-service-help="research-actions">
          <SecondaryButton onClick={goBack}><ArrowLeft size={18} /> {activeIndex === 0 ? "시작 화면" : "이전"}</SecondaryButton>
          <span>{activeIndex + 1} / {RESEARCH_STEPS.length}</span>
          {activeStep === "review" ? (
            <PrimaryButton onClick={onSubmit}>AI 공동설계 시작 <ArrowRight size={18} /></PrimaryButton>
          ) : (
            <PrimaryButton onClick={goNext}>다음 <ArrowRight size={18} /></PrimaryButton>
          )}
        </div>
      )}
    >
      <header className="research-workspace-header">
        <Link href={returnHref} className="research-back-link" aria-label={returnLabel}><ArrowLeft size={19} /> 돌아가기</Link>
        <Image src={guideCharacter.questFlag} alt="" width={52} height={50} priority unoptimized />
      </header>

      <div className="research-progress-head" data-service-help="research-progress">
        <div className="research-progress-copy">
          <span>{completedCount} / 5 조건 확인</span>
          <Link href="/research/tutorial?source=full"><Route size={15} /> 단계별 설계로 돌아가기</Link>
        </div>
        <div className="research-progress-track" aria-label={`프로젝트 조건 ${completedCount}개 확인됨`} role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={completedCount}>
          <span style={{ width: `${(completedCount / 5) * 100}%` }} />
        </div>
        <nav className="research-stepper" aria-label="프로젝트 설계 단계">
          {RESEARCH_STEPS.map((step, index) => {
            const current = step.id === activeStep;
            const completed = isStepComplete(step.id);
            return (
              <button key={step.id} type="button" className={cx(current && "is-current", completed && "is-complete")} aria-current={current ? "step" : undefined} onClick={() => moveTo(step.id)}>
                <span>{completed ? <Check size={13} strokeWidth={3} /> : index + 1}</span>{step.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div data-service-help="research-question">
        <div className="research-step-heading">
          <h1 id="research-step-heading" ref={headingRef} tabIndex={-1}>{activeCopy.title}</h1>
          <p>{activeCopy.description}</p>
        </div>

        {renderCurrentStep()}
      </div>

      <p className="research-foot"><Compass size={14} /> 현재 입력은 이 브라우저에 자동 저장돼요.</p>
    </AppShell>
  );
}
