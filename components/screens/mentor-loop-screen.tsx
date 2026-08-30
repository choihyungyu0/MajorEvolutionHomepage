"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Download,
  LoaderCircle,
  MessageSquareText,
  PencilRuler,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  AppShell,
  Card,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
} from "@/components/app/primitives";
import type { ResearchTopic } from "@/data/research-mvp";
import type {
  ProfessorMatch,
  ProfessorMentorLoopEntry,
} from "@/lib/professor-domain";
import { hasUnsavedMentorLoopChanges } from "@/lib/mentor-loop-state";
import { resolveJourneyTopic } from "@/lib/research-topic-context";
import { useResearchStore } from "@/store/research-store";

function getSelectedTopic(): ResearchTopic | null {
  const { result, selectedTopicId, professorDiscoveryTopic } = useResearchStore.getState();
  return resolveJourneyTopic({ result, selectedTopicId, professorDiscoveryTopic });
}

type MentorLoopStage = 1 | 2 | 3;

const MENTOR_LOOP_STEPS = [
  { stage: 1 as const, label: "받은 조언", description: "교수님이 강조한 핵심", icon: MessageSquareText },
  { stage: 2 as const, label: "연구 수정", description: "질문·방법·범위 비교", icon: PencilRuler },
  { stage: 3 as const, label: "7일 행동", description: "실행과 다음 약속", icon: CalendarCheck2 },
] as const;

