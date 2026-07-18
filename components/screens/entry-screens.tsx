"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Circle,
  Compass,
  FileSearch,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppLogo,
  AppShell,
  Card,
  ChoiceCard,
  ChoiceChip,
  PageHeader,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  Tag,
} from "@/components/app/primitives";
import {
  careerOptions,
  cropPath,
  goalOptions,
  interestOptions,
  skillOptions,
  type Goal,
} from "@/data/prototype";
import { requestAiJourney } from "@/lib/ai-client";
import { createFallbackJourney, type AiJourneyResult } from "@/lib/ai-journey";
import { usePrototypeStore } from "@/store/prototype-store";

const goalIcons = [Compass, Lightbulb, GraduationCap, FileSearch];

export function SplashScreen() {
  const router = useRouter();
  const setSampleMode = usePrototypeStore((state) => state.setSampleMode);
  const setDnaStep = usePrototypeStore((state) => state.setDnaStep);

  const start = () => {
    setSampleMode(false);
    setDnaStep(1);
    router.push("/goal");
  };

  const preview = () => {
    setSampleMode(true);
    router.push("/evolution-report");
  };

  const goResearch = () => router.push("/research");

  return (
    <AppShell showHeader={false} className="splash-screen">
      <div className="splash-layout">
        <AppLogo />
        <div className="splash-copy">
          <p className="eyebrow">대학생 AI 연구 여정</p>
          <h1>
            내 전공,<br />
            <span className="gradient-text">AI 먹이면</span> 뭐가 됨?
          </h1>
          <p>전공 고민을 연구 아이디어로, 아이디어를 교수님과 실행계획으로.</p>
        </div>
        <div className="splash-art" aria-hidden="true">
          <Image
            src={`${cropPath}/02_campus_scene_visible.png`}
            alt=""
            width={371}
            height={270}
            priority
            sizes="(max-width: 430px) calc(100vw - 40px), 371px"
          />
        </div>
        <div className="splash-actions">
          <PrimaryButton onClick={start}>전공 진화 시작하기</PrimaryButton>
          <SecondaryButton onClick={preview}>샘플 결과 먼저 보기</SecondaryButton>
          <button type="button" className="splash-mvp-link" onClick={goResearch}>
            <Sparkles size={16} aria-hidden="true" />
            <span>과제용 2화면 추천받기</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
export function GoalScreen() {
  const router = useRouter();
  const goal = usePrototypeStore((state) => state.goal);
  const setGoal = usePrototypeStore((state) => state.setGoal);

  const selectGoal = (value: Goal) => {
    setGoal(value);
  };

  const continueJourney = () => {
    if (goal === "understand-paper") {
      router.push("/paper");
      return;
    }
    if (goal) router.push("/dna");
  };

  return (
    <AppShell
      title="오늘의 목적"
      backHref="/"
      stickyAction={<PrimaryButton disabled={!goal} onClick={continueJourney}>{goal === "understand-paper" ? "논문 이해 시작하기" : "내 전공 DNA 만들기"}</PrimaryButton>}
    >
      <PageHeader
        eyebrow="첫 번째 선택"
        title="오늘 무엇을 해결하고 싶나요?"
        description="목적에 맞춰 질문과 결과를 보여주는 순서를 바꿔드릴게요."
      />
      <div className="goal-list">
        {goalOptions.map((option, index) => (
          <ChoiceCard
            key={option.value}
            title={option.title}
            description={option.description}
            selected={goal === option.value}
            onClick={() => selectGoal(option.value)}
            icon={goalIcons[index]}
          />
        ))}
      </div>
    </AppShell>
  );
}

export function DnaScreen() {
  const router = useRouter();
  const step = usePrototypeStore((state) => state.dnaStep);
  const setStep = usePrototypeStore((state) => state.setDnaStep);
  const profile = usePrototypeStore((state) => state.profile);
  const updateProfile = usePrototypeStore((state) => state.updateProfile);
  const toggleProfileItem = usePrototypeStore((state) => state.toggleProfileItem);
  const setDifficulty = usePrototypeStore((state) => state.setDifficulty);
  const [error, setError] = useState("");

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return {
          title: "어떤 전공을 공부하고 있나요?",
          description: "주전공을 중심으로 서로 다른 관심과 경험을 연결해볼게요.",
          tip: "정확하지 않아도 괜찮아요. 마이에서 언제든 바꿀 수 있어요.",
        };
      case 2:
        return {
          title: "요즘 가장 궁금한 분야는 무엇인가요?",
          description: "현재 관심이 가는 주제를 최대 5개 골라주세요.",
          tip: "지금 눈이 가는 주제부터 편하게 골라보세요.",
        };
      case 3:
        return {
          title: "어떤 진로로 이어가고 싶나요?",
          description: "이번 결과를 어디에 활용하고 싶은지 최대 2개 골라주세요.",
          tip: "아직 확실하지 않아도 방향만 함께 잡아볼게요.",
        };
      case 4:
        return {
          title: "지금 사용할 수 있는 강점을 골라주세요",
          description: "완벽할 필요 없어요. 한 번이라도 써본 기술이면 충분해요.",
          tip: "지금 자신 있는 것만 골라도 충분해요.",
        };
      case 5:
        return {
          title: "해본 프로젝트가 있나요?",
          description: "없어도 괜찮아요. 기억나는 경험을 짧게 적어주세요.",
          tip: "한두 문장이면 충분해요. 없으면 건너뛰어도 돼요.",
        };
      default:
        return {
          title: "이번에는 어느 정도까지 해보고 싶나요?",
          description: "가용 시간과 원하는 결과물을 기준으로 범위를 계산할게요.",
          tip: "범위는 다음 단계에서도 다시 조절할 수 있어요.",
        };
    }
  }, [step]);

  const validate = () => {
    if (step === 1 && !profile.major.trim()) return "주전공을 입력해 주세요.";
    if (step === 2 && profile.interests.length === 0) return "관심 주제를 1개 이상 골라주세요.";
    return "";
  };

  const next = () => {
    const nextError = validate();
    if (nextError) {
      setError(nextError);
      return;
    }
    setError("");
    if (step < 6) setStep(step + 1);
    else router.push("/analyzing");
  };

  const back = () => {
    setError("");
    if (step > 1) setStep(step - 1);
    else router.push("/goal");
  };

  return (
    <AppShell
      className="dna-screen"
      title="나의 전공 DNA 만들기"
      onBack={back}
      step={{ current: step, total: 6 }}
      stickyAction={<PrimaryButton onClick={next}>{step === 6 ? "내 전공 DNA 분석하기" : "다음 질문"}</PrimaryButton>}
    >
      <div className="dna-progress"><ProgressBar value={step} max={6} label={`전공 DNA 입력 ${step}/6`} /></div>
      <PageHeader title={stepContent.title} description={stepContent.description} />
      <Card className="form-card">
        {step === 1 && (
          <div className="form-grid">
            <label className="field-group">
              <span className="field-label">학교 <small>선택</small></span>
              <input className="input" value={profile.school} onChange={(event) => updateProfile({ school: event.target.value })} placeholder="학교 이름" />
            </label>
            <label className="field-group">
              <span className="field-label">주전공 <small>필수</small></span>
              <input className="input" value={profile.major} onChange={(event) => updateProfile({ major: event.target.value })} placeholder="예: 수학" aria-invalid={Boolean(error)} />
            </label>
            <label className="field-group">
              <span className="field-label">부전공 <small>선택</small></span>
              <input className="input" value={profile.minor} onChange={(event) => updateProfile({ minor: event.target.value })} placeholder="예: 식품자원경제" />
            </label>
            <label className="field-group">
              <span className="field-label">학년 <small>선택</small></span>
              <select className="select" value={profile.grade} onChange={(event) => updateProfile({ grade: event.target.value })}>
                {["1학년", "2학년", "3학년", "4학년", "졸업 예정"].map((grade) => <option key={grade}>{grade}</option>)}
              </select>
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="chip-grid">
            {interestOptions.map((item) => (
              <ChoiceChip key={item} selected={profile.interests.includes(item)} onClick={() => toggleProfileItem("interests", item, 5)} disabled={!profile.interests.includes(item) && profile.interests.length >= 5}>
                {item}
              </ChoiceChip>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="chip-grid">
            {careerOptions.map((item) => (
              <ChoiceChip key={item} selected={profile.careers.includes(item)} onClick={() => toggleProfileItem("careers", item, 2)} disabled={!profile.careers.includes(item) && profile.careers.length >= 2}>
                {item}
              </ChoiceChip>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="chip-grid">
            {skillOptions.map((item) => (
              <ChoiceChip key={item} selected={profile.skills.includes(item)} onClick={() => toggleProfileItem("skills", item)}>
                {item}
              </ChoiceChip>
            ))}
          </div>
        )}
        {step === 5 && (
          <div className="field-group">
            <label className="field-label" htmlFor="experience">프로젝트 경험 <small>{profile.experience.length}/160</small></label>
            <textarea
              id="experience"
              className="textarea"
              maxLength={160}
              disabled={profile.noExperience}
              value={profile.noExperience ? "" : profile.experience}
              onChange={(event) => updateProfile({ experience: event.target.value })}
              placeholder="예: 소비자 설문 데이터를 활용해 구매의도를 분석한 팀 프로젝트"
            />
            <label className="checkbox-row">
              <input type="checkbox" checked={profile.noExperience} onChange={(event) => updateProfile({ noExperience: event.target.checked })} />
              경험 없음
            </label>
          </div>
        )}
        {step === 6 && (
          <div className="form-grid">
            <div className="field-group">
              <span className="field-label">가용 시간</span>
              <div className="segmented" style={{ "--segments": 3 } as React.CSSProperties}>
                {[2, 4, 8].map((weeks) => (
                  <button key={weeks} type="button" className={profile.availableWeeks === weeks ? "is-selected" : ""} onClick={() => updateProfile({ availableWeeks: weeks as 2 | 4 | 8 })}>
                    {weeks === 8 ? "8주 이상" : `${weeks}주`}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-group">
              <span className="field-label">원하는 결과물</span>
              <div className="option-list">
                {["포트폴리오 프로젝트", "논문 초안", "서비스 프로토타입", "공모전 제안서"].map((item) => (
                  <button type="button" key={item} className={profile.outputGoal === item ? "is-selected" : ""} onClick={() => updateProfile({ outputGoal: item })}>
                    <span>{item}</span>{profile.outputGoal === item && <Check size={17} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-group">
              <span className="field-label">난이도</span>
              <div className="segmented" style={{ "--segments": 3 } as React.CSSProperties}>
                {(["starter", "project", "advanced"] as const).map((difficulty) => (
                  <button key={difficulty} type="button" className={profile.difficulty === difficulty ? "is-selected" : ""} onClick={() => setDifficulty(difficulty)}>
                    {{ starter: "입문", project: "프로젝트", advanced: "심화" }[difficulty]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {error && <p className="field-error dna-error" role="alert">{error}</p>}
      </Card>
      <div className="input-summary" aria-live="polite">
        {step === 2 && <span>{profile.interests.length}/5 선택</span>}
        {step === 3 && <span>{profile.careers.length}/2 선택</span>}
        {step === 4 && <span>{profile.skills.length}개 선택</span>}
      </div>
      {stepContent.tip && (
        <div className="dna-tip" aria-hidden="true">
          <Image src="/mvp-assets/robot-pose-1.png" alt="" width={64} height={64} />
          <p>{stepContent.tip}</p>
        </div>
      )}
    </AppShell>
  );
}

export function AnalyzingScreen() {
  const router = useRouter();
  const profile = usePrototypeStore((state) => state.profile);
  const goal = usePrototypeStore((state) => state.goal);
  const setAiLoading = usePrototypeStore((state) => state.setAiLoading);
  const setAiJourney = usePrototypeStore((state) => state.setAiJourney);
  const setAiFallback = usePrototypeStore((state) => state.setAiFallback);
  const [activeStep, setActiveStep] = useState(0);
  const [isTakingLonger, setIsTakingLonger] = useState(false);
  const requestRef = useRef<Promise<AiJourneyResult> | null>(null);
  const steps = [
    { ongoing: "전공과 강점을 정리하고 있어요", done: "전공과 강점을 정리했어요" },
    { ongoing: "전공별 AI 활용 방향을 연결하고 있어요", done: "전공별 AI 활용 방향을 연결했어요" },
    {
      ongoing: `${profile.availableWeeks}주 안에 가능한 아이디어 범위를 계산하고 있어요`,
      done: `${profile.availableWeeks}주 안에 가능한 아이디어 범위를 계산했어요`,
    },
  ];

  useEffect(() => {
    const first = window.setTimeout(() => setActiveStep(1), 700);
    const second = window.setTimeout(() => setActiveStep(2), 1450);
    const slow = window.setTimeout(() => setIsTakingLonger(true), 9000);
    return () => [first, second, slow].forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    let active = true;
    setAiLoading();
    if (!requestRef.current) {
      requestRef.current = (async () => {
        const [journey] = await Promise.all([
          requestAiJourney({ profile, goal }),
          new Promise((resolve) => window.setTimeout(resolve, 1800)),
        ]);
        return journey;
      })();
    }

    requestRef.current
      .then((journey) => {
        if (!active) return;
        setAiJourney(journey);
        router.replace("/evolution-report");
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "AI 분석을 완료하지 못했습니다.";
        setAiFallback(createFallbackJourney(), message);
        router.replace("/evolution-report");
      });

    return () => {
      active = false;
    };
  }, [goal, profile, router, setAiFallback, setAiJourney, setAiLoading]);

  return (
    <AppShell showHeader={false} className="analyzing-screen">
      <div className="analyzing-layout">
        <div className="analysis-mascot">
          <span className="analysis-pulse" />
          <Image src="/mvp-assets/robot-pose-2.png" alt="분석 중인 전공진화소 로봇" width={88} height={88} priority />
        </div>
        <div className="analyzing-title">
          <Tag tone="violet">AI 분석 중</Tag>
          <h1>전공의 연결 고리를 찾고 있어요</h1>
          <p>{profile.major || "수학"} × {profile.minor || "관심 분야"} × AI</p>
        </div>
        <div className="analysis-steps" aria-live="polite">
          {steps.map((step, index) => {
            const complete = index < activeStep;
            const current = index === activeStep;
            return (
              <div key={step.ongoing} className={current ? "is-current" : complete ? "is-complete" : ""}>
                <span>{complete ? <Check size={18} /> : current ? <LoaderCircle size={18} className="spin" /> : <Circle size={17} />}</span>
                <p>{complete ? step.done : step.ongoing}</p>
              </div>
            );
          })}
        </div>
        <p className="analysis-trust"><Sparkles size={16} aria-hidden="true" /> {isTakingLonger ? "맞춤 결과를 조금 더 꼼꼼히 구성하고 있어요." : "입력한 정보로 맞춤 결과를 만들어요."}</p>
      </div>
    </AppShell>
  );
}
