import type { Metadata } from "next";
import { ProfessorTutorialScreen } from "@/components/tutorial/professor-tutorial-screen";
import { getProfessorAcademicTaxonomy } from "@/lib/professor-data.server";

export const metadata: Metadata = {
  title: "3분 방향 찾기 | 너의 교수님은?",
  description: "전공과 진로 고민을 한 번에 한 질문씩 정리하고, 공식 정보에 근거한 첫 교수 연결을 확인하세요.",
};

export default function TutorialPage() {
  return <ProfessorTutorialScreen taxonomy={getProfessorAcademicTaxonomy()} />;
}
