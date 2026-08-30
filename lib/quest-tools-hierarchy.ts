const QUEST_TOOL_ORDER = [
  "paper-bite",
  "first-line",
  "email-guard",
  "silence-rescue",
  "next-seed",
] as const;

export function getQuestToolCompletionCounts(progress: {
  before: { paper: number; question: number; email: number };
  during: { total: number };
  after: { total: number };
}): Record<(typeof QUEST_TOOL_ORDER)[number], number> {
  return {
    "paper-bite": progress.before.paper,
    "first-line": progress.before.question,
    "email-guard": progress.before.email,
    "silence-rescue": progress.during.total,
    "next-seed": progress.after.total,
  };
}

export function getRecommendedQuestToolId({
  visibleToolIds,
  savedCounts,
}: {
  visibleToolIds: readonly string[];
  savedCounts: Readonly<Record<string, number | undefined>>;
}): string | null {
  const visible = new Set(visibleToolIds);
  const pending = QUEST_TOOL_ORDER.find(
    (toolId) => visible.has(toolId) && (savedCounts[toolId] ?? 0) === 0,
  );
  if (pending) return pending;
  return [...QUEST_TOOL_ORDER].reverse().find((toolId) => visible.has(toolId)) ?? null;
}
