"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  GraduationCap,
  Mail,
  ShieldCheck,
  Timer,
} from "lucide-react";
import {
  AppShell,
  Card,
  PageHeader,
  PrimaryButton,
  SectionHeading,
  StatusBanner,
  Tag,
} from "@/components/app/primitives";
import type { ResearchTopic } from "@/data/research-mvp";
import type {
  ProfessorKnockKitDraft,
  ProfessorMatch,
} from "@/lib/professor-domain";
import { useResearchStore } from "@/store/research-store";

function selectedTopicFromStore(): ResearchTopic | null {
  const { result, selectedTopicId } = useResearchStore.getState();
  if (!result || !selectedTopicId) return null;
  if (result.kind === "ok") {
    return result.candidates.find((candidate) => candidate.topic.id === selectedTopicId)?.topic ?? null;
  }
  return result.kind === "insufficient" && result.candidate.topic.id === selectedTopicId
    ? result.candidate.topic
    : null;
}

function createDraft(topic: ResearchTopic, match: ProfessorMatch): ProfessorKnockKitDraft {
  const professor = match.professor;
  const field = professor.researchFields[0] ?? "공식 프로필의 연구분야";
  const publicationEvidence = professor.publications.find((publication) =>
    match.evidenceIds.includes(publication.id));
  const readingQuestion = publicationEvidence
    ? `공식 프로필에 소개된 「${publicationEvidence.title}」의 관점을 제 연구질문에 연결할 때 가장 먼저 구분해야 할 개념은 무엇인가요?`
    : "공식 프로필에 논문 목록이 노출되지 않았습니다. 면담 전 읽어야 할 공개 자료나 논문을 한 편 추천해 주실 수 있을까요?";
  const introduction = `안녕하세요. 저는 ${topic.title}을 주제로 작은 연구를 준비하고 있습니다. 현재 연구질문은 “${topic.question}”이며, ${topic.methodDetail} 방식으로 시작하려 합니다. 교수님의 공식 프로필에서 ${field} 연구분야를 확인해 주제의 범위와 방법을 점검받고 싶어 찾아뵙고자 합니다.`;
  return {
    topicId: topic.id,
    professorId: professor.id,
    introduction,
    questions: [
      `${field} 관점에서 “${topic.question}”의 범위를 더 명확하게 줄이려면 무엇을 먼저 구분해야 할까요?`,
      `${topic.methodDetail}을 적용할 때 학부생이 가장 먼저 확인해야 할 데이터·방법상의 오류는 무엇인가요?`,
      readingQuestion,
    ],
    agenda: "0~3분: 학생·주제 소개\n3~8분: 연구질문과 범위 확인\n8~14분: 데이터·방법 점검\n14~18분: 먼저 읽을 자료와 다음 행동 확인\n18~20분: 제가 할 일과 후속 확인 시점 정리",
    emailDraft: `[면담 요청] ${topic.title} 연구주제 관련 조언을 부탁드립니다\n\n${professor.name} ${professor.title}님께,\n\n안녕하세요. ${topic.title}을 주제로 학부 연구를 준비하고 있는 학생입니다.\n교수님의 대학 공식 프로필에서 ${field} 연구분야를 확인하고, 제 연구질문과 방법을 더 정확히 다듬기 위해 조언을 부탁드리고자 합니다.\n\n현재 질문: ${topic.question}\n준비한 내용: ${topic.methodDetail}\n면담에서 확인하고 싶은 점: 연구범위, 데이터·방법, 먼저 읽을 공개 자료\n\n가능하시다면 20분 정도 면담을 요청드려도 될지 여쭙습니다. 교수님의 가능한 방식과 시간을 따르겠습니다.\n\n감사합니다.`,
    updatedAt: new Date().toISOString(),
  };
}

