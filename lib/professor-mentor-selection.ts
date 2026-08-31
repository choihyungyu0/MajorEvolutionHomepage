import type { ProfessorMatch, ProfessorMatchRole } from "@/lib/professor-domain";

const ROLE_ORDER: ProfessorMatchRole[] = ["TOPIC", "METHOD", "CONTEXT"];

/** AI가 역할이나 교수를 중복 선택해도 공식 후보 풀 안에서만 빈 역할을 보완합니다. */
export function completeProfessorMentorSelections(
  proposed: ProfessorMatch[],
  officialCandidates: ProfessorMatch[],
): [ProfessorMatch, ProfessorMatch, ProfessorMatch] | null {
  const usedProfessorIds = new Set<string>();
  const completed: ProfessorMatch[] = [];

  for (const role of ROLE_ORDER) {
    const preferred = proposed.find((match) =>
      match.role === role && !usedProfessorIds.has(match.professor.id));
    const fallback = officialCandidates.find((match) =>
      match.role === role && !usedProfessorIds.has(match.professor.id));
    const selected = preferred ?? fallback;
    if (!selected) return null;
    usedProfessorIds.add(selected.professor.id);
    completed.push(selected);
  }

  return completed as [ProfessorMatch, ProfessorMatch, ProfessorMatch];
}
