"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Handshake,
  Home,
  Mail,
  Sparkles,
  Timer,
} from "lucide-react";
import {
  AppShell,
  Card,
  LinkButton,
  PageHeader,
  SectionHeading,
  Tag,
} from "@/components/app/primitives";
import { SceneBanner } from "@/components/app/scene-banner";
import { PaperReadingSteps } from "@/components/paper-reader/paper-reading-steps";
import type { ResearchTopic } from "@/data/research-mvp";
import { brandScene } from "@/lib/brand-assets";
import {
  buildEmailDraft,
  EMAIL_DRAFT_PURPOSE_OPTIONS,
  emailGuardStickyActions,
  emailDraftStorageKey,
  emailPurposeFromFirstLineTitle,
  FIRST_QUESTION_FROM_PAPER_HREF,
  firstQuestionForEmail,
  MINI_TOOL_SHUFFLE_HREF,
  MINI_TOOLS_HREF,
  paperTitleForProfessor,
  type EmailDraftPurpose,
} from "@/lib/email-draft-purpose";
import type {
  ProfessorKnockKitDraft,
  ProfessorMatch,
} from "@/lib/professor-domain";
import {
  createProfessorPaperQuestTopic,
  resolveJourneyTopic,
} from "@/lib/research-topic-context";
import { resolveQuestProfessorContextMatch } from "@/lib/professor-match-state";
import { useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";

function selectedTopicFromStore(source: "student" | "project" = "student"): ResearchTopic | null {
  const { result, selectedTopicId, professorDiscoveryTopic } = useResearchStore.getState();
  return resolveJourneyTopic({
    result,
    selectedTopicId,
    professorDiscoveryTopic: source === "student" ? professorDiscoveryTopic : null,
  });
}

const PURPOSE_ICONS = {
  career: GraduationCap,
  "research-interest": BookOpenCheck,
  "project-review": FlaskConical,
  mentoring: Handshake,
} as const;
const [HOME_ACTION, FEEDBACK_ACTION] = emailGuardStickyActions();

export function OfficialKnockKitScreen({
  topic,
  match,
  journeySource = null,
}: {
  topic: ResearchTopic;
  match: ProfessorMatch;
  journeySource?: "paper" | "paper-first-line" | "first-line" | null;
}) {
  const professor = match.professor;
  const hasSelectedProject = useResearchStore((state) => Boolean(state.selectedTopicId));
  const selectedProfessorPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const questCards = useQuestStore((state) => state.cards);
  const saveDraft = useResearchStore((state) => state.saveKnockKitDraft);
  const firstLineCard = questCards.find((card) => (
    card.tool === "first-line"
    && card.professorId === professor.id
    && card.topicId === topic.id
  ));
  const firstLine = firstLineCard
    ? firstQuestionForEmail(firstLineCard.body, firstLineCard.title)
    : "";
  const [purpose, setPurpose] = useState<EmailDraftPurpose>(
    () => (journeySource === "first-line" || journeySource === "paper-first-line") && firstLineCard
      ? emailPurposeFromFirstLineTitle(firstLineCard.title) ?? (hasSelectedProject ? "project-review" : "career")
      : hasSelectedProject ? "project-review" : "career",
  );
  const [includePaper, setIncludePaper] = useState(false);
  const [includeFirstLine, setIncludeFirstLine] = useState(
    () => (journeySource === "first-line" || journeySource === "paper-first-line") && Boolean(firstLine),
  );
  const [firstLineApplied, setFirstLineApplied] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const paperTitle = paperTitleForProfessor(selectedProfessorPaper, professor.id);
  const key = emailDraftStorageKey(
    topic.id,
    professor.id,
    purpose,
    includePaper,
    includeFirstLine && Boolean(firstLine),
  );
  const legacyKey = `${topic.id}:${professor.id}`;
  const preFirstLineKey = `${topic.id}:${professor.id}:email:${purpose}:${includePaper ? "paper" : "no-paper"}`;
  const storedDraft = useResearchStore((state) => state.knockKitDrafts[key]);
  const preFirstLineDraft = useResearchStore((state) => state.knockKitDrafts[preFirstLineKey]);
  const legacyDraft = useResearchStore((state) => state.knockKitDrafts[legacyKey]);
  const researchField = professor.researchFields[0] ?? "공식 프로필의 연구분야";
  const generatedDraft = useMemo(() => buildEmailDraft({
    purpose,
    includePaper: includePaper && Boolean(paperTitle),
    includeFirstLine: includeFirstLine && Boolean(firstLine),
    topicId: topic.id,
    topicTitle: topic.title,
    topicQuestion: topic.question,
    methodDetail: topic.methodDetail,
    professorId: professor.id,
    professorName: professor.name,
    professorTitle: professor.title,
    researchField,
    paperTitle,
    firstLine,
  }), [
    firstLine,
    includeFirstLine,
    includePaper,
    paperTitle,
    professor.id,
    professor.name,
    professor.title,
    purpose,
    researchField,
    topic.id,
    topic.methodDetail,
    topic.question,
    topic.title,
  ]);
  const reusableLegacyDraft = !includeFirstLine
    ? preFirstLineDraft ?? (purpose === "project-review" && !includePaper ? legacyDraft : undefined)
    : undefined;
  const draft = storedDraft ?? reusableLegacyDraft ?? generatedDraft;

  const updateDraft = (patch: Partial<ProfessorKnockKitDraft>) => {
    saveDraft(key, { ...draft, ...patch, updatedAt: new Date().toISOString() });
  };

  useEffect(() => {
    if (!storedDraft) saveDraft(key, draft);
  }, [draft, key, saveDraft, storedDraft]);

  useEffect(() => {
    if (
      (journeySource !== "first-line" && journeySource !== "paper-first-line")
      || !firstLineCard
      || firstLineApplied
    ) return;
    setPurpose(emailPurposeFromFirstLineTitle(firstLineCard.title) ?? (hasSelectedProject ? "project-review" : "career"));
    setIncludeFirstLine(true);
    setFirstLineApplied(true);
  }, [firstLineApplied, firstLineCard, hasSelectedProject, journeySource]);

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
      title="메일 흑역사 방지기"
      backHref={journeySource === "paper-first-line"
        ? "/quest/first-line?from=paper"
        : journeySource === "first-line"
          ? "/quest/first-line"
          : journeySource === "paper"
            ? "/paper/reader?mode=bite&source=favorites&step=card"
            : "/quest"}
      stickyAction={(
        <div className="knock-kit-sticky-actions">
          <LinkButton href={HOME_ACTION.href} secondary>
            <Home size={17} aria-hidden="true" /> {HOME_ACTION.label}
          </LinkButton>
          <LinkButton href={FEEDBACK_ACTION.href}>
            {FEEDBACK_ACTION.label} <ArrowRight size={17} aria-hidden="true" />
          </LinkButton>
        </div>
      )}
    >
      {journeySource === "paper" || journeySource === "paper-first-line"
        ? <PaperReadingSteps current={5} />
        : null}
      <SceneBanner
        scene={brandScene.emailGuard}
        alt="노트북에서 면담 요청 메일 초안과 체크리스트를 확인하는 장면"
        eyebrow={`${professor.name} ${professor.title} · ${professor.university}`}
        title="준비된 상태로 면담을 요청하세요"
        description="진로·연구·프로젝트·멘토링 중 목적을 고르고, 논문 내용은 원할 때만 포함해 초안을 준비합니다."
        priority
      />
      <SectionHeading
        title="어떤 목적으로 메일을 쓰나요?"
        description="목적마다 초안을 따로 저장하므로 버튼을 바꿔도 수정한 내용이 남아요."
      />
      <div className="email-purpose-grid" role="group" aria-label="이메일 작성 목적">
        {EMAIL_DRAFT_PURPOSE_OPTIONS.map((option) => {
          const Icon = PURPOSE_ICONS[option.id];
          const selected = purpose === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={selected ? "email-purpose-option is-selected" : "email-purpose-option"}
              aria-pressed={selected}
              onClick={() => {
                setPurpose(option.id);
                setCopyStatus("");
              }}
            >
              <span><Icon size={20} aria-hidden="true" /></span>
              <strong>{option.label}</strong>
              <p>{option.description}</p>
            </button>
          );
        })}
      </div>

      <SectionHeading
        title="논문 내용을 메일에 포함할까요?"
        description="논문을 읽지 않은 진로 상담도 가능합니다. 선택한 교수님의 논문만 직접 선택해 넣어요."
      />
      <Card className="email-paper-choice">
        <div className="email-paper-choice__intro">
          <span><BookOpenCheck size={20} aria-hidden="true" /></span>
          <div>
            <strong>{paperTitle ?? "선택한 논문이 없어요"}</strong>
            <p>
              {paperTitle
                ? "포함 O를 고르면 논문 제목과 관심 이유가 현재 목적의 초안에 반영됩니다."
                : "논문 없이 작성하거나, 관심 교수님의 공식 논문을 먼저 선택할 수 있어요."}
            </p>
          </div>
        </div>
        <div className="email-paper-choice__options" role="group" aria-label="논문 내용 포함 여부">
          <button
            type="button"
            className={!includePaper ? "is-selected" : undefined}
            aria-pressed={!includePaper}
            onClick={() => {
              setIncludePaper(false);
              setCopyStatus("");
            }}
          >
            논문 내용 포함 X
          </button>
          <button
            type="button"
            className={includePaper ? "is-selected" : undefined}
            aria-pressed={includePaper}
            disabled={!paperTitle}
            onClick={() => {
              setIncludePaper(true);
              setCopyStatus("");
            }}
          >
            논문 내용 포함 O
          </button>
        </div>
        {!paperTitle ? (
          <Link href="/paper/reader?mode=bite&source=favorites">
            관심 교수님의 논문 선택하기 <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </Card>

      <SectionHeading
        title="준비한 첫 질문을 메일에 이어 쓸까요?"
        description="첫 질문을 고르지 않았거나 단순 상담 메일을 원하면 포함하지 않아도 됩니다."
      />
      <Card className="email-paper-choice email-first-line-choice">
        <div className="email-paper-choice__intro">
          <span><Sparkles size={20} aria-hidden="true" /></span>
          <div>
            <strong>{firstLine || "저장한 첫 질문이 없어요"}</strong>
            <p>
              {firstLine
                ? "포함 O를 고르면 이 질문이 메일 본문과 면담 질문 목록의 첫 번째에 이어집니다."
                : "목적을 고르고 첫 질문을 만든 뒤 현재 메일에 바로 이어 쓸 수 있어요."}
            </p>
          </div>
        </div>
        <div className="email-paper-choice__options" role="group" aria-label="첫 질문 포함 여부">
          <button
            type="button"
            className={!includeFirstLine ? "is-selected" : undefined}
            aria-pressed={!includeFirstLine}
            onClick={() => {
              setIncludeFirstLine(false);
              setCopyStatus("");
            }}
          >
            첫 질문 포함 X
          </button>
          <button
            type="button"
            className={includeFirstLine ? "is-selected" : undefined}
            aria-pressed={includeFirstLine}
            disabled={!firstLine}
            onClick={() => {
              setIncludeFirstLine(true);
              setCopyStatus("");
            }}
          >
            첫 질문 포함 O
          </button>
        </div>
        {!firstLine ? (
          <Link href={FIRST_QUESTION_FROM_PAPER_HREF}>
            목적별 첫 질문 만들기 <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </Card>

      <SectionHeading title="왜 이 교수인지" />
      <Card className="knock-kit-reason">
        <Tag tone={match.strength === "LIMITED" ? "warning" : "mint"}>{match.role}</Tag>
        <p>{match.reason}</p>
        <small>근거 ID: {match.evidenceIds.join(" · ")}</small>
      </Card>

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
      <p className="email-scope-note">이메일 초안은 이 화면에 저장되며 자동 전송되지 않아요.</p>

      <section className="email-followup-tools" aria-labelledby="email-followup-tools-title">
        <div>
          <span><Sparkles size={20} aria-hidden="true" /></span>
          <div>
            <small>메일 다음 준비</small>
            <h2 id="email-followup-tools-title">첫 질문도 가볍게 준비해 볼까요?</h2>
            <p>첫 질문을 셔플하거나, 교수님과 친해지기 미니도구에서 논문 리액션·용어·키워드를 정리해 보세요.</p>
          </div>
        </div>
        <div className="email-followup-tools__actions">
          <Link href={MINI_TOOL_SHUFFLE_HREF}>
            첫 질문 셔플 해보기 <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href={MINI_TOOLS_HREF}>
            미니도구 전체 보기
          </Link>
        </div>
      </section>

      <SectionHeading title="연구예절 체크리스트" />
      <Card className="knock-kit-etiquette">
        {[
          "공식 프로필과 공개 자료를 먼저 확인했다.",
          "20분 안에 답할 수 있는 질문 3개만 준비했다.",
          "면담 시간과 방식은 교수님의 안내에 맞춘다.",
          "공유 가능한 자료만 골라 질문에 활용한다.",
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
  const selectedPaper = state.selectedProfessorPaper;
  const resolved = resolveQuestProfessorContextMatch({
    studentMatches: state.professorMatches,
    selectedStudentProfessorId: state.selectedProfessorId,
    favoriteStudentProfessorIds: state.favoriteProfessorIds,
    projectMatches: state.projectProfessorMatches,
    selectedProjectProfessorId: state.selectedProjectProfessorId,
    selectedProfessorPaper: selectedPaper,
  });
  if (!resolved) return null;
  const topic = resolved.source === "paper" && selectedPaper
    ? createProfessorPaperQuestTopic(selectedPaper)
    : selectedTopicFromStore(resolved.source === "project" ? "project" : "student");
  return topic ? { topic, match: resolved.match } : null;
}
