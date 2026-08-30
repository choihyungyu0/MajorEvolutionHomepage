import { PortfolioBuilderScreen } from "@/components/screens/portfolio-screen";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const params = await searchParams;
  const topic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  return <PortfolioBuilderScreen topicId={topic ?? null} />;
}
