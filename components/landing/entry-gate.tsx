"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LandingPage } from "@/components/landing/landing-page";
import { useProfileStore } from "@/store/profile-store";
import { useResearchStore } from "@/store/research-store";

export function EntryGate() {
  const router = useRouter();
  const profileHydrated = useProfileStore((state) => state.hasHydrated);
  const hasEnteredService = useProfileStore((state) => state.hasEnteredService);
  const markServiceEntered = useProfileStore((state) => state.markServiceEntered);
  const researchHydrated = useResearchStore((state) => state.hasHydrated);
  const conditions = useResearchStore((state) => state.conditions);
  const ideaMode = useResearchStore((state) => state.ideaMode);
  const result = useResearchStore((state) => state.result);
  const professorMatches = useResearchStore((state) => state.professorMatches);
  const growthProjectHistory = useResearchStore((state) => state.growthProjectHistory);

  const hasExistingJourney = Boolean(
    conditions.school
    || conditions.major
    || conditions.interests.length
    || ideaMode
    || result
    || professorMatches.length
    || growthProjectHistory.length,
  );
  const shouldGoHome = hasEnteredService || hasExistingJourney;

  useEffect(() => {
    if (!profileHydrated || !researchHydrated || !shouldGoHome) return;
    if (!hasEnteredService) markServiceEntered();
    router.replace("/home");
  }, [
    hasEnteredService,
    markServiceEntered,
    profileHydrated,
    researchHydrated,
    router,
    shouldGoHome,
  ]);

  if (!profileHydrated || !researchHydrated || shouldGoHome) {
    return (
      <div className="entry-gate-loading" role="status">
        <LoaderCircle className="spin" aria-hidden="true" />
        <span>저장된 서비스 상태를 확인하고 있어요.</span>
      </div>
    );
  }

  return <LandingPage />;
}
