"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LoaderCircle,
  MessagesSquare,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import {
  AppShell,
  Card,
  PageHeader,
  PrimaryButton,
  ProgressBar,
  StatusBanner,
  Tag,
} from "@/components/app/primitives";
import { useResearchStore } from "@/store/research-store";

const JOURNEY_STEPS = [
  {
    number: 1,
    title: "교수 레이더",
    description: "내 연구주제와 연결되는 교수를 대학 공식 프로필 근거로 찾습니다.",
    icon: SearchCheck,
  },
  {
    number: 2,
    title: "교수 Knock Kit",
    description: "교수의 시간을 존중하도록 60초 소개, 질문 3개, 20분 안건과 이메일을 준비합니다.",
    icon: MessagesSquare,
  },
  {
    number: 3,
    title: "Mentor Loop",
    description: "면담 피드백을 수정 전후안, 수업·연구·진로의 7일 행동과 후속 연락으로 이어갑니다.",
    icon: RefreshCcw,
  },
] as const;

export function ProfessorJourneyScreen() {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const matches = useResearchStore((state) => state.professorMatches);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const knockKitDrafts = useResearchStore((state) => state.knockKitDrafts);
  const mentorLoopEntries = useResearchStore((state) => state.mentorLoopEntries);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장된 교수 연결 여정을 불러오고 있어요.</p>
      </div>
    );
  }

  const key = selectedTopicId && selectedProfessorId
    ? `${selectedTopicId}:${selectedProfessorId}`
    : null;
  const radarComplete = matches.length > 0;
  const knockComplete = Boolean(key && knockKitDrafts[key]);
  const mentorEntry = key ? mentorLoopEntries[key] : null;
  const mentorComplete = Boolean(
    mentorEntry?.feedbackSummary.trim()
    && mentorEntry.after.question.trim()
    && mentorEntry.after.methodDetail.trim()
    && mentorEntry.after.scope.trim(),
  );
  const completed = [radarComplete, knockComplete, mentorComplete];
  const completedCount = completed.filter(Boolean).length;

  const goToStep = (index: number) => {
    if (index === 0) {
      router.push(radarComplete ? "/professors" : result ? "/result" : "/research");
      return;
    }
    if (!radarComplete) {
      router.push(result ? "/result" : "/research");
      return;
    }
    if (index === 1) {
      router.push(selectedProfessorId ? "/quest" : "/professors");
      return;
    }
    router.push(selectedProfessorId ? "/mentor-loop" : "/professors");
  };

  return (
    <AppShell title="교수 연결 여정" backHref="/" className="professor-journey-screen">
      <PageHeader
        title="교수님을 찾는 데서 끝나지 않게"
        description="교수님의 전문성과 학생의 준비를 연결하고, 받은 조언을 수업·연구·진로의 다음 행동으로 돌려드리는 3단계입니다."
      />
      <StatusBanner icon={ShieldCheck} title="서로에게 의미 있는 연결" tone="lavender">
        교수의 우열이나 면담 가능성을 추정하지 않습니다. 공식 근거를 확인하고, 준비한 질문으로 요청하며, 받은 피드백은 약속한 행동으로 이어갑니다.
      </StatusBanner>

      <div className="professor-journey-progress">
        <div>
          <strong>{completedCount} / 3 완료</strong>
          <span>{completedCount === 3 ? "피드백 반영까지 이어졌어요" : "다음 단계가 저장됩니다"}</span>
        </div>
        <ProgressBar value={completedCount} max={3} label={`교수 연결 여정 ${completedCount}/3 완료`} />
      </div>

      <div className="professor-journey-list">
        {JOURNEY_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isComplete = completed[index];
          const isNext = !isComplete && completed.slice(0, index).every(Boolean);
          return (
            <Card className={isComplete ? "professor-journey-step is-complete" : "professor-journey-step"} key={step.title}>
              <div className="professor-journey-step__icon"><Icon size={22} /></div>
              <div className="professor-journey-step__body">
                <div className="professor-journey-step__title">
                  <span>STEP {step.number}</span>
                  <h2>{step.title}</h2>
                  <Tag tone={isComplete ? "mint" : isNext ? "violet" : "neutral"}>
                    {isComplete ? "완료" : isNext ? "다음 행동" : "준비 전"}
                  </Tag>
                </div>
                <p>{step.description}</p>
                <button type="button" onClick={() => goToStep(index)}>
                  {isComplete ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                  {isComplete ? "저장 내용 다시 보기" : index === 0 ? "교수 찾기 시작" : index === 1 ? "면담 준비하기" : "피드백 기록하기"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {completedCount === 0 && (
        <PrimaryButton className="professor-journey-primary" onClick={() => goToStep(0)}>
          연구주제부터 시작하기 <ArrowRight size={18} />
        </PrimaryButton>
      )}
    </AppShell>
  );
}