export function OfficialKnockKitScreen({
  topic,
  match,
}: {
  topic: ResearchTopic;
  match: ProfessorMatch;
}) {
  const router = useRouter();
  const key = `${topic.id}:${match.professor.id}`;
  const storedDraft = useResearchStore((state) => state.knockKitDrafts[key]);
  const saveDraft = useResearchStore((state) => state.saveKnockKitDraft);
  const generatedDraft = useMemo(() => createDraft(topic, match), [topic, match]);
  const draft = storedDraft ?? generatedDraft;
  const [copyStatus, setCopyStatus] = useState("");
  const professor = match.professor;
  const publicationEvidence = professor.publications.find((publication) =>
    match.evidenceIds.includes(publication.id));

  const updateDraft = (patch: Partial<ProfessorKnockKitDraft>) => {
    saveDraft(key, { ...draft, ...patch, updatedAt: new Date().toISOString() });
  };

  useEffect(() => {
    if (!storedDraft) saveDraft(key, generatedDraft);
  }, [generatedDraft, key, saveDraft, storedDraft]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(draft.emailDraft);
      setCopyStatus("이메일 초안을 복사했습니다. 보내기 전에 직접 검토해 주세요.");
    } catch {
      setCopyStatus("자동 복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <AppShell
      title="교수 Knock Kit"
      backHref={`/professors/${professor.id}`}
      stickyAction={(
        <PrimaryButton onClick={() => router.push("/mentor-loop")}>
          면담 후 피드백 기록 <ArrowRight size={17} />
        </PrimaryButton>
      )}
    >
      <PageHeader
        eyebrow={`${professor.name} ${professor.title} · ${professor.university}`}
        title="준비된 상태로 면담을 요청하세요"
        description="공식 프로필 근거와 선택한 연구주제를 바탕으로 소개·질문·안건·이메일을 한곳에서 준비합니다."
      />
      <StatusBanner icon={ShieldCheck} title="자동 발송하지 않습니다" tone="lavender">
        이메일과 질문은 초안입니다. 사용자가 검토한 뒤 복사하거나 대학 공식 페이지를 직접 엽니다.
      </StatusBanner>

      <SectionHeading title="왜 이 교수인지" />
      <Card className="knock-kit-reason">
        <Tag tone={match.strength === "LIMITED" ? "warning" : "mint"}>{match.role}</Tag>
        <p>{match.reason}</p>
        <small>근거 ID: {match.evidenceIds.join(" · ")}</small>
      </Card>

      <SectionHeading title="먼저 읽을 공식 자료" />
      {publicationEvidence ? (
        <Card className="knock-kit-reading">
          <BookOpenCheck size={20} />
          <div>
            <h3>{publicationEvidence.title}</h3>
            <p>{publicationEvidence.publicationType} · {publicationEvidence.publishedDate ?? "발행일 미기재"}</p>
            <small>이 제목과 서지정보는 대학 공식 프로필 노출 목록에서만 가져왔습니다. 원문 내용을 읽었다고 간주하지 않습니다.</small>
          </div>
        </Card>
      ) : (
        <StatusBanner icon={BookOpenCheck} title="공식 프로필 논문 근거 없음" tone="warning">
          {professor.publicationsStatus === "NOT_LISTED_ON_OFFICIAL_PROFILE"
            ? "공식 프로필에 논문 목록이 노출되지 않았습니다. 면담 질문으로 먼저 읽을 공개 자료를 요청하도록 구성했습니다."
            : "선택 주제와 제목 수준에서 연결되는 공식 프로필 논문을 찾지 못했습니다. 관련성을 추정해 제시하지 않습니다."}
        </StatusBanner>
      )}

      <SectionHeading title="60초 자기소개" />
      <textarea
        className="textarea knock-kit-textarea"
        value={draft.introduction}
        onChange={(event) => updateDraft({ introduction: event.target.value })}
        aria-label="60초 자기소개"
      />

      <SectionHeading title="검색으로 해결하기 어려운 질문 3개" />
      <div className="knock-kit-questions">
        {draft.questions.map((question, index) => (
          <label key={index}>
            <span>{index + 1}</span>
            <textarea
              className="textarea"
              value={question}
              onChange={(event) => {
                const questions = [...draft.questions] as [string, string, string];
                questions[index] = event.target.value;
                updateDraft({ questions });
              }}
              aria-label={`교수 면담 질문 ${index + 1}`}
            />
          </label>
        ))}
      </div>

      <SectionHeading title="20분 면담 안건" />
      <Card className="knock-kit-agenda">
        <Timer size={20} />
        <textarea
          className="textarea"
          value={draft.agenda}
          onChange={(event) => updateDraft({ agenda: event.target.value })}
          aria-label="20분 면담 안건"
        />
      </Card>

      <SectionHeading title="면담 요청 이메일" />
      <Card className="knock-kit-email">
        <div className="knock-kit-email__head">
          <span><Mail size={18} /> 검토 가능한 초안</span>
          <button type="button" onClick={copyEmail}><Copy size={16} /> 복사</button>
        </div>
        <textarea
          className="textarea"
          value={draft.emailDraft}
          onChange={(event) => updateDraft({ emailDraft: event.target.value })}
          aria-label="면담 요청 이메일 초안"
        />
        {copyStatus && <p role="status">{copyStatus}</p>}
      </Card>

      <SectionHeading title="연구예절 체크리스트" />
      <Card className="knock-kit-etiquette">
        {[
          "공식 프로필과 공개 자료를 먼저 확인했다.",
          "20분 안에 답할 수 있는 질문 3개만 준비했다.",
          "교수의 면담·지도 가능성을 당연하게 전제하지 않는다.",
          "미공개 아이디어나 면담 메모를 허락 없이 공유하지 않는다.",
          "면담 후 감사와 내가 하기로 한 일을 짧게 정리한다.",
        ].map((item) => (
          <p key={item}><CheckCircle2 size={17} /> {item}</p>
        ))}
      </Card>

      <div className="official-source-actions">
        <Link href={professor.officialProfileUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={17} /> 대학 공식 프로필에서 최신 정보 확인
        </Link>
      </div>
      <p className="knock-kit-saved">
        <GraduationCap size={15} /> 수정 내용은 이 브라우저에 저장됩니다.
      </p>
    </AppShell>
  );
}

export function getOfficialQuestContext(): { topic: ResearchTopic; match: ProfessorMatch } | null {
  const state = useResearchStore.getState();
  const topic = selectedTopicFromStore();
  const match = state.professorMatches.find(
    (item) => item.professor.id === state.selectedProfessorId,
  );
  return topic && match ? { topic, match } : null;
}
