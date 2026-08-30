"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BookOpenCheck, Check, CircleAlert, CircleCheck,
  Database, FlaskConical, GraduationCap, Lightbulb, LoaderCircle,
  MessageCircleMore, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { AppShell, PrimaryButton, SecondaryButton } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { JourneyStageHero } from "@/components/app/journey-stage-hero";
import {
  buildProjectProfessorRoleSlots,
  projectProfessorNextAction,
  projectProfessorPagePresentation,
  projectProfessorSelectionButton,
  type ProjectProfessorStepState,
} from "@/lib/project-professor-page";
import type { ProfessorMatch, ProfessorMatchRole } from "@/lib/professor-domain";
import type { TopicWithChecks } from "@/lib/recommend";
import { useResearchStore } from "@/store/research-store";
import styles from "./project-professor-hub-screen.module.css";

const ROLE_ICON: Record<ProfessorMatchRole, typeof Lightbulb> = {
  TOPIC: Lightbulb,
  METHOD: Database,
  CONTEXT: Sparkles,
};

const STRENGTH_LABEL = {
  DIRECT: "직접 근거",
  RELATED: "연관 근거",
  LIMITED: "추가 확인 필요",
} as const;

function findSelectedTopic(
  result: ReturnType<typeof useResearchStore.getState>["result"],
  selectedTopicId: string | null,
): TopicWithChecks | null {
  if (!result || !selectedTopicId || result.kind === "empty") return null;
  if (result.kind === "insufficient") return result.candidate.topic.id === selectedTopicId ? result.candidate : null;
  return result.candidates.find((candidate) => candidate.topic.id === selectedTopicId) ?? null;
}

function ProjectSteps({ states }: { states: readonly ProjectProfessorStepState[] }) {
  const steps = [
    { href: "/result", label: "후보 선택", state: states[0] },
    { href: "/result/compare", label: "근거 확인", state: states[1] },
    { href: "/project-professors", label: "교수 연결", state: states[2] },
  ] as const;
  return (
    <nav className={styles.steps} aria-label="프로젝트 설계 진행 단계">
      {steps.map((step, index) => {
        const content = <><span>{index + 1}</span><strong>{step.label}</strong>{step.state === "complete" ? <Check size={15} /> : null}</>;
        return step.state === "complete" ? (
          <Link key={step.label} href={step.href} data-complete="true">{content}</Link>
        ) : (
          <span
            key={step.label}
            className={step.state === "current" ? styles.currentStep : step.state === "error" ? styles.errorStep : undefined}
            aria-current={step.state === "current" || step.state === "error" ? "step" : undefined}
            data-state={step.state}
          >
            {content}
          </span>
        );
      })}
    </nav>
  );
}