function MentorLoopProgress({
  current,
  onSelect,
}: {
  current: MentorLoopStage;
  onSelect: (stage: MentorLoopStage) => void;
}) {
  return (
    <nav
      className="mentor-loop-progress"
      aria-label="면담 피드백을 행동으로 옮기는 3단계"
      data-service-help="mentor-loop-progress"
    >
      {MENTOR_LOOP_STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <button
            key={step.stage}
            type="button"
            className={current === step.stage ? "is-current" : current > step.stage ? "is-complete" : undefined}
            aria-current={current === step.stage ? "step" : undefined}
            onClick={() => onSelect(step.stage)}
          >
            <span><Icon size={17} aria-hidden="true" /></span>
            <span>
              <small>{step.stage}단계</small>
              <strong>{step.label}</strong>
              <em>{step.description}</em>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function createEntry(topic: ResearchTopic, match: ProfessorMatch): ProfessorMentorLoopEntry {
  return {
    topicId: topic.id,
    professorId: match.professor.id,
    meetingDate: new Date().toISOString().slice(0, 10),
    feedbackSummary: "",
    recommendedResources: "",
    cautionPoint: "",
    commitment: "",
    before: {
      question: topic.question,
      methodDetail: topic.methodDetail,
      scope: topic.scope,
    },
    after: {
      question: topic.question,
      methodDetail: topic.methodDetail,
      scope: topic.scope,
    },
    sevenDayActions: ["", "", ""],
    nextCheckAt: "",
    followUpEmail: "",
    updatedAt: new Date().toISOString(),
  };
}

function buildFollowUpEmail(entry: ProfessorMentorLoopEntry, match: ProfessorMatch, topic: ResearchTopic) {
  const professor = match.professor;
  const nextCheck = entry.nextCheckAt
    ? `\n${entry.nextCheckAt}까지 아래 내용을 실행한 뒤, 가능하시다면 짧게 진행 상황을 다시 여쭙겠습니다.`
    : "";
  return `[면담 감사] ${topic.title} 연구 조언 감사드립니다

${professor.name} ${professor.title}님께,

안녕하세요. ${entry.meetingDate} 면담에서 ${topic.title} 연구에 관해 조언을 받은 학생입니다.

말씀해 주신 핵심은 “${entry.feedbackSummary.trim()}”이라고 정리했습니다.
이를 반영한 수정안은 다음과 같습니다.
- 연구질문: ${entry.after.question.trim()}
- 연구범위: ${entry.after.scope.trim()}

제가 먼저 실행하기로 한 일은 다음과 같습니다.
1. ${entry.sevenDayActions[0]}
2. ${entry.sevenDayActions[1]}
3. ${entry.sevenDayActions[2]}${nextCheck}

귀한 시간과 조언에 감사드립니다.`;
}

function toMarkdown(entry: ProfessorMentorLoopEntry, match: ProfessorMatch, topic: ResearchTopic) {
  return `# 다음 만남 씨앗 - ${topic.title}

- 교수: ${match.professor.name} ${match.professor.title}
- 소속: ${match.professor.university} ${match.professor.department}
- 면담일: ${entry.meetingDate}
- 다음 확인일: ${entry.nextCheckAt || "미정"}

## 받은 피드백

${entry.feedbackSummary}

### 추천 자료

${entry.recommendedResources || "미기록"}

### 주의할 점

${entry.cautionPoint || "미기록"}

### 내가 약속한 일

${entry.commitment}

## 연구안 수정 전후

| 항목 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 연구질문 | ${entry.before.question} | ${entry.after.question} |
| 방법 | ${entry.before.methodDetail} | ${entry.after.methodDetail} |
| 범위 | ${entry.before.scope} | ${entry.after.scope} |

## 7일 행동

${entry.sevenDayActions.map((action, index) => `${index + 1}. ${action}`).join("\n")}

## 후속 이메일 초안

${entry.followUpEmail}
`;
}

function MentorLoopEditor({
  topic,
  match,
  storedEntry,
}: {
  topic: ResearchTopic;
  match: ProfessorMatch;
  storedEntry?: ProfessorMentorLoopEntry;
}) {
  const router = useRouter();
  const key = `${topic.id}:${match.professor.id}`;
  const saveEntry = useResearchStore((state) => state.saveMentorLoopEntry);
  const deleteEntry = useResearchStore((state) => state.deleteMentorLoopEntry);
  const [entry, setEntry] = useState<ProfessorMentorLoopEntry>(
    () => storedEntry ?? createEntry(topic, match),
  );
  const [lastSavedEntry, setLastSavedEntry] = useState<ProfessorMentorLoopEntry | undefined>(
    () => storedEntry,
  );
  const [stage, setStage] = useState<MentorLoopStage>(() => {
    if (!storedEntry?.feedbackSummary.trim()) return 1;
    if (!storedEntry.commitment.trim()) return 2;
    return 3;
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const isDirty = hasUnsavedMentorLoopChanges(entry, lastSavedEntry);
  const hasPendingSavedChanges = Boolean(lastSavedEntry) && isDirty;

  const moveToStage = (nextStage: MentorLoopStage) => {
    if (nextStage > 1 && !entry.feedbackSummary.trim()) {
      setError("교수님이 강조한 핵심 피드백을 먼저 적어 주세요.");
      setStage(1);
      return;
    }
    setError("");
    setStage(nextStage);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-service-help='mentor-loop-stage']")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const updateEntry = (patch: Partial<ProfessorMentorLoopEntry>) => {
    setEntry((current) => ({ ...current, ...patch }));
    setStatus(lastSavedEntry ? "입력 내용이 변경됐어요. 다시 저장해 주세요." : "");
    setError("");
  };

  const updateAfter = (field: keyof ProfessorMentorLoopEntry["after"], value: string) => {
    setEntry((current) => ({
      ...current,
      after: { ...current.after, [field]: value },
    }));
    setStatus(lastSavedEntry ? "입력 내용이 변경됐어요. 다시 저장해 주세요." : "");
    setError("");
  };

  const updateAction = (index: number, value: string) => {
    setEntry((current) => {
      const sevenDayActions = [...current.sevenDayActions] as [string, string, string];
      sevenDayActions[index] = value;
      return { ...current, sevenDayActions };
    });
    setStatus(lastSavedEntry ? "입력 내용이 변경됐어요. 다시 저장해 주세요." : "");
    setError("");
  };

  const saveAndPlan = () => {
    if (!entry.feedbackSummary.trim() || !entry.commitment.trim()) {
      setError("핵심 피드백과 내가 약속한 일을 입력해 주세요.");
      return;
    }
    if (!entry.after.question.trim() || !entry.after.methodDetail.trim() || !entry.after.scope.trim()) {
      setError("수정 후 연구질문·방법·범위를 모두 확인해 주세요.");
      return;
    }
    const actions = entry.sevenDayActions.map((action, index) => {
      if (action.trim()) return action.trim();
      if (index === 0) {
        return entry.recommendedResources.trim()
          ? `1~2일차: ${entry.recommendedResources.trim()} 확인 후 핵심 메모 5개 남기기`
          : "1~2일차: 면담 메모를 다시 읽고 수정 기준 3개 정리하기";
      }
      if (index === 1) return `3~5일차: “${entry.after.scope.trim()}” 범위로 자료·데이터 후보를 다시 점검하기`;
      return `6~7일차: ${entry.commitment.trim()} 실행 결과와 막힌 점을 1쪽으로 정리하기`;
    }) as [string, string, string];
    const withActions = { ...entry, sevenDayActions: actions };
    const next = {
      ...withActions,
      followUpEmail: entry.followUpEmail.trim()
        ? entry.followUpEmail
        : buildFollowUpEmail(withActions, match, topic),
      updatedAt: new Date().toISOString(),
    };
    setEntry(next);
    setLastSavedEntry(next);
    saveEntry(key, next);
    setStage(3);
    setError("");
    setStatus("피드백 반영안과 7일 행동을 이 브라우저에 저장했습니다.");
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(entry.followUpEmail);
      setStatus("후속 이메일 초안을 복사했습니다. 보내기 전에 직접 검토해 주세요.");
    } catch {
      setStatus("자동 복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.");
    }
  };

  const exportMarkdown = () => {
    const blob = new Blob([toMarkdown(entry, match, topic)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mentor-loop-${topic.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("다음 만남 씨앗 기록을 Markdown 파일로 내려받았습니다.");
  };

  const removeCurrentEntry = () => {
    if (!window.confirm("이 교수와 주제의 다음 만남 씨앗 기록을 이 브라우저에서 삭제할까요?")) return;
    deleteEntry(key);
    setEntry(createEntry(topic, match));
    setLastSavedEntry(undefined);
    setStage(1);
    setError("");
    setStatus("저장된 다음 만남 씨앗 기록을 삭제했습니다.");
  };

  return (
    <AppShell title="다음 만남 씨앗" backHref="/quest" className="mentor-loop-screen">
      <PageHeader
        eyebrow="교수님 만남 후"
        title="받은 조언을 다음 행동으로 바꿔요"
        description={`${match.professor.name} ${match.professor.title}님과의 면담 내용을 연구 수정과 다음 약속으로 이어갑니다.`}
      />
      <Card className="mentor-loop-context">
        <div>
          <span>현재 연결</span>
          <strong>{match.professor.name} {match.professor.title}</strong>
          <small>{match.professor.department} · {topic.title}</small>
        </div>
        <p><ShieldCheck size={17} aria-hidden="true" /> 마지막 단계에서 이 브라우저에만 저장돼요.</p>
      </Card>

      <MentorLoopProgress current={stage} onSelect={moveToStage} />

      <section className="mentor-loop-stage" data-service-help="mentor-loop-stage">
        {stage === 1 ? (
          <>
            <SectionHeading title="교수님이 강조한 핵심부터 적어보세요" description="해석을 보태기보다 실제로 들은 표현과 결정 기준을 짧게 남겨요." />
            <Card className="mentor-loop-form">
              <label>
                <span>면담일</span>
                <input type="date" className="input" value={entry.meetingDate} onChange={(event) => updateEntry({ meetingDate: event.target.value })} />
              </label>
              <label>
                <span>핵심 피드백 <small>필수</small></span>
                <textarea className="textarea" value={entry.feedbackSummary} onChange={(event) => updateEntry({ feedbackSummary: event.target.value })} placeholder="예: 질문이 넓으니 비교 대상을 한 학과와 한 학기로 줄이기" />
              </label>
              <details className="mentor-loop-optional">
                <summary>추천 자료와 주의점도 남기기</summary>
                <div>
                  <label>
                    <span>추천받은 자료·논문</span>
                    <textarea className="textarea" value={entry.recommendedResources} onChange={(event) => updateEntry({ recommendedResources: event.target.value })} placeholder="제목이나 찾을 경로만 기록해도 됩니다." />
                  </label>
                  <label>
                    <span>주의할 점</span>
                    <textarea className="textarea" value={entry.cautionPoint} onChange={(event) => updateEntry({ cautionPoint: event.target.value })} placeholder="데이터 한계, 개념 구분, 연구윤리 등" />
                  </label>
                </div>
              </details>
            </Card>
          </>
        ) : null}

        {stage === 2 ? (
          <>
            <SectionHeading title="조언을 반영해 바뀐 문장만 확인해요" description="수정 전 내용은 선택한 주제에서 가져왔어요. 수정 후 문장을 직접 다듬어 주세요." />
            <div className="mentor-loop-compare" role="group" aria-label="연구안 수정 전후 비교">
              {([
                ["question", "연구질문"],
                ["methodDetail", "방법"],
                ["scope", "범위"],
              ] as const).map(([field, label]) => (
                <Card className="mentor-loop-compare__row" key={field}>
                  <div>
                    <span>{label} · 수정 전</span>
                    <p>{entry.before[field]}</p>
                  </div>
                  <label>
                    <span>{label} · 수정 후</span>
                    <textarea className="textarea" value={entry.after[field]} onChange={(event) => updateAfter(field, event.target.value)} />
                  </label>
                </Card>
              ))}
            </div>
          </>
        ) : null}

        {stage === 3 ? (
          <>
            <SectionHeading title="이번 주에 행동으로 답할 일을 정해요" description="약속 한 가지와 7일 행동을 저장하면 감사 이메일 초안도 함께 만들어요." />
            <Card className="mentor-loop-actions">
              <label className="mentor-loop-commitment">
                <span>교수님께 약속한 일 <small>필수</small></span>
                <textarea className="textarea" value={entry.commitment} onChange={(event) => updateEntry({ commitment: event.target.value })} placeholder="예: 금요일까지 변수 정의표와 샘플 20건을 정리하기" />
              </label>
              {entry.sevenDayActions.map((action, index) => (
                <label key={index}>
                  <span>{index + 1}</span>
                  <textarea className="textarea" value={action} onChange={(event) => updateAction(index, event.target.value)} placeholder={`${index + 1}번째 행동`} />
                </label>
              ))}
              <label className="mentor-loop-next-date">
                <span>다시 진행 상황을 확인할 날짜</span>
                <input type="date" className="input" value={entry.nextCheckAt} onChange={(event) => updateEntry({ nextCheckAt: event.target.value })} />
              </label>
            </Card>
          </>
        ) : null}
      </section>

      <div className="mentor-loop-stage-nav" data-service-help="mentor-loop-actions">
        {stage > 1 ? (
          <SecondaryButton onClick={() => moveToStage((stage - 1) as MentorLoopStage)}>
            <ChevronLeft size={17} aria-hidden="true" /> 이전 단계
          </SecondaryButton>
        ) : <span />}
        {stage < 3 ? (
          <PrimaryButton onClick={() => moveToStage((stage + 1) as MentorLoopStage)}>
            다음 단계 <ArrowRight size={17} aria-hidden="true" />
          </PrimaryButton>
        ) : (
          <PrimaryButton className="mentor-loop-save" onClick={saveAndPlan}>
            <RefreshCcw size={18} aria-hidden="true" /> {hasPendingSavedChanges ? "다시 저장하고 7일 계획 업데이트" : "저장하고 7일 계획 만들기"}
          </PrimaryButton>
        )}
      </div>
      {error && <p className="mentor-loop-error" role="alert">{error}</p>}
      {status && <p className="mentor-loop-status" role="status"><CheckCircle2 size={16} /> {status}</p>}
      {hasPendingSavedChanges && <p className="mentor-loop-error" role="status">저장된 내용에서 바뀐 항목이 있어요. 다시 저장해야 홈 진행률과 기록에 반영됩니다.</p>}

      {stage === 3 && entry.followUpEmail ? (
        <details className="mentor-loop-email-disclosure">
          <summary>감사·후속 이메일 초안 보기 <span>{hasPendingSavedChanges ? "재저장 필요" : "저장됨"}</span></summary>
          <Card className="mentor-loop-email">
            <textarea className="textarea" value={entry.followUpEmail} onChange={(event) => updateEntry({ followUpEmail: event.target.value })} aria-label="감사 및 후속 이메일 초안" />
            <div>
              <SecondaryButton onClick={copyEmail}><Copy size={17} /> 이메일 복사</SecondaryButton>
              <SecondaryButton onClick={exportMarkdown}><Download size={17} /> 기록 내보내기</SecondaryButton>
            </div>
          </Card>
        </details>
      ) : null}

      <div className="mentor-loop-footer-actions" data-service-help="mentor-loop-record-tools">
        <button type="button" onClick={removeCurrentEntry}><Trash2 size={16} /> 이 기록 삭제</button>
        <SecondaryButton onClick={() => router.push("/home")}>홈에서 진행률 보기</SecondaryButton>
      </div>
    </AppShell>
  );
}

export function MentorLoopScreen() {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const matches = useResearchStore((state) => state.professorMatches);
  const mentorLoopEntries = useResearchStore((state) => state.mentorLoopEntries);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장된 다음 만남 씨앗를 불러오고 있어요.</p>
      </div>
    );
  }

  const topic = getSelectedTopic();
  const match = matches.find((item) => item.professor.id === selectedProfessorId);
  if (!topic || !match) {
    return (
      <AppShell title="다음 만남 씨앗" backHref="/quest" className="mentor-loop-screen">
        <PageHeader title="먼저 교수와 연구주제를 연결해 주세요" description="나의 교수님과 교수님 퀘스트를 거치면 면담 피드백을 같은 맥락에서 기록할 수 있습니다." />
        <PrimaryButton onClick={() => router.push("/professors")}>
          교수 매칭부터 시작하기 <ArrowRight size={17} />
        </PrimaryButton>
      </AppShell>
    );
  }

  const key = `${topic.id}:${match.professor.id}`;
  return (
    <MentorLoopEditor
      key={key}
      topic={topic}
      match={match}
      storedEntry={mentorLoopEntries[key]}
    />
  );
}
