"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Check,
  ChevronRight,
  Combine,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceHelpGuide } from "@/components/app/service-help-guide";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  MAJOR_AREAS,
  MAJOR_SUGGESTIONS,
  UNIVERSAL_INTEREST_TAGS,
  type MajorArea,
} from "@/data/academic-options";
import { IDEA_MODES, modeById, type IdeaMode } from "@/data/co-design";
import {
  DATA_ACCESS,
  EXPERIENCE_LEVELS,
  METHOD_TAGS,
  PERIODS,
  type DataAccess,
  type ExperienceLevel,
  type PeriodLabel,
} from "@/data/research-mvp";
import { isDankookUniversity } from "@/lib/professor-discovery-client";
import { emptyConditions, type Conditions } from "@/lib/recommend";
import { useProfileStore } from "@/store/profile-store";
import { useResearchStore } from "@/store/research-store";
import styles from "./research-tutorial.module.css";

const STORAGE_KEY = "major-evolution-research-tutorial-v1";
const QUESTION_STEPS = ["major", "mode", "interests", "readiness", "feasibility", "review"] as const;
const ALL_STEPS = ["welcome", ...QUESTION_STEPS] as const;
const MAX_INTERESTS = 3;
const MAX_METHODS = 2;

const STEP_LABEL: Record<QuestionStep, string> = {
  major: "전공",
  mode: "탐색 방식",
  interests: "관심 분야",
  readiness: "경험·도구",
  feasibility: "기간·자료",
  review: "최종 확인",
};

type QuestionStep = (typeof QUESTION_STEPS)[number];
type TutorialStep = (typeof ALL_STEPS)[number];

type TutorialDraft = {
  version: 1;
  step: TutorialStep;
  ideaMode: IdeaMode | null;
  conditions: Conditions;
};

type ResearchTutorialScreenProps = {
  presentation?: "page" | "overlay" | "embedded";
  onRequestClose?: () => void;
};

type StepCopy = {
  title: string;
  description: string;
};

const STEP_COPY: Record<TutorialStep, StepCopy> = {
  welcome: {
    title: "나만의 프로젝트를 AI와 설계해 볼까요?",
    description: "지금 편한 방식을 골라 시작하세요. 진행 중인 답은 이 브라우저에 자동으로 저장돼요.",
  },
  major: {
    title: "지금 공부하고 있는 전공은 무엇인가요?",
    description: "프로젝트 뒤의 맞춤 교수 추천까지 이어지도록, 현재 공식 데이터를 지원하는 학교를 먼저 확인해요.",
  },
  mode: {
    title: "어떤 전공 조합으로 아이디어를 만들까요?",
    description: "하나를 골라도 나중에 바꿀 수 있어요.",
  },
  interests: {
    title: "요즘 더 알아보고 싶은 분야는 무엇인가요?",
    description: "하나 이상, 최대 3개까지 선택해 주세요.",
  },
  readiness: {
    title: "지금 바로 활용할 수 있는 경험과 방법은 무엇인가요?",
    description: "잘하는 정도가 아니라, 이번 아이디어에서 실제로 시도할 수 있는 범위를 확인해요.",
  },
  feasibility: {
    title: "얼마나 준비할 수 있고, 어떤 자료에 접근할 수 있나요?",
    description: "실현 가능한 범위로 아이디어를 좁히는 데만 사용해요.",
  },
  review: {
    title: "이 조건으로 프로젝트를 함께 설계할까요?",
    description: "AI 맞춤 질문을 거쳐 후보 2개를 만들고 근거와 확인할 점을 비교해요.",
  },
};

const MODE_PRESENTATION: Record<IdeaMode, {
  label: string;
  description: string;
  icon: LucideIcon;
}> = {
  free: {
    label: "내 전공 안에서",
    description: "내 전공의 주제와 방법을 더 깊게 탐구해요.",
    icon: BookOpenCheck,
  },
  trend: {
    label: "내 전공에 AI 더하기",
    description: "AI 기술이나 도구를 내 전공에 접목해요.",
    icon: WandSparkles,
  },
  fusion: {
    label: "다른 전공과 연결하기",
    description: "다른 전공의 관점과 방법을 연결해요.",
    icon: Combine,
  },
};

