"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  LoaderCircle,
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
  StatusBanner,
} from "@/components/app/primitives";
import type { ResearchTopic } from "@/data/research-mvp";
import type {
  ProfessorMatch,
  ProfessorMentorLoopEntry,
} from "@/lib/professor-domain";
import { useResearchStore } from "@/store/research-store";

function getSelectedTopic(): ResearchTopic | null {
  const { result, selectedTopicId } = useResearchStore.getState();
  if (!result || !selectedTopicId) return null;
  if (result.kind === "ok") {
    return result.candidates.find((candidate) => candidate.topic.id === selectedTopicId)?.topic ?? null;
  }
  return result.kind === "insufficient" && result.candidate.topic.id === selectedTopicId
    ? result.candidate.topic
    : null;
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
  return `# Mentor Loop - ${topic.title}

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
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const updateEntry = (patch: Partial<ProfessorMentorLoopEntry>) => {
    setEntry((current) => ({ ...current, ...patch }));
    setStatus("");
    setError("");
  };

  const updateAfter = (field: keyof ProfessorMentorLoopEntry["after"], value: string) => {
    setEntry((current) => ({
      ...current,
      after: { ...current.after, [field]: value },
    }));
    setStatus("");
    setError("");
  };

  const updateAction = (index: number, value: string) => {
    setEntry((current) => {
      const sevenDayActions = [...current.sevenDayActions] as [string, string, string];
      sevenDayActions[index] = value;
      return { ...current, sevenDayActions };
    });
    setStatus("");
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
    saveEntry(key, next);
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
    setStatus("Mentor Loop 기록을 Markdown 파일로 내려받았습니다.");
  };

  const removeCurrentEntry = () => {
    if (!window.confirm("이 교수와 주제의 Mentor Loop 기록을 이 브라우저에서 삭제할까요?")) return;
    deleteEntry(key);
    setEntry(createEntry(topic, match));
    setError("");
    setStatus("저장된 Mentor Loop 기록을 삭제했습니다.");
  };

  return (
    <AppShell title="Mentor Loop" backHref="/quest" className="mentor-loop-screen">
      <PageHeader
        title="조언을 받은 뒤, 행동으로 답하세요"
        description={`${match.professor.name} ${match.professor.title}님과의 면담 피드백을 연구 수정과 다음 약속으로 연결합니다.`}
      />
      <StatusBanner icon={ShieldCheck} title="면담 메모는 이 브라우저에만 저장" tone="lavender">
        미공개 연구 아이디어나 개인정보는 필요한 만큼만 적으세요. 자동 전송하지 않으며, 직접 내보내거나 삭제할 수 있습니다.
      </StatusBanner>

      <SectionHeading title="1. 면담에서 받은 피드백" description="해석을 보태기보다 교수님이 강조한 내용을 짧고 구체적으로 적어보세요." />
      <Card className="mentor-loop-form">
        <label>
          <span>면담일</span>
          <input type="date" className="input" value={entry.meetingDate} onChange={(event) => updateEntry({ meetingDate: event.target.value })} />
        </label>
        <label>
          <span>핵심 피드백 <small>필수</small></span>
          <textarea className="textarea" value={entry.feedbackSummary} onChange={(event) => updateEntry({ feedbackSummary: event.target.value })} placeholder="예: 질문이 넓으니 비교 대상을 한 학과와 한 학기로 줄이기" />
        </label>
        <label>
          <span>추천받은 자료·논문</span>
          <textarea className="textarea" value={entry.recommendedResources} onChange={(event) => updateEntry({ recommendedResources: event.target.value })} placeholder="제목이나 찾을 경로만 기록해도 됩니다." />
        </label>
        <label>
          <span>주의할 점</span>
          <textarea className="textarea" value={entry.cautionPoint} onChange={(event) => updateEntry({ cautionPoint: event.target.value })} placeholder="데이터 한계, 개념 구분, 연구윤리 등" />
        </label>
        <label>
          <span>내가 약속한 일 <small>필수</small></span>
          <textarea className="textarea" value={entry.commitment} onChange={(event) => updateEntry({ commitment: event.target.value })} placeholder="예: 금요일까지 변수 정의표와 샘플 20건을 정리하기" />
        </label>
      </Card>

      <SectionHeading title="2. 연구안 수정 전후" description="수정 전 내용은 선택한 연구주제에서 가져왔습니다. 수정 후 문장은 직접 확인해 주세요." />
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

      <SectionHeading title="3. 7일 행동과 다음 확인" description="비어 있는 행동은 저장할 때 입력 내용에 맞춰 초안을 만듭니다." />
      <Card className="mentor-loop-actions">
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

      <PrimaryButton className="mentor-loop-save" onClick={saveAndPlan}>
        <RefreshCcw size={18} /> 저장하고 7일 계획 만들기
      </PrimaryButton>
      {error && <p className="mentor-loop-error" role="alert">{error}</p>}
      {status && <p className="mentor-loop-status" role="status"><CheckCircle2 size={16} /> {status}</p>}

      {entry.followUpEmail && (
        <>
          <SectionHeading title="4. 감사·후속 이메일" description="자동 발송하지 않습니다. 이름과 약속을 확인한 뒤 복사해 사용하세요." />
          <Card className="mentor-loop-email">
            <textarea className="textarea" value={entry.followUpEmail} onChange={(event) => updateEntry({ followUpEmail: event.target.value })} aria-label="감사 및 후속 이메일 초안" />
            <div>
              <SecondaryButton onClick={copyEmail}><Copy size={17} /> 이메일 복사</SecondaryButton>
              <SecondaryButton onClick={exportMarkdown}><Download size={17} /> 기록 내보내기</SecondaryButton>
            </div>
          </Card>
        </>
      )}

      <div className="mentor-loop-footer-actions">
        <button type="button" onClick={removeCurrentEntry}><Trash2 size={16} /> 이 기록 삭제</button>
        <PrimaryButton onClick={() => router.push("/mentoring")}>
          3단계 진행률 보기 <ArrowRight size={17} />
        </PrimaryButton>
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
        <p>저장된 Mentor Loop를 불러오고 있어요.</p>
      </div>
    );
  }

  const topic = getSelectedTopic();
  const match = matches.find((item) => item.professor.id === selectedProfessorId);
  if (!topic || !match) {
    return (
      <AppShell title="Mentor Loop" backHref="/mentoring" className="mentor-loop-screen">
        <PageHeader title="먼저 교수와 연구주제를 연결해 주세요" description="교수 레이더와 Knock Kit를 거치면 면담 피드백을 같은 맥락에서 기록할 수 있습니다." />
        <PrimaryButton onClick={() => router.push("/mentoring")}>
          교수 연결 3단계로 이동 <ArrowRight size={17} />
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
