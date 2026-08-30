import type { Metadata } from "next";
import { ProjectExecutionHomeScreen } from "@/components/screens/project-execution-home-screen";

export const metadata: Metadata = {
  title: "프로젝트 실행 홈 | 너의 교수님은?",
  description: "선택한 프로젝트와 자문 교수를 기준으로 실행 계획과 현재 준비 상태를 이어갑니다.",
};

export default function Page() {
  return <ProjectExecutionHomeScreen />;
}
