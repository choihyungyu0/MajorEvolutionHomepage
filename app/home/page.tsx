import { Suspense } from "react";
import { UnifiedHomeScreen } from "@/components/screens/unified-home-screen";
import { getProfessorAcademicTaxonomy } from "@/lib/professor-data.server";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UnifiedHomeScreen professorTaxonomy={getProfessorAcademicTaxonomy()} />
    </Suspense>
  );
}
