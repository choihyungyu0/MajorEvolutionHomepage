import type { ProfessorKnockKitDraft } from "@/lib/professor-domain";

export type EmailDraftPurpose =
  | "career"
  | "research-interest"
  | "project-review"
  | "mentoring";

export const EMAIL_DRAFT_PURPOSE_OPTIONS: ReadonlyArray<{
  id: EmailDraftPurpose;
  label: string;
  description: string;
}> = [
  {
    id: "career",
    label: "진로·수업 고민 상담",
    description: "전공 선택, 진로 방향, 추천 경험을 여쭤봐요.",
  },
  {
    id: "research-interest",
    label: "논문·연구과제 관심",
    description: "교수님의 연구에서 궁금한 관점과 참여 준비를 물어요.",
  },
  {
    id: "project-review",
    label: "내 프로젝트 아이디어 점검",
    description: "내 아이디어의 범위·데이터·방법을 점검받아요.",
  },
  {
    id: "mentoring",
    label: "멘토링·면담 요청",
    description: "한 번의 상담과 이후 성장 방향을 조심스럽게 요청해요.",
  },
] as const;

export const PAPER_TO_EMAIL_STEPS = [
  { number: 1, label: "논문 선택", description: "관심 교수님의 공식 목록", href: null },
  { number: 2, label: "3분 카드", description: "선택 · 초록·본문 핵심 정리", href: null },
  { number: 3, label: "PDF 해설", description: "선택 · 원문 읽기·요약·질문", href: null },
  { number: 4, label: "첫 질문", description: "목적별 첫마디 선택", href: "/quest/first-line?from=paper" },
  { number: 5, label: "메일 초안", description: "첫 질문과 목적을 이어 작성", href: "/quest/email-guard?from=first-line" },
] as const;

export const FIRST_QUESTION_FROM_PAPER_HREF = "/quest/first-line?from=paper";
export const EMAIL_FROM_FIRST_QUESTION_HREF = "/quest/email-guard?from=first-line";
export const MINI_TOOL_SHUFFLE_HREF = "/quest/mini-tools#shuffle";
export const MINI_TOOLS_HREF = "/quest/mini-tools#all-tools";

export function emailGuardStickyActions() {
  return [
    { id: "home", label: "홈으로", href: "/home", secondary: true },
    {
      id: "feedback",
      label: "면담 후 피드백 기록",
      href: "/mentor-loop",
      secondary: false,
    },
  ] as const;
}

export type EmailDraftContext = {
  purpose: EmailDraftPurpose;
  includePaper: boolean;
  includeFirstLine?: boolean;
  topicId: string;
  topicTitle: string;
  topicQuestion: string;
  methodDetail: string;
  professorId: string;
  professorName: string;
  professorTitle: string;
  researchField: string;
  paperTitle: string | null;
  firstLine?: string | null;
};

type PaperSelectionLike = {
  professorId: string;
  title: string;
};

export function paperTitleForProfessor(
  selection: PaperSelectionLike | null | undefined,
  professorId: string,
): string | null {
  if (!selection || selection.professorId !== professorId) return null;
  return selection.title.trim() || null;
}

export function emailDraftStorageKey(
  topicId: string,
  professorId: string,
  purpose: EmailDraftPurpose,
  includePaper: boolean,
  includeFirstLine = false,
): string {
  return `${topicId}:${professorId}:email:${purpose}:${includePaper ? "paper" : "no-paper"}:${includeFirstLine ? "first-line" : "no-first-line"}`;
}

export function emailPurposeFromFirstLineTitle(title: string): EmailDraftPurpose | null {
  return EMAIL_DRAFT_PURPOSE_OPTIONS.find((option) => title.includes(option.label))?.id ?? null;
}

export function firstQuestionForEmail(body: string, title: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  // 예전 저장 카드의 '오피스아워' 제목도 계속 복원합니다.
  if (!/^(수업 후|이메일|연구실|오피스아워)\s*·/.test(title)) return trimmed;
  const withoutOpener = trimmed.replace(/^[^.!?。！？]+[.!?。！？]\s*/, "").trim();
  return withoutOpener || trimmed;
}

function paperInterest(title: string | null, includePaper: boolean): string {
  if (!includePaper || !title) return "";
  return `교수님의 공식 프로필에서 확인한 「${title}」에 관심이 있어 읽어 보았고, 제 고민과 연결해 더 정확히 이해하고 싶습니다.`;
}

function joinParagraphs(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join("\n\n");
}

function questionsWithFirstLine(
  questions: [string, string, string],
  context: EmailDraftContext,
): [string, string, string] {
  const firstLine = context.firstLine?.trim();
  if (!context.includeFirstLine || !firstLine) return questions;
  return [firstLine, questions[0], questions[1]];
}

function firstLineParagraph(context: EmailDraftContext): string {
  const firstLine = context.firstLine?.trim();
  if (!context.includeFirstLine || !firstLine) return "";
  return `면담에서 먼저 여쭙고 싶은 질문: ${firstLine}`;
}

