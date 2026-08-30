import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectDesignHomeScreen } from "@/components/screens/project-design-home-screen";

export const metadata: Metadata = {
  title: "AI 프로젝트 설계 홈 | 너의 교수님은?",
  description: "저장된 조건과 공동설계 진행 상태를 확인하고 나만의 프로젝트 설계를 이어갑니다.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  if (view === "review") redirect("/research/conditions?view=review");
  return <ProjectDesignHomeScreen />;
}