function ProfessorRoleCard({ slot, selected, onSelect }: {
  slot: ReturnType<typeof buildProjectProfessorRoleSlots>[number];
  selected: boolean;
  onSelect: (match: ProfessorMatch) => void;
}) {
  const Icon = ROLE_ICON[slot.role];
  const match = slot.match;

  if (!match) {
    return (
      <article className={`${styles.professorCard} ${styles.emptyProfessorCard}`}>
        <header className={styles.roleHeader}>
          <span className={styles.roleIcon}><Icon size={20} /></span>
          <div><small>{slot.focus}</small><h3>{slot.label}</h3></div>
        </header>
        <div className={styles.emptyCopy}>
          <CircleAlert size={20} /><strong>공식 근거 후보를 찾지 못했어요</strong>
          <p>선택한 프로젝트의 조건과 범위를 다시 확인하면 이 역할의 후보가 달라질 수 있어요.</p>
        </div>
        <Link href="/result/compare">상세 근거 다시 확인 <ArrowRight size={15} /></Link>
      </article>
    );
  }

  const officialConcepts = Array.from(new Set([
    ...match.decisionBasis.matchedConcepts,
    ...match.matchedTerms,
  ])).slice(0, 5);
  const selectionButton = projectProfessorSelectionButton(selected);

  return (
    <article className={styles.professorCard} data-role={slot.role.toLowerCase()} data-selected={selected}>
      <header className={styles.roleHeader}>
        <span className={styles.roleIcon}><Icon size={20} /></span>
        <div><small>{slot.focus}</small><h3>{slot.label}</h3></div>
        <span className={styles.evidenceStrength} data-strength={match.strength.toLowerCase()}>{STRENGTH_LABEL[match.strength]}</span>
      </header>

      <div className={styles.professorIdentity}>
        <span><UserRound size={22} /></span>
        <div><strong>{match.professor.name} {match.professor.title}</strong><small>{match.professor.college} · {match.professor.department}</small></div>
      </div>

      <section className={styles.reasonBlock}>
        <small>왜 이 프로젝트와 연결되나요?</small>
        <p>{match.mentorFitReason ?? match.reason}</p>
      </section>

      <section className={styles.evidenceBlock}>
        <small>왜 추천하나요?</small>
        <p>{slot.label} 역할로 연결할 공식 근거가 있어요. 중심 확인 항목은 <strong>{slot.focus}</strong>입니다.</p>
        {officialConcepts.length ? (
          <div className={styles.evidenceTags} aria-label={`${match.professor.name} 교수 공식 연결 근거`}>
            {officialConcepts.map((concept) => <span key={concept}>{concept}</span>)}
          </div>
        ) : <p className={styles.missingEvidence}>공식 프로필의 세부 연결 용어를 추가로 확인해야 해요.</p>}
      </section>

      <section className={styles.consultationBlock}>
        <MessageCircleMore size={18} />
        <div><small>왜 자문을 구하나요?</small><p>{slot.consultation}</p></div>
      </section>

      <footer className={styles.cardActions}>
        <Link href={`/professors/${match.professor.id}?from=project`}><BookOpenCheck size={16} /> 공식 근거 보기</Link>
        <button
          type="button"
          data-selected={selected}
          aria-pressed={selected}
          disabled={selectionButton.disabled}
          onClick={() => {
            if (!selectionButton.disabled) onSelect(match);
          }}
        >
          {selected ? <CircleCheck size={16} /> : <ArrowRight size={16} />}
          {selectionButton.label}
        </button>
      </footer>
    </article>
  );
}

