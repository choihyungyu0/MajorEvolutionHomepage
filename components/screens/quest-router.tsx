"use client";

import { LoaderCircle } from "lucide-react";
import {
  getOfficialQuestContext,
  OfficialKnockKitScreen,
} from "@/components/screens/official-knock-kit";
import { QuestScreen } from "@/components/screens/quest-home-screens";
import { useResearchStore } from "@/store/research-store";

export function QuestRouterScreen() {
  const hasHydrated = useResearchStore((state) => state.hasHydrated);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const matches = useResearchStore((state) => state.professorMatches);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장된 면담 준비 상태를 불러오고 있어요.</p>
      </div>
    );
  }

  const context = selectedProfessorId && matches.some(
    (match) => match.professor.id === selectedProfessorId,
  ) ? getOfficialQuestContext() : null;

  return context
    ? <OfficialKnockKitScreen topic={context.topic} match={context.match} />
    : <QuestScreen />;
}
