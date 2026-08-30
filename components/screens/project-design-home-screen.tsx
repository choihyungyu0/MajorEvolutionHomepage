"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CircleAlert,
  Database,
  FlaskConical,
  Lightbulb,
  LoaderCircle,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { JourneyStageHero } from "@/components/app/journey-stage-hero";
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  projectDesignHomeAction,
  projectDesignHomeProgress,
} from "@/lib/project-design-home";
import { missingRequired } from "@/lib/recommend";
import { useResearchStore } from "@/store/research-store";
import styles from "./project-design-home-screen.module.css";

export function ProjectDesignHomeScreen() {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const conditions = useResearchStore((state) => state.conditions);
  const ideaMode = useResearchStore((state) => state.ideaMode);
  const answers = useResearchStore((state) => state.coDesignAnswers);
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const projectProfessorMatches = useResearchStore((state) => state.projectProfessorMatches);
  const selectedProjectProfessorId = useResearchStore((state) => state.selectedProjectProfessorId);

  if (!hasHydrated) {
    return <div className="research-loading"><LoaderCircle className="spin" /><p>프로젝트 설계 상태를 불러오고 있어요.</p></div>;
  }

  const hasDraft = Boolean(
    ideaMode
    || conditions.majorArea
    || conditions.major
    || conditions.interests.length
    || conditions.methods.length,
  );
  const hasCompleteSetup = Boolean(ideaMode && missingRequired(conditions).length === 0);
  const hasResult = Boolean(result && result.kind !== "empty");
  const hasSelectedTopic = Boolean(selectedTopicId);
  const hasProjectProfessor = Boolean(
    selectedProjectProfessorId
    && projectProfessorMatches.some((match) => match.professor.id === selectedProjectProfessorId),
  );
  const action = projectDesignHomeAction({
    hasDraft,
    hasCompleteSetup,
    hasResult,
    hasSelectedTopic,
    hasProjectProfessor,
  });
  const progress = projectDesignHomeProgress({
    hasCompleteSetup,
    hasCoDesignAnswers: answers.length >= 5,
    hasResult,
    hasSelectedTopic,
  });
  const candidates = result?.kind === "ok"
    ? result.candidates
    : result?.kind === "insufficient"
      ? [result.candidate]
      : [];
  const selectedCandidate = candidates.find((candidate) => candidate.topic.id === selectedTopicId) ?? null;
  const previewCandidates = selectedCandidate ? [selectedCandidate] : candidates.slice(0, 2);
  const statusSteps = [
    { label: "조건 정리", done: progress.steps.conditions, icon: Settings2 },
    { label: "AI 공동설계", done: progress.steps.coDesign, icon: Sparkles },
    { label: "후보 비교", done: progress.steps.candidates, icon: BookOpenCheck },
    { label: "프로젝트 선택", done: progress.steps.selected, icon: Target },
  ];

  return (
    <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
      <div className={styles.page}>
        <JourneyStageHero
          stage="project"
          eyebrow="프로젝트 실행 · 1단계"
          title="나만의 프로젝트를 설계해 볼까요?"
          description="전공과 관심사를 실행 가능한 질문으로 구체화하고, 근거를 비교해 하나의 프로젝트를 선택합니다."
        >
          <Link className={styles.heroAction} href={action.href}>{action.label} <ArrowRight size={17} /></Link>
        </JourneyStageHero>

        <section className={styles.progressCard} aria-labelledby="project-design-progress-title">
          <header>
            <div><small>현재 설계 진행률</small><h2 id="project-design-progress-title">4단계 중 {progress.completed}단계를 확인했어요</h2></div>
            <strong>{progress.percent}%</strong>
          </header>
          <div className={styles.progressTrack} role="progressbar" aria-label="프로젝트 설계 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <div className={styles.stepGrid}>
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} data-done={step.done}>
                  <span>{step.done ? <Check size={15} /> : <Icon size={16} />}</span>
                  <small>{index + 1}단계</small>
                  <strong>{step.label}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <div className={styles.workspace}>
          <main className={styles.mainColumn}>
            <section className={styles.contextCard} aria-labelledby="project-design-context-title">
              <header><div><small>함께 보고 있는 조건</small><h2 id="project-design-context-title">현재 프로젝트 출발점</h2></div><Link href="/research/conditions?view=review&from=home">조건 수정 <ArrowRight size={15} /></Link></header>
              <dl>
                <div><dt>전공</dt><dd>{conditions.major || "아직 입력 전"}</dd></div>
                <div><dt>관심</dt><dd>{conditions.interests.length ? conditions.interests.join(" · ") : "아직 선택 전"}</dd></div>
                <div><dt>기간</dt><dd>{conditions.period || "아직 선택 전"}</dd></div>
                <div><dt>자료</dt><dd>{conditions.dataAccess || "아직 선택 전"}</dd></div>
              </dl>
            </section>

            <section className={styles.candidateCard} aria-labelledby="project-design-candidate-title">
              <header>
                <div><small>{selectedCandidate ? "선택한 프로젝트" : "최근 프로젝트 후보"}</small><h2 id="project-design-candidate-title">{selectedCandidate ? "이 프로젝트를 기준으로 실행을 이어가요" : "후보를 만들면 여기에서 바로 이어볼 수 있어요"}</h2></div>
                {hasResult ? <Link href={selectedCandidate ? "/result/compare" : "/result"}>근거 보기 <ArrowRight size={15} /></Link> : null}
              </header>
              {previewCandidates.length ? (
                <div className={styles.candidateList}>
                  {previewCandidates.map((candidate) => (
                    <article key={candidate.topic.id} data-selected={candidate.topic.id === selectedTopicId}>
                      <span><FlaskConical size={18} /></span>
                      <div><strong>{candidate.topic.title}</strong><p>{candidate.topic.question}</p></div>
                      {candidate.topic.id === selectedTopicId ? <small>선택됨</small> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyCandidate}><CircleAlert size={21} /><p>조건을 정리한 뒤 AI와 질문을 주고받으면 비교할 후보가 만들어져요.</p></div>
              )}
            </section>
          </main>

          <aside className={styles.nextCard} aria-label="프로젝트 설계 다음 행동">
            <span className={styles.nextIcon}><Lightbulb size={22} /></span>
            <small>지금 이어갈 한 가지</small>
            <h2>{action.label}</h2>
            <p>{action.stage === "conditions"
              ? "저장된 답을 건너뛰고 아직 필요한 조건부터 확인해요."
              : action.stage === "co-design"
                ? "확인한 조건을 바탕으로 AI 맞춤 질문에 답해요."
                : action.stage === "candidates"
                  ? "후보의 데이터·방법·범위를 비교해 하나를 골라요."
                  : action.stage === "selected"
                    ? "선택한 프로젝트의 전체 근거를 확인하고 교수를 연결해요."
                    : "선택한 프로젝트와 자문 교수로 실제 실행을 이어가요."}</p>
            <Link href={action.href}>{action.label} <ArrowRight size={16} /></Link>
            <div className={styles.nextMeta}><CalendarClock size={15} /><span>{conditions.period || "기간 미정"}</span><Database size={15} /><span>{conditions.dataAccess || "자료 미정"}</span></div>
          </aside>
        </div>

        <nav className={styles.utilityLinks} aria-label="프로젝트 설계 바로가기">
          <Link href="/research/tutorial"><Sparkles size={17} /> 단계별 설계 확인 <ArrowRight size={15} /></Link>
          <Link href="/research/conditions?view=review&from=home"><Settings2 size={17} /> 저장 조건 수정 <ArrowRight size={15} /></Link>
          {hasResult ? <Link href="/result"><BookOpenCheck size={17} /> 후보 비교 보기 <ArrowRight size={15} /></Link> : null}
        </nav>
      </div>
    </AppShell>
  );
}
