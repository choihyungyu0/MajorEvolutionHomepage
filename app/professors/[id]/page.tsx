import { notFound } from "next/navigation";
import { OfficialProfessorDetailScreen } from "@/components/screens/official-professor-screens";
import { getOfficialProfessorById } from "@/lib/professor-data.server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = getOfficialProfessorById(id);
  if (!professor) notFound();
  return <OfficialProfessorDetailScreen professor={professor} />;
}
