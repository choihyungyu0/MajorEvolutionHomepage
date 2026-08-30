import type { Metadata } from "next";
import { ResearchTutorialScreen } from "@/components/tutorial/research-tutorial-screen";

export const metadata: Metadata = {
  title: "AI 프로젝트 설계 | 너의 교수님은?",
  description: "전공과 관심, 경험, 가능한 조건을 한 단계씩 정리하고 나만의 프로젝트를 AI와 함께 설계하세요.",
};

export default function ResearchTutorialPage() {
  return <ResearchTutorialScreen />;
}
