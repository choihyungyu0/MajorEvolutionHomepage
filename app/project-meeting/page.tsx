import type { Metadata } from "next";
import { ProjectMeetingScreen } from "@/components/screens/project-meeting-screen";

export const metadata: Metadata = {
  title: "프로젝트 교수 자문 준비 | 너의 교수님은?",
  description: "선택한 프로젝트의 질문·데이터·방법·범위를 검증받기 위한 교수 자문을 준비합니다.",
};

export default function Page() {
  return <ProjectMeetingScreen />;
}
