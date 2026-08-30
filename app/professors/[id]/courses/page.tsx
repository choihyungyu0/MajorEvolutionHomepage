import { notFound } from "next/navigation";
import { OfficialCoursesScreen } from "@/components/screens/official-courses-screen";
import { getOfficialProfessorById } from "@/lib/professor-data.server";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; journey?: string }>;
}) {
  const { id } = await params;
  const { from, journey } = await searchParams;
  const professor = getOfficialProfessorById(id);
  if (!professor) notFound();
  return <OfficialCoursesScreen professor={professor} from={from} journey={journey} />;
}
