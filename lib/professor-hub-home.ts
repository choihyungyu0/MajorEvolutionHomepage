type CurrentProfessor = { id: string; name: string };
type ProfessorHistory = { professorId: string; name: string };

export function getSavedProfessorSummary({
  favoriteProfessorIds,
  currentProfessors,
  history,
}: {
  favoriteProfessorIds: readonly string[];
  currentProfessors: readonly CurrentProfessor[];
  history: readonly ProfessorHistory[];
}): { count: number; names: string[]; description: string } {
  const favoriteIds = Array.from(new Set(favoriteProfessorIds));
  const nameById = new Map<string, string>();
  for (const item of history) {
    if (favoriteIds.includes(item.professorId) && item.name.trim()) {
      nameById.set(item.professorId, item.name.trim());
    }
  }
  for (const professor of currentProfessors) {
    if (favoriteIds.includes(professor.id) && professor.name.trim()) {
      nameById.set(professor.id, professor.name.trim());
    }
  }

  const names = favoriteIds
    .map((professorId) => nameById.get(professorId) ?? null)
    .filter((name): name is string => Boolean(name));
  const missingCount = favoriteIds.length - names.length;
  const description = favoriteIds.length === 0
    ? "관심 있는 교수를 저장하면 여기에 모여요."
    : names.length === 0
      ? `저장한 교수 ${favoriteIds.length}명의 공식 정보를 다시 확인할 수 있어요.`
      : [names.join(" · "), missingCount > 0 ? `저장 기록 ${missingCount}명` : ""]
          .filter(Boolean)
          .join(" · ");

  return { count: favoriteIds.length, names, description };
}
