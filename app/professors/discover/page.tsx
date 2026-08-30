import { OfficialProfessorsScreen } from "@/components/screens/official-professor-screens";
import { getProfessorAcademicTaxonomy } from "@/lib/professor-data.server";

export default function Page() {
  return <OfficialProfessorsScreen taxonomy={getProfessorAcademicTaxonomy()} />;
}
