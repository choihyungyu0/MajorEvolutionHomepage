import type { Metadata } from "next";
import { ProjectProfessorHubScreen } from "@/components/screens/project-professor-hub-screen";

export const metadata: Metadata = {
  title: "맞춤 교수 추천 | 너의 교수님은?",
  description: "AI와 설계한 프로젝트를 기준으로 공식 교수 후보에서 역할별 연결 근거를 확인합니다.",
};

export default function Page() {
  return <ProjectProfessorHubScreen />;
}