const MISSING_LABEL: Record<string, string> = {
  school: "현재 맞춤 교수 추천은 단국대학교 공식 데이터만 지원해요. 학교를 단국대학교로 확인해 주세요.",
  ideaMode: "탐색 방식을 선택해 주세요.",
  majorArea: "전공 계열을 선택해 주세요.",
  major: "학과·전공을 입력해 주세요.",
  interests: "관심 분야를 하나 이상 선택해 주세요.",
  experience: "관련 경험을 선택해 주세요.",
  methods: "사용할 수 있는 방법을 하나 이상 선택해 주세요.",
  period: "준비 가능 기간을 선택해 주세요.",
  dataAccess: "자료 접근 상황을 선택해 주세요.",
};

function isTutorialStep(value: unknown): value is TutorialStep {
  return typeof value === "string" && (ALL_STEPS as readonly string[]).includes(value);
}

function isIdeaMode(value: unknown): value is IdeaMode {
  return typeof value === "string" && IDEA_MODES.some((mode) => mode.id === value);
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((item) => cleanString(item, maxLength))
      .filter(Boolean),
  )).slice(0, maxItems);
}

function restoreDraft(value: string): TutorialDraft | null {
  try {
    const parsed = JSON.parse(value) as Partial<TutorialDraft>;
    if (parsed.version !== 1 || !isTutorialStep(parsed.step) || !parsed.conditions) return null;
    const raw = parsed.conditions as Partial<Conditions>;
    return {
      version: 1,
      step: parsed.step,
      ideaMode: isIdeaMode(parsed.ideaMode) ? parsed.ideaMode : null,
      conditions: {
        school: cleanString(raw.school, 80),
        majorArea: isOneOf(raw.majorArea, MAJOR_AREAS) ? raw.majorArea : null,
        major: cleanString(raw.major, 80) || null,
        interests: cleanStringList(raw.interests, MAX_INTERESTS, 60),
        experience: isOneOf(raw.experience, EXPERIENCE_LEVELS) ? raw.experience : null,
        methods: cleanStringList(raw.methods, MAX_METHODS, 60)
          .filter((method) => METHOD_TAGS.includes(method as (typeof METHOD_TAGS)[number])),
        period: PERIODS.some((period) => period.label === raw.period)
          ? raw.period as PeriodLabel
          : null,
        dataAccess: isOneOf(raw.dataAccess, DATA_ACCESS) ? raw.dataAccess : null,
        avoid: cleanStringList(raw.avoid, 10, 60),
      },
    };
  } catch {
    return null;
  }
}

function createDraft(conditions: Conditions, ideaMode: IdeaMode | null): TutorialDraft {
  return {
    version: 1,
    step: "welcome",
    ideaMode,
    conditions: {
      ...emptyConditions,
      ...conditions,
      interests: [...conditions.interests].slice(0, MAX_INTERESTS),
      methods: [...conditions.methods].slice(0, MAX_METHODS),
      avoid: [...conditions.avoid],
    },
  };
}

function toggleLimited(list: string[], value: string, limit: number): string[] {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (list.length >= limit) return list;
  return [...list, value];
}

function issueForStep(step: TutorialStep, draft: TutorialDraft): string | null {
  const c = draft.conditions;
  if (step === "major") {
    if (!c.school.trim() || !isDankookUniversity(c.school)) return MISSING_LABEL.school;
    if (!c.majorArea) return MISSING_LABEL.majorArea;
    if (!c.major?.trim()) return MISSING_LABEL.major;
  }
  if (step === "mode" && !draft.ideaMode) return MISSING_LABEL.ideaMode;
  if (step === "interests" && c.interests.length === 0) return MISSING_LABEL.interests;
  if (step === "readiness") {
    if (!c.experience) return MISSING_LABEL.experience;
    if (c.methods.length === 0) return MISSING_LABEL.methods;
  }
  if (step === "feasibility") {
    if (!c.period) return MISSING_LABEL.period;
    if (!c.dataAccess) return MISSING_LABEL.dataAccess;
  }
  return null;
}

