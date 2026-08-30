"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  FileCheck2,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  MessageCircleQuestion,
  NotebookPen,
  Save,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { JourneyStageHero } from "@/components/app/journey-stage-hero";
import {
  getProjectExecutionCurrentStep,
  getProjectExecutionProgress,
  PROJECT_EXECUTION_MATERIALS,
  type ProjectExecutionMaterialId,
} from "@/lib/project-execution";
import { projectEntryRecoveryAction } from "@/lib/project-professor-page";
import { resolveProjectProfessorMatch } from "@/lib/professor-match-state";
import { resolveJourneyTopic } from "@/lib/research-topic-context";
import { useResearchStore } from "@/store/research-store";
import { useProjectExecutionDraft } from "./use-project-execution-draft";
import styles from "./project-execution-screen.module.css";

function EmptyMeetingState({
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
      <Link href={href}>{label} <ArrowRight size={16} /></Link>
    </section>
  );
}

export function ProjectMeetingScreen() {
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
  const [copyStatus, setCopyStatus] = useState("");

  if (!hasResearchHydrated || !hasDraftHydrated) {
    return <div className="research-loading"><LoaderCircle className="spin" /><p>프로젝트 자문 준비를 불러오고 있어요.</p></div>;
  }

  if (recoveryAction?.state === "missing-result") {
    return (
      <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
        <EmptyMeetingState title="자문받을 프로젝트가 없어요" description="프로젝트 설계 홈에서 문제·방법·범위를 먼저 정해 주세요." href={recoveryAction.href} label={recoveryAction.label} />
      </AppShell>
    );
  }

  if (recoveryAction?.state === "missing-selection") {
    return (
      <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
        <EmptyMeetingState title="자문받을 프로젝트 후보를 먼저 선택해 주세요" description="만들어 둔 후보를 비교하고 실행할 하나를 고르면 교수 자문을 준비할 수 있어요." href={recoveryAction.href} label={recoveryAction.label} />
      </AppShell>
    );
  }

  if (!topic || !selectedMatch || !draft) {
    return (
      <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
        <EmptyMeetingState title="프로젝트 자문 교수가 선택되지 않았어요" description="역할별 연결 이유를 비교하고 이 프로젝트에 자문을 구할 교수님을 선택해 주세요." href="/project-professors" label="프로젝트 교수 선택하기" />
      </AppShell>
    );
  }

  const professor = selectedMatch.professor;
  const progress = getProjectExecutionProgress(draft);
  const currentStepIndex = getProjectExecutionCurrentStep(progress.steps);
  const checkedMaterials = PROJECT_EXECUTION_MATERIALS.filter((item) => draft.materials[item.id]);

  const copyBrief = async () => {
    const content = [
      `[프로젝트 자문 준비] ${topic.title}`,
      `자문 교수: ${professor.name} ${professor.title} (${professor.department})`,
      `프로젝트 질문: ${topic.question}`,
      `자문 목표: ${draft.meetingGoal || "아직 작성하지 않음"}`,
      "",
      "핵심 질문",
      ...draft.questions.map((question, index) => `${index + 1}. ${question}`),
      "",
      `준비 자료: ${checkedMaterials.length ? checkedMaterials.map((item) => item.label).join(", ") : "아직 선택하지 않음"}`,
      `자문 후 반영: ${draft.reflection || "면담 후 작성"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("프로젝트 자문 준비 내용을 복사했어요.");
    } catch {
      setCopyStatus("자동 복사가 제한됐어요. 입력 내용을 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <AppShell showHeader={false} className={styles.shell} bottomNav={<ServiceBottomNav />}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <Link href="/project-execution"><ArrowLeft size={17} /> 프로젝트 실행 홈으로 돌아가기</Link>
        </header>

        <JourneyStageHero
          stage="project"
          eyebrow="프로젝트 실행 · 교수 자문"
          title="이 프로젝트의 다음 결정을 교수님께 검증받아 보세요"
          description="첫 인사를 위한 일반 만남이 아니라, 선택한 프로젝트의 질문·데이터·방법·범위를 점검하는 자문 준비 화면입니다."
        />

        <section className={styles.purposeNotice}>
          <span><ShieldCheck size={20} /></span>
          <div><strong>일반 교수 만남과 별도로 저장해요</strong><p>진로·관심 대화 기록은 건드리지 않고, 이 프로젝트와 선택한 자문 교수 조합에만 준비 내용이 남습니다.</p></div>
          <span className={styles.progressPill}>{progress.completed}/4 준비</span>
        </section>

        {saveStatus === "error" ? (
          <section className={styles.purposeNotice} role="alert">
            <span><CircleAlert size={20} /></span>
            <div><strong>현재 편집 내용이 저장되지 않았어요</strong><p>{saveError}</p></div>
          </section>
        ) : null}

        <nav className={styles.localSteps} aria-label="프로젝트 자문 준비 단계">
          {[
            { label: "프로젝트 확인", done: true },
            { label: "자문 목표·질문", done: progress.steps.advisory },
            { label: "자료 준비", done: progress.steps.evidence },
            { label: "자문 반영", done: progress.steps.reflection },
          ].map((step, index) => (
            <span key={step.label} data-done={step.done} aria-current={index === currentStepIndex ? "step" : undefined}>
              <i>{step.done ? <Check size={14} /> : index + 1}</i><strong>{step.label}</strong>
            </span>
          ))}
        </nav>

        <div className={styles.meetingGrid}>
          <main className={styles.formStack}>
            <section className={styles.formCard} aria-labelledby="meeting-goal-title">
              <header><span><Target size={20} /></span><div><small>1. 자문 목적</small><h2 id="meeting-goal-title">이번 만남에서 무엇을 결정할까요?</h2><p>막연한 조언보다, 자문 후 바꾸거나 확정할 한 가지를 적어 보세요.</p></div></header>
              <textarea
                value={draft.meetingGoal}
                maxLength={500}
                onChange={(event) => updateDraft({ meetingGoal: event.target.value })}
                placeholder="예: 텍스트 특성 분류 기준과 20개 제품 표본 범위가 한 학기 프로젝트에 적절한지 결정한다."
                aria-label="프로젝트 자문 목표"
              />
              <div className={styles.fieldFooter}>
                <span role={saveStatus === "error" ? "alert" : "status"}>
                  {saveStatus === "error" ? <><CircleAlert size={14} /> {saveError}</> : saveStatus === "saved" ? <><CheckCircle2 size={14} /> 이 브라우저에 저장했어요.</> : "자문 후 결정할 결과를 적어 주세요."}
                </span>
                <small>{draft.meetingGoal.length}/500자</small>
              </div>
            </section>

            <section className={styles.formCard} aria-labelledby="meeting-questions-title">
              <header><span><MessageCircleQuestion size={20} /></span><div><small>2. 핵심 질문</small><h2 id="meeting-questions-title">학생의 말투로 질문 3개를 다듬어 보세요</h2><p>현재 프로젝트 맥락으로 만든 초안을 그대로 쓰거나 직접 고칠 수 있어요.</p></div></header>
              <div className={styles.questionList}>
                {draft.questions.map((question, index) => (
                  <label key={index}><span>Q{index + 1}</span><textarea value={question} maxLength={400} onChange={(event) => {
                    const next = [...draft.questions] as [string, string, string];
                    next[index] = event.target.value;
                    updateDraft({ questions: next });
                  }} aria-label={`프로젝트 자문 질문 ${index + 1}`} /></label>
                ))}
              </div>
            </section>

            <section id="materials" className={styles.formCard} aria-labelledby="meeting-materials-title">
              <header><span><FileCheck2 size={20} /></span><div><small>3. 가져갈 자료</small><h2 id="meeting-materials-title">교수님이 빠르게 판단할 자료를 챙겨요</h2><p>두 가지 이상 준비하면 자문에서 구체적인 피드백을 받기 쉬워요.</p></div></header>
              <div className={styles.materialList}>
                {PROJECT_EXECUTION_MATERIALS.map((item) => {
                  const checked = draft.materials[item.id];
                  return (
                    <label key={item.id} data-checked={checked}>
                      <input type="checkbox" checked={checked} onChange={() => updateDraft({ materials: { ...draft.materials, [item.id as ProjectExecutionMaterialId]: !checked } })} />
                      <span>{checked ? <Check size={16} /> : null}</span>
                      <div><strong>{item.label}</strong><p>{item.description}</p></div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section id="reflection" className={styles.formCard} aria-labelledby="meeting-reflection-title">
              <header><span><NotebookPen size={20} /></span><div><small>4. 면담 후 반영</small><h2 id="meeting-reflection-title">들은 조언을 프로젝트 변화로 남겨요</h2><p>면담이 끝난 뒤 범위·방법·다음 행동 중 달라진 점을 기록하세요.</p></div></header>
              <textarea
                value={draft.reflection}
                maxLength={1200}
                onChange={(event) => updateDraft({ reflection: event.target.value })}
                placeholder="예: 과장 가능성을 판단하려면 문구만 분류하지 말고 인증 근거 유무를 함께 기록하라는 조언을 반영했다."
                aria-label="프로젝트 자문 반영 기록"
              />
              <div className={styles.fieldFooter}>
                <span role={saveStatus === "error" ? "alert" : "status"}>
                  {saveStatus === "error" ? <><CircleAlert size={14} /> {saveError}</> : saveStatus === "saved" ? <><CheckCircle2 size={14} /> 이 브라우저에 저장했어요.</> : <><Save size={14} /> 입력하면 이 브라우저에 저장돼요.</>}
                </span>
                <small>{draft.reflection.length}/1,200자</small>
              </div>
            </section>
          </main>

          <aside className={styles.meetingRail} aria-label="선택한 프로젝트와 자문 교수">
            <section className={styles.stickyContextCard}>
              <span className={styles.railEyebrow}>함께 보고 있는 프로젝트</span>
              <h2>{topic.title}</h2>
              <p>{topic.question}</p>
              <dl>
                <div><dt><Lightbulb size={14} /> 방법</dt><dd>{topic.methodDetail}</dd></div>
                <div><dt><FlaskConical size={14} /> 범위</dt><dd>{topic.scope}</dd></div>
              </dl>
              <Link href="/result/compare"><BookOpenCheck size={15} /> 선택 근거 다시 보기</Link>
            </section>
            <section className={styles.stickyContextCard}>
              <span className={styles.railEyebrow}>프로젝트 자문 교수</span>
              <div className={styles.professorIdentity}><span><UserRound size={22} /></span><div><strong>{professor.name} {professor.title}</strong><small>{professor.college} · {professor.department}</small></div></div>
              <p>{selectedMatch.mentorFitReason ?? selectedMatch.reason}</p>
              <Link href={`/professors/${professor.id}?from=project-meeting`}><GraduationCap size={15} /> 공식 연구 근거 보기</Link>
            </section>
            <button type="button" className={styles.copyButton} onClick={() => void copyBrief()}><Clipboard size={17} /> 자문 준비 내용 복사하기</button>
            {copyStatus ? <p className={styles.copyStatus} role="status">{copyStatus}</p> : null}
          </aside>
        </div>

        <div className={styles.actionDock}>
          <Link className={styles.secondaryAction} href="/project-execution">실행 홈으로 돌아가기</Link>
          <button type="button" className={styles.primaryAction} onClick={() => void copyBrief()}>자문 준비 내용 복사하기 <Clipboard size={17} /></button>
        </div>
      </div>
    </AppShell>
  );
}
