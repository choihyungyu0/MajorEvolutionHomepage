import { QuestRouterScreen } from "@/components/screens/quest-router";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; journey?: string }>;
}) {
  const params = await searchParams;
  const journeySource = params.from === "first-line"
    ? params.journey === "paper" ? "paper-first-line" : "first-line"
    : params.from === "paper" ? "paper" : null;
  return <QuestRouterScreen journeySource={journeySource} />;
}
