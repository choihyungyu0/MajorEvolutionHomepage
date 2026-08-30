export type GrowthProfessorContext = {
  major: string;
  interests: string[];
  careerConcerns: string[];
  project: {
    title: string;
    question: string;
    firstAction: string;
  } | null;
  professor: {
    name: string;
    department: string;
    reason: string;
  } | null;
};
export type GrowthProfessorMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GrowthProfessorRequest = {
  context: GrowthProfessorContext;
  messages: GrowthProfessorMessage[];
};

export type GrowthProfessorSuggestion = {
  text: string;
  kind: "continue" | "branch";
  axis: "clarify" | "evidence_action" | "alternative";
};

const SUGGESTION_AXES = ["clarify", "evidence_action", "alternative"] as const;

const DEFAULT_STUDENT_QUESTIONS: Record<
  GrowthProfessorSuggestion["axis"],
  string
> = {
  clarify: "이 내용을 더 쉽게 이해하려면 무엇부터 보면 좋을까요?",
  evidence_action: "제가 먼저 확인해야 할 자료는 무엇인가요?",
  alternative: "제가 놓치고 있는 다른 관점은 무엇인가요?",
};

const STUDENT_QUESTION_CUE = /(?:무엇|뭘|뭐|어떻게|어떤|어느|왜|언제|어디|누구|얼마|몇|인가요|일까요|하나요|할까요|될까요|좋을까요|필요한가요|맞나요|있나요|없나요|되나요|궁금)/;
const PLEDGE_OR_PROPOSAL = /(?:볼게요|할게요|겠습니다|볼래요|할래요|해\s*봐요|해\s*볼까요)(?:\?|$)/;

/** 학생이 답을 아는 사람처럼 제안하거나 다짐하지 않고 직접 묻는 문장인지 확인합니다. */
export function isStudentQuestionText(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const text = input.trim().replace(/\s+/g, " ");
  return (
    text.length > 1
    && text.endsWith("?")
    && STUDENT_QUESTION_CUE.test(text)
    && !PLEDGE_OR_PROPOSAL.test(text)
  );
}

export function normalizeGrowthProfessorSuggestions(input: unknown): GrowthProfessorSuggestion[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  const suggestions: GrowthProfessorSuggestion[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < 3; index += 1) {
    const item = input[index];
    const axis = SUGGESTION_AXES[index];
    const rawText = typeof item === "string"
      ? item
      : item && typeof item === "object" && "text" in item
        ? String(item.text ?? "")
        : "";
    const candidate = rawText
      .trim()
      .replace(/\s+/g, " ")
      .replace(/？$/, "?")
      .slice(0, 40);
    const text = isStudentQuestionText(candidate) && !seen.has(candidate)
      ? candidate
      : DEFAULT_STUDENT_QUESTIONS[axis];
    const requestedKind = item && typeof item === "object" && "kind" in item
      ? item.kind
      : "continue";
    suggestions.push({
      text,
      kind: index === 2 && requestedKind === "branch" ? "branch" : "continue",
      axis,
    });
    seen.add(text);
  }

  return suggestions;
}

export function resolveGrowthProfessorSuggestionParentId(
  suggestion: GrowthProfessorSuggestion,
  sourceAssistantId: string | null,
  preserveSelectedSource = false,
): string | null {
  return preserveSelectedSource || suggestion.kind === "branch" ? sourceAssistantId : null;
}

export type GrowthProfessorResponse = {
  reply: string;
  reflection: {
    title: string;
    body: string;
  };
  suggestedPrompts: [GrowthProfessorSuggestion, GrowthProfessorSuggestion, GrowthProfessorSuggestion];
  generatedAt: string;
  model: string;
};
