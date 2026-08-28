"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceHelpGuide } from "@/components/app/service-help-guide";
import { BrandLogo } from "@/components/brand/brand-logo";
import { brandLogoV2, tutorialScene } from "@/lib/brand-assets";
import {
  DIRECT_ACADEMIC_ENTRY,
  EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
  INTEREST_OPTIONS,
  MAX_DISCOVERY_INTERESTS,
  discoveryContextToMatchTopic,
  toggleLimitedValue,
  validateProfessorDiscoverySecondary,
  validateProfessorDiscoverySetup,
  type ProfessorDiscoveryContext,
} from "@/lib/professor-discovery-model";
import { requestProfessorDiscoveryMatches } from "@/lib/professor-discovery-client";
import {
  findAcademicSelection,
  getDepartmentsForCollege,
  type ProfessorAcademicTaxonomy,
} from "@/lib/professor-academic-taxonomy";
import { useProfileStore } from "@/store/profile-store";
import { useResearchStore } from "@/store/research-store";
import styles from "./professor-tutorial.module.css";

const STORAGE_KEY = "major-evolution-professor-tutorial-v2";

const SETUP_STEPS = ["academic", "interests"] as const;
const ALL_STEPS = [...SETUP_STEPS, "ready"] as const;
type TutorialStep = (typeof ALL_STEPS)[number];

type StoredDraft = {
  version: 2;
  step: TutorialStep;
  context: ProfessorDiscoveryContext;
  directMajor: boolean;
};

type ProfessorTutorialScreenProps = {
  taxonomy: ProfessorAcademicTaxonomy;
  presentation?: "page" | "overlay" | "embedded";
  onRequestClose?: () => void;
};

const STEP_COPY: Record<TutorialStep, { eyebrow: string; title: string; description: string }> = {
  academic: {
    eyebrow: "기본 설정 1 · 전공",
    title: "어떤 전공을 공부하고 있나요?",
    description: "같은 학과와 가까운 연구 분야의 교수님을 찾는 기준이 돼요.",
  },
  interests: {
    eyebrow: "기본 설정 2 · 관심 분야",
    title: "어떤 분야의 교수님을 만나고 싶나요?",
    description: `교수님의 공식 연구 분야와 비교할 관심사를 하나 이상, 최대 ${MAX_DISCOVERY_INTERESTS}개 골라주세요.`,
  },
  ready: {
    eyebrow: "기본 설정 완료",
    title: "이제 교수님을 찾으러 가볼까요?",
    description: "선택한 전공과 관심 분야를 단국대학교 공식 교수 정보와 비교하고, 연결 이유를 함께 보여드려요.",
  },
};

const LOADING_PHASES = ["기본 설정 정리", "학교 공식 정보 대조", "추천 교수 구성"] as const;

function isTutorialStep(value: unknown): value is TutorialStep {
  return typeof value === "string" && (ALL_STEPS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tutorialStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : null;
  } catch {
    return null;
  }
}

function restoreDraft(value: string): StoredDraft | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== 2 || !isTutorialStep(parsed.step)) return null;
    if (!isRecord(parsed.context)) return null;
    const context = parsed.context as Partial<ProfessorDiscoveryContext>;
    return {
      version: 2,
      step: parsed.step,
      directMajor: parsed.directMajor === true,
      context: {
        ...EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
        ...context,
        interests: Array.isArray(context.interests) ? context.interests.filter((item): item is string => typeof item === "string") : [],
        careerInterests: Array.isArray(context.careerInterests) ? context.careerInterests.filter((item): item is string => typeof item === "string") : [],
        careerConcerns: Array.isArray(context.careerConcerns) ? context.careerConcerns.filter((item): item is string => typeof item === "string") : [],
      },
    };
  } catch {
    return null;
  }
}

function ChoiceButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.choice} ${selected ? styles.choiceSelected : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>{children}</span>
      <span className={styles.choiceCheck} aria-hidden="true">
        {selected ? <Check size={16} strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function ProfessorTutorialScreen({
  taxonomy,
  presentation = "page",
  onRequestClose,
}: ProfessorTutorialScreenProps) {
  const router = useRouter();
  const markServiceEntered = useProfileStore((state) => state.markServiceEntered);
  const profileHasHydrated = useProfileStore((state) => state.hasHydrated);
  const profile = useProfileStore((state) => state.profile);
  const setLoading = useResearchStore((state) => state.setProfessorMatchLoading);
  const setMatches = useResearchStore((state) => state.setProfessorMatches);
  const setDiscoveryTopic = useResearchStore((state) => state.setProfessorDiscoveryTopic);
  const setDiscoverySummary = useResearchStore((state) => state.setProfessorDiscoverySummary);
  const setMatchError = useResearchStore((state) => state.setProfessorMatchError);
  const setRejectedIds = useResearchStore((state) => state.setProfessorRejectedIds);
  const clearProfessorMatches = useResearchStore((state) => state.clearProfessorMatches);

  const [step, setStep] = useState<TutorialStep>("academic");
  const [context, setContext] = useState<ProfessorDiscoveryContext>({
    ...EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
    university: taxonomy.university,
    interests: [],
    careerInterests: [],
    careerConcerns: [],
  });
  const [directMajor, setDirectMajor] = useState(false);
  const [restored, setRestored] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const userEditedRef = useRef(false);

  useEffect(() => {
    markServiceEntered();
  }, [markServiceEntered]);

  useEffect(() => {
    if (!profileHasHydrated || restored) return;
    const saved = restoreDraft(tutorialStorage()?.getItem(STORAGE_KEY) ?? "");
    if (saved) {
      setStep(saved.step);
      setContext({ ...saved.context, university: taxonomy.university });
      setDirectMajor(saved.directMajor);
    } else if (!userEditedRef.current) {
      const academicSelection = findAcademicSelection(taxonomy, profile.major);
      setContext((current) => ({
        ...current,
        university: taxonomy.university,
        college: current.college
          || academicSelection?.college
          || (profile.major ? DIRECT_ACADEMIC_ENTRY : ""),
        major: current.major || academicSelection?.department || profile.major,
        interests: current.interests.length > 0
          ? current.interests
          : profile.interests.slice(0, MAX_DISCOVERY_INTERESTS),
      }));
      setDirectMajor((current) => current || Boolean(profile.major && !academicSelection));
    }
    setRestored(true);
  }, [profile, profileHasHydrated, restored, taxonomy]);

  useEffect(() => {
    if (!restored || isMatching) return;
    const draft: StoredDraft = { version: 2, step, context, directMajor };
    tutorialStorage()?.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [context, directMajor, isMatching, restored, step]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!isMatching) return;
    setLoadingPhase(0);
    const timer = window.setInterval(() => {
      setLoadingPhase((current) => Math.min(current + 1, LOADING_PHASES.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [isMatching]);

  const departments = useMemo(
    () => getDepartmentsForCollege(taxonomy, context.college),
    [context.college, taxonomy],
  );
  const stepCopy = STEP_COPY[step];
  const setupIndex = SETUP_STEPS.indexOf(step as (typeof SETUP_STEPS)[number]);
  const progressLabel = step === "ready"
    ? "기본 설정 완료"
    : `기본 설정 ${setupIndex + 1}/${SETUP_STEPS.length}`;
  const progressValue = step === "ready"
    ? 100
    : ((setupIndex + 1) / SETUP_STEPS.length) * 100;
  const isOverlay = presentation === "overlay";
  const isEmbedded = presentation === "embedded";
  const TutorialMain = presentation === "page" ? "main" : "div";

  const update = (patch: Partial<ProfessorDiscoveryContext>) => {
    userEditedRef.current = true;
    setError(null);
    setContext((current) => ({ ...current, ...patch }));
  };

  const resetTutorial = () => {
    requestRef.current?.abort();
    tutorialStorage()?.removeItem(STORAGE_KEY);
    clearProfessorMatches();
    setContext({
      ...EMPTY_PROFESSOR_DISCOVERY_CONTEXT,
      university: taxonomy.university,
      interests: [],
      careerInterests: [],
      careerConcerns: [],
    });
    setDirectMajor(false);
    setError(null);
    setStep("academic");
  };

  const goBack = () => {
    const currentIndex = ALL_STEPS.indexOf(step);
    if (currentIndex <= 0) return;
    setError(null);
    setStep(ALL_STEPS[currentIndex - 1]);
  };

  const startMatch = async () => {
    const setupIssue = validateProfessorDiscoverySetup(context);
    if (setupIssue) {
      setError(setupIssue.message);
      setStep(setupIssue.field === "interests" ? "interests" : "academic");
      return;
    }
    const secondaryIssue = validateProfessorDiscoverySecondary(context);
    if (secondaryIssue) {
      setError(secondaryIssue);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const matchTopic = discoveryContextToMatchTopic(context);
    setError(null);
    setIsMatching(true);
    clearProfessorMatches();
    setRejectedIds([]);
    setLoading(matchTopic.id);
    try {
      const response = await requestProfessorDiscoveryMatches(context, { signal: controller.signal });
      if (requestRef.current !== controller) return;
      setMatches(response);
      setDiscoveryTopic(matchTopic);
      setDiscoverySummary({
        major: context.major,
        interests: context.interests,
        careerConcerns: context.careerConcerns,
      });
      const profileState = useProfileStore.getState();
      profileState.saveProfile({
        name: profileState.profile.name,
        school: context.university,
        major: context.major,
        grade: profileState.profile.grade,
        careerConcern: profileState.profile.careerConcern,
        interests: context.interests,
      });
      profileState.completeProfessorTutorial();
      tutorialStorage()?.removeItem(STORAGE_KEY);
      router.push("/professors/pitch");
    } catch (caught) {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const message = caught instanceof Error
        ? caught.message
        : "공식 교수 정보를 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      setMatchError(matchTopic.id, message);
      setError(message);
      setIsMatching(false);
    }
  };

  const primaryDisabled = (
    (step === "academic" && (!context.college || !context.major.trim()))
    || (step === "interests" && context.interests.length === 0)
  );

  const renderQuestion = () => {
    if (step === "academic") {
      const selectValue = directMajor
        ? DIRECT_ACADEMIC_ENTRY
        : departments.includes(context.major) ? context.major : "";
      return (
        <div className={styles.formStack}>
          <label className={styles.field}>
            <span>학교</span>
            <div className={styles.fixedField}>
              <ShieldCheck size={18} /> {taxonomy.university}
              <small>공식 교수 {taxonomy.officialProfessorCount.toLocaleString("ko-KR")}명 데이터 파일럿</small>
            </div>
          </label>
          <label className={styles.field}>
            <span>단과대</span>
            <div className={styles.selectWrap}>
              <select
                value={context.college}
                onChange={(event) => {
                  update({ college: event.target.value, major: "" });
                  setDirectMajor(false);
                }}
              >
                <option value="">단과대를 선택해 주세요</option>
                {taxonomy.colleges.map((college) => <option key={college.name} value={college.name}>{college.name}</option>)}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </div>
          </label>
          <label className={styles.field}>
            <span>주전공</span>
            <div className={styles.selectWrap}>
              <select
                value={selectValue}
                disabled={!context.college}
                onChange={(event) => {
                  const value = event.target.value;
                  setDirectMajor(value === DIRECT_ACADEMIC_ENTRY);
                  update({ major: value === DIRECT_ACADEMIC_ENTRY ? "" : value });
                }}
              >
                <option value="">전공을 선택해 주세요</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                <option value={DIRECT_ACADEMIC_ENTRY}>목록에 없어요 · 직접 입력</option>
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </div>
          </label>
          {directMajor && (
            <label className={styles.field}>
              <span>전공 직접 입력</span>
              <input
                value={context.major}
                maxLength={60}
                placeholder="예: 모바일시스템공학과"
                autoFocus
                onChange={(event) => update({ major: event.target.value })}
              />
            </label>
          )}
        </div>
      );
    }

    if (step === "interests") {
      return (
        <>
          <div className={styles.selectionCount}>{context.interests.length}/{MAX_DISCOVERY_INTERESTS} 선택</div>
          <div className={styles.chipGrid}>{INTEREST_OPTIONS.map((option) => <ChoiceButton key={option} selected={context.interests.includes(option)} onClick={() => update({ interests: toggleLimitedValue(context.interests, option, MAX_DISCOVERY_INTERESTS) })}>{option}</ChoiceButton>)}</div>
        </>
      );
    }

    return (
      <div className={styles.reviewPanel}>
        <div className={styles.reviewHero}>
          <span className={styles.reviewMark}><Check size={22} strokeWidth={2.5} /></span>
          <div><span>{taxonomy.university}</span><strong>{context.major}</strong></div>
        </div>
        <dl className={styles.reviewList}>
          <div><dt>전공</dt><dd>{context.college} · {context.major}</dd></div>
          <div><dt>관심 분야</dt><dd>{context.interests.join(" · ")}</dd></div>
        </dl>
        <div className={styles.sourcePromise}><ShieldCheck size={18} /><span>교수님께 자동으로 연락하지 않아요. 연결 이유를 확인한 뒤 최종 선택은 직접 할 수 있어요.</span></div>
      </div>
    );
  };

  const nextStep = () => {
    const index = ALL_STEPS.indexOf(step);
    if (index >= 0 && index < ALL_STEPS.length - 1) setStep(ALL_STEPS[index + 1]);
  };

  const closeTutorial = () => {
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.push("/home");
  };

  if (isMatching) {
    return (
      <TutorialMain
        id={presentation === "page" ? "main-content" : undefined}
        className={`${styles.loadingPage} ${isOverlay ? styles.overlayLoadingPage : ""} ${isEmbedded ? styles.embeddedLoadingPage : ""}`}
      >
        <div className={styles.loadingCard} aria-live="polite">
          <div className={styles.processingVisual}>
            <Image src={brandLogoV2.mark} alt="" width={86} height={86} priority unoptimized />
          </div>
          <span className={styles.eyebrow}>맞춤 교수 찾는 중</span>
          <h1>전공과 관심 분야를 공식 정보와 비교하고 있어요.</h1>
          <p>교수님께 연락하거나 결정을 대신하지 않아요.</p>
          <ol className={styles.loadingSteps}>
            {LOADING_PHASES.map((phase, index) => (
              <li key={phase} className={index <= loadingPhase ? styles.loadingStepActive : ""}>
                {index < loadingPhase ? <Check size={16} /> : index === loadingPhase ? <LoaderCircle size={16} className={styles.spinner} /> : <span />}
                {phase}
              </li>
            ))}
          </ol>
        </div>
      </TutorialMain>
    );
  }

  return (
    <div className={`${styles.page} ${isOverlay ? styles.overlayPage : ""} ${isEmbedded ? `${styles.overlayPage} ${styles.embeddedPage}` : ""}`}>
      <header className={styles.header}>
        {presentation !== "page" ? (
          <div className={styles.overlayTitle}>
            <span><Compass size={19} aria-hidden="true" /></span>
            <div>
              <strong>교수 매칭 기본 설정</strong>
              <small>입력한 설정은 이 브라우저에 저장돼요</small>
            </div>
          </div>
        ) : (
          <BrandLogo href="/home" tagline="전공·진로 첫 대화" className={styles.brand} />
        )}
        <div className="standalone-tutorial-header-actions">
          <div className={styles.headerMeta}>
            <span><ShieldCheck size={15} /> 학교 공식 정보와 비교해요</span>
            <button type="button" onClick={resetTutorial}><RotateCcw size={15} /> 처음부터</button>
            {presentation !== "page" && (
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeTutorial}
                aria-label={isEmbedded ? "홈으로 돌아가기" : "교수 매칭 기본 설정 닫기"}
              >
                {isEmbedded ? <ArrowLeft size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
                {isEmbedded ? "홈으로" : "닫기"}
              </button>
            )}
          </div>
          {presentation === "page" ? (
            <>
              <Link
                href="/welcome"
                className="top-app-bar__intro"
                aria-label="서비스 소개 보기"
                title="서비스 소개 보기"
              >
                <BookOpen size={18} aria-hidden="true" />
              </Link>
              <ServiceHelpGuide placement="header" />
            </>
          ) : null}
        </div>
      </header>

      <TutorialMain id={presentation === "page" ? "main-content" : undefined} className={styles.shell}>
        <aside className={styles.contextPanel} data-service-help="professor-progress-context">
          <div className={styles.progressTop}>
            <span>{progressLabel}</span>
            <strong>{Math.round(progressValue)}%</strong>
          </div>
          <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${progressValue}%` }} /></div>
          <div className={styles.contextCopy}>
            <span className={styles.eyebrow}>{stepCopy.eyebrow}</span>
            <h1>{stepCopy.title}</h1>
            <p>{stepCopy.description}</p>
          </div>
          <figure className={styles.contextMedia}>
            <Image
              src={tutorialScene.firstPath}
              alt="캠퍼스에서 자신의 고민을 정리하며 교수와의 첫 대화를 준비하는 학생"
              fill
              sizes="(max-width: 759px) calc(100vw - 32px), (max-width: 1279px) 46vw, 520px"
              priority
            />
          </figure>
          <div className={styles.contextTip}>
            <CheckCircle2 size={19} aria-hidden="true" />
            <p><strong>답이 달라져도 괜찮아요.</strong> 뒤로 가서 언제든 수정할 수 있습니다.</p>
          </div>
          <div className={styles.scopeTag}><ShieldCheck size={16} /> 단국대학교 공식 데이터 파일럿</div>
        </aside>

        <section
          className={styles.questionPanel}
          aria-labelledby="tutorial-question"
          data-service-help="professor-question"
        >
          <div className={styles.mobileProgress}>
            <span>{progressLabel}</span>
            <div className={styles.progressTrack}><span style={{ width: `${progressValue}%` }} /></div>
          </div>
          <>
            <div className={styles.mobileQuestionCopy}>
              <span className={styles.eyebrow}>{stepCopy.eyebrow}</span>
              <h1 id="tutorial-question">{stepCopy.title}</h1>
              <p>{stepCopy.description}</p>
            </div>

            {step === "academic" && (
              <figure className={styles.mobileHeroMedia}>
                <Image
                  src={tutorialScene.firstPath}
                  alt="캠퍼스에서 자신의 고민을 정리하며 교수와의 첫 대화를 준비하는 학생"
                  fill
                  sizes="(max-width: 759px) calc(100vw - 32px), (max-width: 1279px) 560px, 720px"
                  priority
                />
              </figure>
            )}
          </>

          <div className={styles.questionBody} data-service-help="professor-options">{renderQuestion()}</div>

          {error && <div className={styles.errorBox} role="alert">{error}</div>}

          <div className={styles.actions} data-service-help="professor-actions">
            {step !== "academic" && (
              <button type="button" className={styles.backButton} onClick={goBack}><ArrowLeft size={18} /> 이전</button>
            )}
            {step === "ready" ? (
              <button type="button" className={styles.primaryButton} onClick={startMatch}>교수님 찾기 <ArrowRight size={18} /></button>
            ) : (
              <button type="button" className={styles.primaryButton} disabled={primaryDisabled} onClick={nextStep}>
                {step === "academic" ? "관심 분야 고르기" : "선택 내용 확인"} <ArrowRight size={18} />
              </button>
            )}
          </div>
        </section>
      </TutorialMain>
    </div>
  );
}
