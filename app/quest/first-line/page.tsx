import { FirstLineScreen } from "@/components/screens/first-line-screen";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  return <FirstLineScreen fromPaper={params.from === "paper"} />;
}
