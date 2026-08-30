"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, SearchCheck } from "lucide-react";
import { AppShell, Card, PageHeader, PrimaryButton } from "@/components/app/primitives";
import {
  getOfficialQuestContext,
  OfficialKnockKitScreen,
} from "@/components/screens/official-knock-kit";
import { useResearchStore } from "@/store/research-store";

/**
 * Q-04 메일 흑역사 방지기 진입점.
 *
 * 메일 점검은 교수와 주제가 정해져야 의미가 있으므로,
 * 맥락이 없으면 만들어내지 않고 찾다로 돌려보냅니다.
 */
export function QuestRouterScreen({
  journeySource = null,
}: {
  journeySource?: "paper" | "paper-first-line" | "first-line" | null;
}) {
  const router = useRouter();
  const hasHydrated = useResearchStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" />
        <p>저장된 면담 준비 상태를 불러오고 있어요.</p>
      </div>
    );
  }

  const context = getOfficialQuestContext();

  if (context) {
    return <OfficialKnockKitScreen topic={context.topic} match={context.match} journeySource={journeySource} />;
  }

  return (
    <AppShell title="메일 흑역사 방지기" backHref="/quest">
      <PageHeader
        eyebrow="교수님, 말 걸어도 돼요?"
        title="먼저 연락할 교수님을 정해 주세요"
        description="선택한 교수님과 고민을 연결하면 목적에 맞는 메일 초안을 준비할 수 있어요."
      />
      <Card className="official-professor-empty">
        <SearchCheck size={28} />
        <h2>선택한 교수님이 없어요</h2>
        <p>찾다에서 교수님을 고르면 그 맥락으로 메일 초안을 점검할 수 있습니다.</p>
        <PrimaryButton onClick={() => router.push("/professors")}>나의 교수님 — 찾다로 이동</PrimaryButton>
      </Card>
    </AppShell>
  );
}
