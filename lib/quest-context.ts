"use client";

import { useMemo } from "react";
import type { ResearchTopic } from "@/data/research-mvp";
import type { ProfessorMatch } from "@/lib/professor-domain";
import { resolveQuestProfessorContextMatch } from "@/lib/professor-match-state";
import {
  createProfessorPaperQuestTopic,
  resolveJourneyTopic,
} from "@/lib/research-topic-context";
import { useResearchStore } from "@/store/research-store";

export type QuestContext = {
  topic: ResearchTopic | null;
  match: ProfessorMatch | null;
};

/**
 * 퀘스트 도구가 공유하는 맥락(선택한 연구주제 + 연결한 교수).
 *
 * 맥락이 없으면 null을 돌려주고, 화면은 문장을 지어내는 대신 앞 단계로 안내합니다.
 */
export function useQuestContext({
  includeFavoriteFallback = true,
  includePaperSelection = true,
}: {
  includeFavoriteFallback?: boolean;
  includePaperSelection?: boolean;
} = {}): QuestContext {
  const result = useResearchStore((state) => state.result);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const matches = useResearchStore((state) => state.professorMatches);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const favoriteProfessorIds = useResearchStore((state) => state.favoriteProfessorIds);
  const projectMatches = useResearchStore((state) => state.projectProfessorMatches);
  const selectedProjectProfessorId = useResearchStore((state) => state.selectedProjectProfessorId);
  const selectedProfessorPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const professorDiscoveryTopic = useResearchStore((state) => state.professorDiscoveryTopic);

  return useMemo(() => {
    const activePaperSelection = includePaperSelection ? selectedProfessorPaper : null;
    const resolved = resolveQuestProfessorContextMatch({
      studentMatches: matches,
      selectedStudentProfessorId: selectedProfessorId,
      favoriteStudentProfessorIds: includeFavoriteFallback ? favoriteProfessorIds : [],
      projectMatches,
      selectedProjectProfessorId,
      selectedProfessorPaper: includePaperSelection ? selectedProfessorPaper : null,
    });
    const match = resolved?.match ?? null;
    const topic: ResearchTopic | null = resolved?.source === "paper" && activePaperSelection
      ? createProfessorPaperQuestTopic(activePaperSelection)
      : resolveJourneyTopic({
          result,
          selectedTopicId,
          professorDiscoveryTopic: resolved?.source === "project" ? null : professorDiscoveryTopic,
        });
    /*
     * 교수 맥락은 두 신호에서 옵니다.
     *
     * 찾다에서 상세로 들어가면 selectedProfessorId가 잡히고,
     * 카드에서 바로 즐겨찾기만 누르면 favoriteProfessorIds에 담깁니다.
     * 논문 한입과 퀘스트 허브가 이미 즐겨찾기를 기준으로 삼으므로 여기서도 같이 봅니다.
     */
    return { topic, match };
  }, [
    result,
    selectedTopicId,
    professorDiscoveryTopic,
    matches,
    selectedProfessorId,
    favoriteProfessorIds,
    projectMatches,
    selectedProjectProfessorId,
    selectedProfessorPaper,
    includeFavoriteFallback,
    includePaperSelection,
  ]);
}

/**
 * 학생 입력과 교수를 잇는 근거 문장.
 * 공식 프로필에서 확인한 것만 씁니다. 성격이나 친밀도는 추정하지 않습니다.
 */
export function evidencePhrase(match: ProfessorMatch | null): string {
  if (!match) return "";
  const publication = match.professor.publications.find((item) =>
    match.evidenceIds.includes(item.id));
  if (publication) return `「${publication.title}」`;
  const field = match.matchedTerms[0] ?? match.professor.researchFields[0];
  return field ? `${field} 연구분야` : "공식 프로필에 소개된 연구";
}
