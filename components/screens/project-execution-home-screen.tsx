"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleAlert,
  ClipboardCheck,
  Database,
  FileCheck2,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  MessageCircleQuestion,
  NotebookPen,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { JourneyStageHero } from "@/components/app/journey-stage-hero";
import { getProjectExecutionProgress } from "@/lib/project-execution";
import { projectEntryRecoveryAction } from "@/lib/project-professor-page";
import { resolveProjectProfessorMatch } from "@/lib/professor-match-state";
import { resolveJourneyTopic } from "@/lib/research-topic-context";
import { useResearchStore } from "@/store/research-store";
import { useProjectExecutionDraft } from "./use-project-execution-draft";
import styles from "./project-execution-screen.module.css";

function EmptyExecutionState({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <section className={styles.emptyState}>
      <CircleAlert size={28} aria-hidden="true" />
      <h1>{title}</h1>
      <p>{description}</p>
      <Link href={href}>{label} <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  );
}

export function ProjectExecutionHomeScreen() {
  const hasResearchHydrated = useResearchStore((state) => state.hasHydrated);
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const projectMatches = useResearchStore((state) => state.projectProfessorMatches);
  const selectedProjectProfessorId = useResearchStore((state) => state.selectedProjectProfessorId);
  const topic = resolveJourneyTopic({ result, selectedTopicId, professorDiscoveryTopic: null });
  const recoveryAction = projectEntryRecoveryAction({
    hasCandidateResult: Boolean(result && result.kind !== "empty"),
    hasSelectedTopic: Boolean(topic),
  });
  const selectedMatch = resolveProjectProfessorMatch({
    projectMatches,
    selectedProjectProfessorId,
  });
  const seed = topic && selectedMatch ? {
    topicId: topic.id,
    professorId: selectedMatch.professor.id,
    topicTitle: topic.title,
    topicQuestion: topic.question,
    methodDetail: topic.methodDetail,
  } : null;
  const {
    draft,
    hasHydrated: hasDraftHydrated,
    updateDraft,
    saveStatus,
    saveError,
  } = useProjectExecutionDraft(seed);

  if (!hasResearchHydrated || !hasDraftHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>프로젝트 실행 상태를 불러오고 있어요.</p>
      </div>
    );
  }

  if (recoveryAction?.state === "missing-result") {
    return (
      <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
        <EmptyExecutionState
          title="실행할 프로젝트가 아직 없어요"
          description="프로젝트 설계 홈에서 문제·방법·범위를 정하면 실행 홈을 만들 수 있어요."
          href={recoveryAction.href}
          label={recoveryAction.label}
        />
      </AppShell>
    );
  }

  if (recoveryAction?.state === "missing-selection") {
    return (
      <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
        <EmptyExecutionState
          title="실행할 프로젝트 후보를 먼저 선택해 주세요"
          description="만들어 둔 후보의 데이터·방법·범위를 비교하고 실행할 하나를 골라 주세요."
          href={recoveryAction.href}
          label={recoveryAction.label}
        />
      </AppShell>
    );
  }

  if (!topic || !selectedMatch || !draft) {
    return (
      <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
        <EmptyExecutionState
          title="프로젝트 자문 교수를 먼저 선택해 주세요"
          description="프로젝트에 필요한 역할과 연결 근거를 확인한 뒤 함께 실행할 교수님을 선택하세요."
          href="/project-professors"
          label="맞춤 교수 추천으로 이동"
        />
      </AppShell>
    );
  }

  const professor = selectedMatch.professor;
  const progress = getProjectExecutionProgress(draft);
  const steps = [
    {
      id: "brief",
      title: "프로젝트 브리프",
      description: "문제·데이터·방법·범위를 다시 확인해요.",
      href: "/result/compare",
      icon: BookOpenCheck,
      done: progress.steps.brief,
    },
    {
      id: "advisory",
      title: "교수 자문 준비",
      description: "결정 목표와 핵심 질문 3개를 준비해요.",
      href: "/project-meeting",
      icon: MessageCircleQuestion,
      done: progress.steps.advisory,
    },
    {
      id: "evidence",
      title: "자료 준비",
      description: "근거·샘플 데이터·결정 쟁점을 챙겨요.",
      href: "/project-meeting#materials",
      icon: FileCheck2,
      done: progress.steps.evidence,
    },
    {
      id: "reflection",
      title: "자문 반영",
      description: "들은 조언을 다음 실행으로 바꿔요.",
      href: "/project-meeting#reflection",
      icon: NotebookPen,
      done: progress.steps.reflection,
    },
  ] as const;

  return (
    <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <Link href="/project-professors"><ArrowLeft size={17} /> 맞춤 교수 추천으로 돌아가기</Link>
        </header>

        <JourneyStageHero
          stage="project"
          eyebrow="프로젝트 실행 홈"
          title="선택한 아이디어를 실제 프로젝트로 옮겨볼까요?"
          description="설계 근거와 자문 교수를 한곳에 두고, 지금 필요한 다음 행동부터 차례로 실행합니다."
        >
          <Link className={styles.heroAction} href="/project-meeting">
            교수 자문 준비하기 <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </JourneyStageHero>

        <section className={styles.contextBand} aria-label="현재 프로젝트와 자문 교수">
          <div className={styles.contextItem}>
            <span><FlaskConical size={20} /></span>
            <div><small>실행 프로젝트</small><strong>{topic.title}</strong><p>{topic.question}</p></div>
          </div>
          <div className={styles.contextDivider} aria-hidden="true" />
          <div className={styles.contextItem}>
            <span><UserRound size={20} /></span>
            <div><small>프로젝트 자문 교수</small><strong>{professor.name} {professor.title}</strong><p>{selectedMatch.mentorFitReason ?? selectedMatch.reason}</p></div>
          </div>
        </section>

        <div className={styles.executionGrid}>
          <main className={styles.executionMain}>
            <section className={styles.progressCard} aria-labelledby="execution-progress-title">
              <header>
                <div><small>실행 준비 현황</small><h2 id="execution-progress-title">4단계 중 {progress.completed}단계를 준비했어요</h2></div>
                <strong>{progress.percent}%</strong>
              </header>
              <div className={styles.progressTrack} role="progressbar" aria-label="프로젝트 실행 준비 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
                <span style={{ width: `${progress.percent}%` }} />
              </div>
              <div className={styles.stepGrid}>
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <Link key={step.id} href={step.href} data-done={step.done}>
                      <span className={styles.stepIcon}>{step.done ? <Check size={17} /> : <Icon size={18} />}</span>
                      <div><small>{index + 1}단계</small><strong>{step.title}</strong><p>{step.description}</p></div>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className={styles.planCard} aria-labelledby="execution-plan-title">
              <header><span><Target size={20} /></span><div><small>오늘의 실행</small><h2 id="execution-plan-title">다음 행동을 한 문장으로 정해 보세요</h2></div></header>
              <textarea
                value={draft.executionPlan}
                maxLength={500}
                onChange={(event) => updateDraft({ executionPlan: event.target.value })}
                placeholder="예: 친환경 표시 문구가 다른 온라인 상품 20개의 가격과 문구 예시를 수집한다."
                aria-label="프로젝트 다음 실행 계획"
              />
              <footer>
                <span role={saveStatus === "error" ? "alert" : "status"}>
                  {saveStatus === "error" ? <CircleAlert size={14} /> : saveStatus === "saved" ? <Check size={14} /> : <ClipboardCheck size={14} />}
                  {saveStatus === "error" ? saveError : saveStatus === "saved" ? "이 브라우저에 저장했어요." : "입력하면 이 브라우저에 저장돼요."}
                </span>
                <small>{draft.executionPlan.length}/500자</small>
              </footer>
            </section>
          </main>

          <aside className={styles.executionRail} aria-label="프로젝트 실행 맥락">
            <section className={styles.mentorCard}>
              <span className={styles.railEyebrow}>선택한 자문 파트너</span>
              <div className={styles.professorIdentity}><span><GraduationCap size={22} /></span><div><strong>{professor.name} {professor.title}</strong><small>{professor.college} · {professor.department}</small></div></div>
              <div className={styles.roleReason}><small>{selectedMatch.role === "TOPIC" ? "연구주제" : selectedMatch.role === "METHOD" ? "연구방법" : "응용·확장"} 자문</small><p>{selectedMatch.mentorFitReason ?? selectedMatch.reason}</p></div>
              <Link href={`/professors/${professor.id}?from=project-execution`}>공식 근거 다시 보기 <ArrowRight size={15} /></Link>
            </section>

            <section className={styles.methodCard}>
              <span className={styles.railEyebrow}>현재 실행 기준</span>
              <dl>
                <div><dt><Database size={15} /> 데이터</dt><dd>{topic.dataOptions.map((item) => item.name).slice(0, 2).join(" · ") || "직접 확인 필요"}</dd></div>
                <div><dt><Lightbulb size={15} /> 방법</dt><dd>{topic.methodDetail}</dd></div>
                <div><dt><ShieldCheck size={15} /> 범위</dt><dd>{topic.scope}</dd></div>
              </dl>
            </section>
          </aside>
        </div>

        <div className={styles.actionDock}>
          <Link className={styles.secondaryAction} href="/project-professors">교수 추천 다시 보기</Link>
          <Link className={styles.primaryAction} href="/project-meeting">프로젝트 자문 준비하기 <ArrowRight size={17} /></Link>
        </div>
      </div>
    </AppShell>
  );
}
