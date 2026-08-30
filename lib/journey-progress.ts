type JourneyCard = {
  id: string;
  tool: "paper-bite" | "first-line" | "silence-rescue" | "email-guard" | "next-seed";
  body: string;
  professorId: string | null;
  topicId: string | null;
  bundleId: string | null;
};

type JourneyProgressInput = {
  topicId: string | null;
  professorId: string | null;
  cards: JourneyCard[];
  emailDrafts: Record<string, unknown>;
  mentorEntries: Record<string, unknown>;
};

type JourneyProgress = {
  before: { paper: number; question: number; email: number; total: number };
  during: { total: number };
  after: { total: number };
  readySteps: { professor: boolean; before: boolean; during: boolean; after: boolean };
  preparedItemCount: number;
};

const EMAIL_PURPOSES = new Set([
  "career",
  "research-interest",
  "project-review",
  "mentoring",
]);
const PAPER_OPTIONS = new Set(["paper", "no-paper"]);
const FIRST_LINE_OPTIONS = new Set(["first-line", "no-first-line"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function matchesCurrentJourney(
  card: JourneyCard,
  topicId: string,
  professorId: string,
): boolean {
  return card.topicId === topicId
    && card.professorId === professorId
    && isNonEmptyString(card.body);
}

function uniqueCards(cards: JourneyCard[]): JourneyCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.tool}:${card.body.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniquePaperItems(cards: JourneyCard[]): number {
  const seen = new Set<string>();
  for (const card of cards) {
    seen.add(card.bundleId ? `bundle:${card.bundleId}` : `card:${card.id}`);
  }
  return seen.size;
}

/**
 * 이메일 목적·논문·첫질문 옵션을 바꿔도 한 여정의 이메일 준비는 하나로 셉니다.
 * 초기 `topic:professor` 키와 첫질문 옵션이 없던 이전 새 키도 함께 읽습니다.
 */
export function hasEmailDraftForJourney(
  drafts: Record<string, unknown>,
  topicId: string | null,
  professorId: string | null,
): boolean {
  if (!topicId || !professorId) return false;
  const legacyKey = `${topicId}:${professorId}`;
  const currentPrefix = `${topicId}:${professorId}:email:`;

  return Object.keys(drafts).some((key) => {
    if (key === legacyKey) return true;
    if (!key.startsWith(currentPrefix)) return false;
    const options = key.slice(currentPrefix.length).split(":");
    if (!EMAIL_PURPOSES.has(options[0] ?? "") || !PAPER_OPTIONS.has(options[1] ?? "")) {
      return false;
    }
    return options.length === 2
      || (options.length === 3 && FIRST_LINE_OPTIONS.has(options[2] ?? ""));
  });
}

export function getJourneyProgress({
  topicId,
  professorId,
  cards,
  emailDrafts,
  mentorEntries,
}: JourneyProgressInput): JourneyProgress {
  const empty: JourneyProgress = {
    before: { paper: 0, question: 0, email: 0, total: 0 },
    during: { total: 0 },
    after: { total: 0 },
    readySteps: { professor: false, before: false, during: false, after: false },
    preparedItemCount: 0,
  };
  if (!topicId || !professorId) return empty;

  const currentCards = cards.filter((card) => matchesCurrentJourney(card, topicId, professorId));
  const paper = uniquePaperItems(currentCards.filter((card) => card.tool === "paper-bite"));
  const question = uniqueCards(currentCards.filter((card) => card.tool === "first-line")).length;
  const email = hasEmailDraftForJourney(emailDrafts, topicId, professorId) ? 1 : 0;
  const during = uniqueCards(currentCards.filter((card) => card.tool === "silence-rescue")).length;
  const nextSeed = uniqueCards(currentCards.filter((card) => card.tool === "next-seed")).length;
  const mentorEntry = Object.prototype.hasOwnProperty.call(mentorEntries, `${topicId}:${professorId}`)
    ? 1
    : 0;
  const before = { paper, question, email, total: paper + question + email };
  const after = { total: nextSeed + mentorEntry };

  return {
    before,
    during: { total: during },
    after,
    readySteps: {
      professor: true,
      before: before.paper > 0 && before.question > 0 && before.email > 0,
      during: during > 0,
      after: after.total > 0,
    },
    preparedItemCount: before.total + during + after.total,
  };
}