function SelectionButton({
  selected,
  children,
  onClick,
  className = "",
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={[styles.selection, selected ? styles.selectionSelected : "", className].filter(Boolean).join(" ")}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>{children}</span>
      <span className={styles.selectionCheck} aria-hidden="true">
        {selected ? <Check size={16} strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function ResearchTutorialScreen({
  presentation = "page",
  onRequestClose,
}: ResearchTutorialScreenProps = {}) {
  const router = useRouter();
  const isOverlay = presentation === "overlay";
  const isEmbedded = presentation === "embedded";
  const TutorialMain = presentation === "page" ? "main" : "div";
  const topRef = useRef<HTMLDivElement>(null);
  const markServiceEntered = useProfileStore((state) => state.markServiceEntered);
  const profileSchool = useProfileStore((state) => state.profile.school);
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const storedConditions = useResearchStore((state) => state.conditions);
  const storedIdeaMode = useResearchStore((state) => state.ideaMode);
  const result = useResearchStore((state) => state.result);
  const beginIdeaCoDesign = useResearchStore((state) => state.beginIdeaCoDesign);
  const saveIdeaDraft = useResearchStore((state) => state.saveIdeaDraft);

  const [draft, setDraft] = useState<TutorialDraft>(() => createDraft(emptyConditions, null));
  const [ready, setReady] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [customInterest, setCustomInterest] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    markServiceEntered();
  }, [markServiceEntered]);

  useEffect(() => {
    if (!hasHydrated || ready) return;
    const fromFullForm = typeof window !== "undefined"
      && new URLSearchParams(window.location.search).get("source") === "full";
    const saved = fromFullForm
      ? null
      : restoreDraft(browserStorage()?.getItem(STORAGE_KEY) ?? "");
    const conditionsWithKnownSchool = storedConditions.school.trim()
      ? storedConditions
      : { ...storedConditions, school: profileSchool };
    setDraft(saved ?? createDraft(conditionsWithKnownSchool, storedIdeaMode));
    if (fromFullForm) window.history.replaceState(null, "", window.location.pathname);
    setReady(true);
  }, [hasHydrated, profileSchool, ready, storedConditions, storedIdeaMode]);

  useEffect(() => {
    if (!ready || submitting) return;
    browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, ready, submitting]);

  const step = draft.step;
  const copy = STEP_COPY[step];
  const completedInputSteps = QUESTION_STEPS
    .filter((item) => item !== "review")
    .filter((item) => !issueForStep(item, draft)).length;
  const totalInputSteps = QUESTION_STEPS.length - 1;
  const progress = (completedInputSteps / totalInputSteps) * 100;
  const majorSuggestions = draft.conditions.majorArea
    ? MAJOR_SUGGESTIONS[draft.conditions.majorArea]
    : [];

  const contextRows = useMemo(() => {
    const c = draft.conditions;
    return [
      { label: "주전공", value: c.major ?? "" },
      { label: "학교", value: c.school },
      { label: "탐색 방식", value: draft.ideaMode ? MODE_PRESENTATION[draft.ideaMode].label : "" },
      { label: "관심 분야", value: c.interests.join(" · ") },
      { label: "관련 경험", value: c.experience ?? "" },
      { label: "방법·도구", value: c.methods.join(" · ") },
      { label: "기간·자료", value: [c.period, c.dataAccess].filter(Boolean).join(" · ") },
    ].filter((row) => row.value);
  }, [draft]);

  const patchConditions = (patch: Partial<Conditions>) => {
    setIssue(null);
    setDraft((current) => ({
      ...current,
      conditions: { ...current.conditions, ...patch },
    }));
  };

  const goTo = (next: TutorialStep) => {
    setIssue(null);
    setDraft((current) => ({ ...current, step: next }));
    window.requestAnimationFrame(() => {
      topRef.current?.focus({ preventScroll: true });
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const goNext = () => {
    const currentIssue = issueForStep(step, draft);
    if (currentIssue) {
      setIssue(currentIssue);
      return;
    }
    const index = ALL_STEPS.indexOf(step);
    if (index < ALL_STEPS.length - 1) goTo(ALL_STEPS[index + 1]);
  };

  const goBack = () => {
    const index = ALL_STEPS.indexOf(step);
    if (index > 0) goTo(ALL_STEPS[index - 1]);
  };

  const startGuided = () => {
    const next = QUESTION_STEPS
      .filter((item) => item !== "review")
      .find((item) => issueForStep(item, draft)) ?? "review";
    goTo(next);
  };

  const skipToNext = () => {
    const index = ALL_STEPS.indexOf(step);
    if (index < ALL_STEPS.length - 1) goTo(ALL_STEPS[index + 1]);
  };

  const switchToFullForm = () => {
    saveIdeaDraft({ ideaMode: draft.ideaMode, conditions: draft.conditions });
    browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(draft));
    router.push("/research");
  };

  const addCustomInterest = () => {
    const value = cleanString(customInterest, 60);
    if (!value) {
      setIssue("추가할 관심 분야를 입력해 주세요.");
      return;
    }
    if (draft.conditions.interests.includes(value)) {
      setIssue("이미 선택한 관심 분야예요.");
      return;
    }
    if (draft.conditions.interests.length >= MAX_INTERESTS) {
      setIssue("관심 분야는 최대 3개까지 선택할 수 있어요.");
      return;
    }
    patchConditions({ interests: [...draft.conditions.interests, value] });
    setCustomInterest("");
  };

  const startCoDesign = () => {
    const schoolIssue = issueForStep("major", draft);
    if (schoolIssue && (!draft.conditions.school.trim() || !isDankookUniversity(draft.conditions.school))) {
      goTo("major");
      window.setTimeout(() => setIssue(schoolIssue), 0);
      return;
    }
    setSubmitting(true);
    const missing = beginIdeaCoDesign({
      ideaMode: draft.ideaMode,
      conditions: draft.conditions,
    });
    if (missing.length) {
      setSubmitting(false);
      setIssue(MISSING_LABEL[missing[0]] ?? "필수 조건을 다시 확인해 주세요.");
      const target = missing[0] === "ideaMode"
        ? "mode"
        : ["majorArea", "major"].includes(missing[0])
          ? "major"
          : missing[0] === "interests"
            ? "interests"
            : ["experience", "methods"].includes(missing[0])
              ? "readiness"
              : "feasibility";
      goTo(target as TutorialStep);
      return;
    }
    browserStorage()?.setItem(STORAGE_KEY, JSON.stringify({ ...draft, step: "review" }));
    router.push("/co-design");
  };

  const closeTutorial = () => {
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.push("/home");
  };

  if (!ready) {
    return (
      <div className={`${styles.loading} ${isEmbedded ? styles.embeddedLoading : ""}`}>
        <LoaderCircle className={styles.spin} size={24} />
        <p>저장된 프로젝트 조건을 불러오고 있어요.</p>
      </div>
    );
  }

  const renderStep = () => {
    if (step === "welcome") {
      return (
        <div className={styles.welcome}>
          <div className={styles.promiseList}>
            <p><Sparkles size={19} /> 가능한 후보 2개와 비교 근거를 만들어요.</p>
            <p><ShieldCheck size={19} /> 두 방식 모두 자동 저장되며 언제든 바꿀 수 있어요.</p>
          </div>
          <div className={styles.pathGrid} data-service-help="research-actions">
            <button type="button" className={`${styles.pathCard} ${styles.pathCardPrimary}`} onClick={startGuided}>
              <span className={styles.pathIcon}><Route size={25} /></span>
              <span className={styles.pathCopy}>
                <small>{completedInputSteps ? `${completedInputSteps}/${totalInputSteps}개 답변 저장됨` : "처음 시작하거나 아직 막막하다면"}</small>
                <strong>{completedInputSteps ? "한 단계씩 이어가기" : "한 단계씩 질문받기"}</strong>
                <span>전공부터 기간까지 한 번에 하나씩 정리해요.</span>
              </span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <button type="button" className={styles.pathCard} onClick={switchToFullForm}>
              <span className={styles.pathIcon}><SlidersHorizontal size={25} /></span>
              <span className={styles.pathCopy}>
                <small>이미 생각해 둔 조건이 있다면</small>
                <strong>한 화면에서 직접 입력</strong>
                <span>전체 조건을 펼쳐 놓고 원하는 순서로 조정해요.</span>
              </span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
          {result ? (
            <Link href="/result" className={styles.resumeResult}>
              <Lightbulb size={19} /> 기존 프로젝트 결과 이어보기 <ChevronRight size={17} />
            </Link>
          ) : null}
        </div>
      );
    }

    if (step === "major") {
      return (
        <div className={styles.formStack}>
          <label className={styles.field}>
            <span>학교 <small>필수 · 현재 단국대학교 지원</small></span>
            <select
              value={isDankookUniversity(draft.conditions.school) ? "단국대학교" : ""}
              onChange={(event) => patchConditions({ school: event.target.value })}
            >
              <option value="">지원 학교를 확인해 주세요</option>
              <option value="단국대학교">단국대학교</option>
            </select>
            <small>프로젝트 아이디어 생성은 학교와 무관하지만, 다음 단계의 교수 추천은 현재 단국대학교 공식 교수 데이터로만 제공돼요.</small>
          </label>
          <label className={styles.field}>
            <span>전공 계열 <small>필수</small></span>
            <select
              value={draft.conditions.majorArea ?? ""}
              onChange={(event) => {
                const majorArea = event.target.value as MajorArea;
                patchConditions({ majorArea, major: "" });
              }}
            >
              <option value="">전공 계열을 선택해 주세요</option>
              {MAJOR_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>학과·전공 <small>필수</small></span>
            <input
              value={draft.conditions.major ?? ""}
              list="research-tutorial-majors"
              disabled={!draft.conditions.majorArea}
              maxLength={80}
              placeholder={draft.conditions.majorArea ? "예: 컴퓨터공학과" : "먼저 전공 계열을 선택해 주세요"}
              onChange={(event) => patchConditions({ major: event.target.value })}
            />
            <datalist id="research-tutorial-majors">
              {majorSuggestions.map((major) => <option key={major} value={major} />)}
            </datalist>
          </label>
        </div>
      );
    }

    if (step === "mode") {
      return (
        <div className={styles.modeList} role="radiogroup" aria-label="아이디어 탐색 방식">
          {IDEA_MODES.map((mode) => {
            const presentation = MODE_PRESENTATION[mode.id];
            const Icon = presentation.icon;
            const selected = draft.ideaMode === mode.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                key={mode.id}
                className={[styles.modeChoice, selected ? styles.modeChoiceSelected : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  setIssue(null);
                  setDraft((current) => ({ ...current, ideaMode: mode.id }));
                }}
              >
                <span className={styles.modeIcon}><Icon size={28} /></span>
                <span className={styles.modeCopy}>
                  <strong>{presentation.label}</strong>
                  <small>{presentation.description}</small>
                </span>
                <span className={styles.modeCheck}>{selected ? <Check size={19} strokeWidth={3} /> : null}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (step === "interests") {
      return (
        <div className={styles.interestSection}>
          <p className={styles.selectionCount}>{draft.conditions.interests.length}/{MAX_INTERESTS} 선택</p>
          <div className={styles.chipGrid}>
            {UNIVERSAL_INTEREST_TAGS.map((interest) => (
              <SelectionButton
                key={interest}
                selected={draft.conditions.interests.includes(interest)}
                onClick={() => patchConditions({
                  interests: toggleLimited(draft.conditions.interests, interest, MAX_INTERESTS),
                })}
              >
                {interest}
              </SelectionButton>
            ))}
          </div>
          <div className={styles.customInput}>
            <input
              value={customInterest}
              maxLength={60}
              placeholder="목록에 없는 관심 분야"
              onChange={(event) => {
                setIssue(null);
                setCustomInterest(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomInterest();
                }
              }}
            />
            <button type="button" onClick={addCustomInterest}>추가</button>
          </div>
        </div>
      );
    }

    if (step === "readiness") {
      return (
        <div className={styles.splitFields}>
          <fieldset>
            <legend>관련 경험 <small>1개 선택</small></legend>
            <div className={styles.choiceGrid}>
              {EXPERIENCE_LEVELS.map((experience) => (
                <SelectionButton
                  key={experience}
                  selected={draft.conditions.experience === experience}
                  onClick={() => patchConditions({ experience: experience as ExperienceLevel })}
                >
                  {experience}
                </SelectionButton>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>방법·도구 <small>최대 2개</small></legend>
            <div className={styles.chipGrid}>
              {METHOD_TAGS.map((method) => (
                <SelectionButton
                  key={method}
                  selected={draft.conditions.methods.includes(method)}
                  onClick={() => patchConditions({
                    methods: toggleLimited(draft.conditions.methods, method, MAX_METHODS),
                  })}
                >
                  {method}
                </SelectionButton>
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    if (step === "feasibility") {
      return (
        <div className={styles.splitFields}>
          <fieldset>
            <legend>준비 가능 기간 <small>1개 선택</small></legend>
            <div className={styles.periodGrid}>
              {PERIODS.map((period) => (
                <SelectionButton
                  key={period.label}
                  selected={draft.conditions.period === period.label}
                  onClick={() => patchConditions({ period: period.label as PeriodLabel })}
                >
                  {period.label}
                </SelectionButton>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>자료 접근 상황 <small>1개 선택</small></legend>
            <div className={styles.choiceGrid}>
              {DATA_ACCESS.map((access) => (
                <SelectionButton
                  key={access}
                  selected={draft.conditions.dataAccess === access}
                  onClick={() => patchConditions({ dataAccess: access as DataAccess })}
                >
                  {access}
                </SelectionButton>
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    const reviewRows = [
      { label: "학교", value: draft.conditions.school ?? "", step: "major" },
      { label: "탐색 방식", value: draft.ideaMode ? MODE_PRESENTATION[draft.ideaMode].label : "", step: "mode" },
      { label: "주전공", value: draft.conditions.major ?? "", step: "major" },
      { label: "관심 분야", value: draft.conditions.interests.join(" · "), step: "interests" },
      { label: "관련 경험", value: draft.conditions.experience ?? "", step: "readiness" },
      { label: "방법·도구", value: draft.conditions.methods.join(" · "), step: "readiness" },
      { label: "기간·자료", value: [draft.conditions.period, draft.conditions.dataAccess].filter(Boolean).join(" · "), step: "feasibility" },
    ];
    return (
      <div className={styles.reviewList}>
        {reviewRows.map((row) => (
          <div key={row.label} className={styles.reviewRow}>
            <strong>{row.label}</strong>
            <span>{row.value || "확인 필요"}</span>
            <button type="button" onClick={() => goTo(row.step as TutorialStep)}>
              수정 <ChevronRight size={15} />
            </button>
          </div>
        ))}
        <div className={styles.trustNote}>
          <ShieldCheck size={20} />
          <p>AI 제안은 정답이 아니며, 최종 선택은 학생이 직접 해요.</p>
        </div>
      </div>
    );
  };

  return (
    <div className={[styles.page, isOverlay ? styles.overlayPage : "", isEmbedded ? `${styles.overlayPage} ${styles.embeddedPage}` : ""].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        {presentation !== "page" ? (
          <div className={styles.overlayTitle}>
            <span><FlaskConical size={18} aria-hidden="true" /></span>
            <div><strong>프로젝트 빠른 시작</strong><small>진행 내용은 자동 저장돼요</small></div>
          </div>
        ) : (
          <BrandLogo href="/home" compact />
        )}
        <div className="standalone-tutorial-header-actions">
          <div className={styles.headerActions}>
            {step !== "welcome" ? (
              <button
                type="button"
                className={styles.modeChangeButton}
                onClick={() => goTo("welcome")}
              >
                방식 바꾸기
              </button>
            ) : null}
            {presentation !== "page" ? (
              <button
                type="button"
                className={styles.exitLink}
                onClick={closeTutorial}
                aria-label={isEmbedded ? "홈으로 돌아가기" : "프로젝트 빠른 시작 닫기"}
              >
                {isEmbedded ? <ArrowLeft size={19} aria-hidden="true" /> : <X size={19} aria-hidden="true" />}
                {isEmbedded ? "홈으로" : "닫기"}
              </button>
            ) : (
              <Link href="/home" className={styles.exitLink}>{step === "welcome" ? "나가기" : "저장하고 나가기"}</Link>
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

      <div
        ref={topRef}
        className={styles.progressWrap}
        data-service-help="research-progress"
        tabIndex={-1}
        aria-label={step === "welcome" ? "튜토리얼 시작 전" : "프로젝트 조건 준비 진행률"}
      >
        <div className={styles.progressSummary}>
          <div className={styles.progressTrack}>
            <span style={{ width: progress + "%" }} />
          </div>
          <strong>{step === "welcome" ? "시작 전" : completedInputSteps + " / " + totalInputSteps + " 확인"}</strong>
        </div>
        {step !== "welcome" ? (
          <nav className={styles.stepNav} aria-label="프로젝트 설계 단계 바로가기">
            {QUESTION_STEPS.map((item, index) => {
              const current = step === item;
              const answered = item === "review"
                ? QUESTION_STEPS.filter((candidate) => candidate !== "review")
                    .every((candidate) => !issueForStep(candidate, draft))
                : !issueForStep(item, draft);
              return (
                <button
                  type="button"
                  key={item}
                  className={[styles.stepNavItem, current ? styles.stepNavCurrent : "", answered ? styles.stepNavAnswered : ""].filter(Boolean).join(" ")}
                  aria-current={current ? "step" : undefined}
                  onClick={() => goTo(item)}
                >
                  <span>{answered ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
                  {STEP_LABEL[item]}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>

      <TutorialMain className={[
        styles.main,
        step === "welcome" ? styles.mainWelcome : "",
        step === "review" ? styles.mainReview : "",
      ].filter(Boolean).join(" ")}>
        <section className={styles.questionPanel} data-service-help="research-question">
          <div className={styles.heading}>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          {renderStep()}
          {issue ? <p className={styles.issue} role="alert">{issue}</p> : null}
        </section>

        {step !== "welcome" && step !== "review" ? (
          <aside
            className={styles.contextRail}
            aria-label="지금까지 확인한 내용"
            data-service-help="research-context"
          >
            <h2>지금까지 확인한 내용</h2>
            {contextRows.length ? (
              <dl>
                {contextRows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className={styles.contextEmpty}>
                <GraduationCap size={23} />
                <p>답을 고르면 여기에 차곡차곡 정리돼요.</p>
              </div>
            )}
          </aside>
        ) : null}
      </TutorialMain>

      {step !== "welcome" ? (
        <footer className={styles.actions} data-service-help="research-actions">
          <div className={styles.actionGroup}>
            <button type="button" className={styles.secondaryButton} onClick={goBack} disabled={submitting}>
              <ArrowLeft size={18} /> 이전
            </button>
            {step !== "review" ? (
              <button type="button" className={styles.skipButton} onClick={skipToNext} disabled={submitting}>
                나중에 답하기
              </button>
            ) : null}
          </div>
          <p><ShieldCheck size={18} /> 최종 확인 전까지 기존 기록은 바뀌지 않아요.</p>
          {step === "review" ? (
            <button type="button" className={styles.primaryButton} onClick={startCoDesign} disabled={submitting}>
              {submitting ? "공동설계 여는 중…" : "공동설계 시작"} <ArrowRight size={19} />
            </button>
          ) : (
            <button type="button" className={styles.primaryButton} onClick={goNext}>
              다음 질문 <ArrowRight size={19} />
            </button>
          )}
        </footer>
      ) : null}
    </div>
  );
}