function EmptyState({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return (
    <section className={styles.emptyState} data-service-help="project-primary">
      <GraduationCap size={28} /><h2>{title}</h2><p>{description}</p>
      <Link href={href}>{label} <ArrowRight size={16} /></Link>
    </section>
  );
}

export function ProjectProfessorHubScreen() {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const professorMatches = useResearchStore((state) => state.projectProfessorMatches);
  const professorCoverage = useResearchStore((state) => state.projectProfessorCoverage);
  const professorMatchTopicId = useResearchStore((state) => state.projectProfessorMatchTopicId);
  const professorMatchStatus = useResearchStore((state) => state.projectProfessorMatchStatus);
  const professorMatchError = useResearchStore((state) => state.projectProfessorMatchError);
  const selectedProfessorId = useResearchStore((state) => state.selectedProjectProfessorId);
  const selectProfessor = useResearchStore((state) => state.selectProjectProfessor);

  if (!hasHydrated) return <div className="research-loading"><LoaderCircle className="spin" /><p>프로젝트 교수 추천을 불러오고 있어요.</p></div>;

  const selectedTopic = findSelectedTopic(result, selectedTopicId);
  const hasCandidateResult = Boolean(result && result.kind !== "empty");
  const hasCurrentProjectMatches = professorMatchTopicId === selectedTopicId;
  const projectMatches = hasCurrentProjectMatches && professorCoverage ? professorMatches : [];
  const slots = buildProjectProfessorRoleSlots(projectMatches);
  const selectedProjectMatch = projectMatches.find((match) => match.professor.id === selectedProfessorId) ?? null;
  const nextAction = projectProfessorNextAction(selectedProjectMatch?.professor.id ?? null);
  const presentation = projectProfessorPagePresentation({
    hasResult: hasCandidateResult,
    hasSelectedTopic: Boolean(selectedTopic),
    matchStatus: professorMatchStatus,
    hasMatches: projectMatches.length > 0,
  });

  return (
    <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <Link href="/result/compare"><ArrowLeft size={17} /> 상세 근거로 돌아가기</Link>
        </header>

        <JourneyStageHero
          stage="recommend"
          eyebrow={presentation.eyebrow}
          title={presentation.title}
          description={presentation.description}
        />

        <ProjectSteps states={presentation.steps} />

        {!hasCandidateResult ? (
          <EmptyState title="설계한 프로젝트가 아직 없어요" description="프로젝트의 문제·방법·범위를 먼저 정하면 역할별 교수 연결이 이어져요." href="/research" label="프로젝트 설계 시작하기" />
        ) : !selectedTopic ? (
          <EmptyState title="프로젝트 후보를 선택해 주세요" description="후보를 선택하고 상세 근거를 확인한 뒤 프로젝트 자문 교수를 연결할 수 있어요." href="/result" label="후보 선택하기" />
        ) : professorMatchStatus === "loading" ? (
          <EmptyState title="공식 후보 안에서 프로젝트 자문 교수를 찾고 있어요" description="연구주제·방법·응용 확장 역할을 나눠 근거를 확인하고 있습니다. 완료되면 이 화면에 바로 표시돼요." href="/result/compare" label="상세 근거로 돌아가기" />
        ) : professorMatchStatus === "error" ? (
          <EmptyState title="교수 추천을 완료하지 못했어요" description={professorMatchError ?? "상세 근거 화면에서 다시 연결해 주세요."} href="/result/compare" label="다시 연결하기" />
        ) : !projectMatches.length ? (
          <EmptyState title="교수 추천을 준비하지 못했어요" description="상세 근거 화면에서 선택 후보를 확인하고 교수 연결을 다시 시작해 주세요." href="/result/compare" label="상세 근거 확인하기" />
        ) : (
          <>
            <section className={styles.projectSummary} aria-labelledby="selected-project-title" data-service-help="project-summary">
              <div className={styles.projectSummaryIcon}><FlaskConical size={24} /></div>
              <div className={styles.projectSummaryCopy}>
                <small>선택한 프로젝트</small><h2 id="selected-project-title">{selectedTopic.topic.title}</h2><p>{selectedTopic.topic.question}</p>
                <div className={styles.projectFacts}>
                  <span><Database size={14} /><small>데이터</small><strong>{selectedTopic.topic.dataOptions.map((item) => item.name).slice(0, 2).join(" · ")}</strong></span>
                  <span><FlaskConical size={14} /><small>방법</small><strong>{selectedTopic.topic.methodDetail}</strong></span>
                  <span><ShieldCheck size={14} /><small>범위</small><strong>{selectedTopic.topic.scope}</strong></span>
                </div>
              </div>
              <Link href="/result/compare">상세 근거 다시 보기 <ArrowRight size={15} /></Link>
            </section>

            <section className={styles.recommendationIntro}>
              <div><Sparkles size={20} /><span>공식 근거 기반 역할별 연결</span></div>
              <p>교수의 우열을 정하지 않고, 같은 프로젝트에 필요한 서로 다른 자문 목적을 나눠 보여줍니다.</p>
              <strong>{projectMatches.length}명 · {professorCoverage?.officialRecordCount ?? 0}명 공식 레코드 범위</strong>
            </section>

            <section className={styles.recommendations} aria-labelledby="project-professor-title">
              <header><div><small>프로젝트 실행 자문</small><h2 id="project-professor-title">어떤 도움을 받을지 보고 교수님을 선택하세요</h2></div><span>한 명을 선택하면 프로젝트 실행 홈으로 이어집니다</span></header>
              <div className={styles.professorGrid}>
                {slots.map((slot) => <ProfessorRoleCard key={slot.role} slot={slot} selected={slot.match?.professor.id === selectedProjectMatch?.professor.id} onSelect={(match) => selectProfessor(match.professor.id)} />)}
              </div>
            </section>

            <details className={styles.trustDetails} data-service-help="recommendation-criteria">
              <summary><ShieldCheck size={17} /> 추천 기준과 확인 범위</summary>
              <div><p>교수 이름·소속·연구분야·논문은 대학 공식 프로필에 확인된 범위만 사용합니다.</p><p>프로젝트 연결 이유는 역할별 자문 근거이며 교수의 면담 가능 여부를 나타내지 않습니다.</p></div>
            </details>

            <div className={styles.actionDock} data-service-help="project-primary">
              <SecondaryButton onClick={() => router.push("/result/compare")}>상세 근거로 돌아가기</SecondaryButton>
              <PrimaryButton disabled={nextAction.disabled} onClick={() => nextAction.href && router.push(nextAction.href)}>{nextAction.label} {!nextAction.disabled ? <ArrowRight size={17} /> : null}</PrimaryButton>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