export function buildEmailDraft(context: EmailDraftContext): ProfessorKnockKitDraft {
  const professor = `${context.professorName} ${context.professorTitle}님`;
  const paper = paperInterest(context.paperTitle, context.includePaper);
  const firstLine = firstLineParagraph(context);
  const greeting = `${professor}께,\n\n안녕하세요.`;
  const closing = "가능하시다면 20분 정도 면담을 요청드려도 될지 여쭙습니다. 교수님의 가능한 방식과 시간을 따르겠습니다.\n\n감사합니다.";
  const common = {
    topicId: context.topicId,
    professorId: context.professorId,
    updatedAt: new Date().toISOString(),
  };

  if (context.purpose === "career") {
    const introduction = `저는 ${context.topicTitle}과 관련해 진로와 수업 방향을 고민하고 있습니다. 교수님의 공식 프로필에서 ${context.researchField} 연구분야를 확인해, 지금 어떤 경험부터 시작하면 좋을지 조언을 구하고 싶습니다.`;
    return {
      ...common,
      introduction,
      questions: questionsWithFirstLine([
        `${context.researchField}와 연결되는 진로를 탐색할 때 학부생이 먼저 해볼 경험은 무엇인가요?`,
        "지금 단계에서 수업·프로젝트·대외활동 중 무엇을 우선해 보는 것이 좋을까요?",
        "다음 한 달 동안 제 적성과 관심을 확인할 수 있는 작은 행동을 추천해 주실 수 있을까요?",
      ], context),
      agenda: "0~3분: 학생과 고민 소개\n3~10분: 진로·수업 선택 질문\n10~16분: 추천 경험과 준비 방법\n16~20분: 다음 행동 확인",
      emailDraft: `[진로 상담 요청] 전공·진로 방향에 조언을 부탁드립니다\n\n${joinParagraphs([
        greeting,
        introduction,
        paper,
        firstLine,
        `현재 고민: ${context.topicQuestion}`,
        closing,
      ])}`,
    };
  }

  if (context.purpose === "research-interest") {
    const interestBasis = paper || `교수님의 공식 프로필에서 ${context.researchField} 연구분야를 확인했습니다.`;
    const introduction = `${interestBasis} 해당 연구가 어떤 문제를 다루고, 학부생이 관심을 발전시키려면 무엇을 준비해야 하는지 배우고 싶습니다.`;
    return {
      ...common,
      introduction,
      questions: questionsWithFirstLine([
        context.includePaper && context.paperTitle
          ? `「${context.paperTitle}」를 이해할 때 가장 먼저 구분해야 할 핵심 개념은 무엇인가요?`
          : `${context.researchField} 연구에서 학부생이 먼저 이해해야 할 핵심 문제는 무엇인가요?`,
        "현재 진행 중인 연구과제의 공개 정보 중 먼저 읽어볼 자료가 있을까요?",
        "이 분야에 관심 있는 학부생이 준비할 데이터·방법·수업을 추천해 주실 수 있을까요?",
      ], context),
      agenda: "0~3분: 관심 계기 소개\n3~10분: 연구 주제와 핵심 개념 질문\n10~16분: 필요한 준비와 공개 자료\n16~20분: 다음 학습 행동 확인",
      emailDraft: `[연구 관심 문의] ${context.researchField} 연구에 관해 여쭙고 싶습니다\n\n${joinParagraphs([
        greeting,
        introduction,
        `궁금한 점: ${context.topicQuestion}`,
        firstLine,
        closing,
      ])}`,
    };
  }

  if (context.purpose === "mentoring") {
    const introduction = `저는 ${context.topicTitle}과 관련해 방향을 정리하고 작은 행동을 이어가고 있습니다. 교수님의 ${context.researchField} 관점에서 제 고민을 점검받고, 상담 이후 제가 직접 실천할 일을 정하고 싶습니다.`;
    return {
      ...common,
      introduction,
      questions: questionsWithFirstLine([
        `현재 고민인 “${context.topicQuestion}”에서 제가 먼저 구체화해야 할 부분은 무엇인가요?`,
        "제가 스스로 시도한 뒤 다시 점검해야 할 기준을 한두 가지 알려주실 수 있을까요?",
        "일회성 상담 이후에도 제가 지켜야 할 준비 방식이나 예절이 있다면 조언 부탁드립니다.",
      ], context),
      agenda: "0~3분: 현재 고민과 시도 소개\n3~10분: 방향 점검\n10~16분: 스스로 해볼 행동 정리\n16~20분: 후속 확인 방식과 예절 확인",
      emailDraft: `[멘토링 상담 요청] 앞으로의 방향을 점검받고 싶습니다\n\n${joinParagraphs([
        greeting,
        introduction,
        paper,
        firstLine,
        "지속적인 지도를 당연하게 부탁드리는 것은 아니며, 먼저 한 차례 상담을 통해 제가 스스로 해볼 다음 행동을 정하고 싶습니다.",
        closing,
      ])}`,
    };
  }

  const introduction = `저는 ${context.topicTitle}을 주제로 작은 프로젝트를 준비하고 있습니다. 현재 질문은 “${context.topicQuestion}”이며, ${context.methodDetail} 방식으로 시작하려 합니다. 교수님의 ${context.researchField} 관점에서 범위와 방법을 점검받고 싶습니다.`;
  return {
    ...common,
    introduction,
    questions: questionsWithFirstLine([
      `${context.researchField} 관점에서 “${context.topicQuestion}”의 범위를 줄이려면 무엇을 먼저 구분해야 할까요?`,
      `${context.methodDetail}을 적용할 때 학부생이 가장 먼저 확인해야 할 오류는 무엇인가요?`,
      context.includePaper && context.paperTitle
        ? `「${context.paperTitle}」의 관점을 제 프로젝트에 연결할 때 주의할 점은 무엇인가요?`
        : "면담 전 제가 먼저 읽거나 확인해야 할 공개 자료가 있을까요?",
    ], context),
    agenda: "0~3분: 학생·프로젝트 소개\n3~8분: 질문과 범위 확인\n8~14분: 데이터·방법 점검\n14~18분: 먼저 읽을 자료 확인\n18~20분: 다음 행동 정리",
    emailDraft: `[프로젝트 점검 요청] ${context.topicTitle} 아이디어에 조언을 부탁드립니다\n\n${joinParagraphs([
      greeting,
      introduction,
      paper,
      firstLine,
      `준비한 방법: ${context.methodDetail}`,
      closing,
    ])}`,
  };
}
