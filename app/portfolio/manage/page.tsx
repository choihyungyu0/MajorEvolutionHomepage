import { AppShell, PageHeader } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import { DataControls } from "@/components/screens/data-controls";
import { portfolioManageReturnHref } from "@/lib/navigation-flow";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <AppShell
      title="내 기록 관리"
      backHref={portfolioManageReturnHref(from)}
      className="portfolio-screen"
      bottomNav={<ServiceBottomNav />}
    >
      <PageHeader
        eyebrow="내 데이터"
        title="내 기록 관리"
        description="저장한 성장 기록의 범위와 최근 시각을 확인하고, 백업하거나 종류별로 직접 정리할 수 있어요."
      />
      <DataControls showHeading={false} />
    </AppShell>
  );
}
