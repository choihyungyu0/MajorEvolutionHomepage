import { PaperReader } from "@/components/paper-reader/paper-reader";
import { PaperReaderShell } from "@/components/paper-reader/paper-reader-shell";
import { pdfReaderBackHref } from "@/lib/navigation-flow";

export default async function PaperReaderPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; source?: string; step?: string; from?: string }>;
}) {
  const { mode, source, step, from } = await searchParams;
  if (mode === "pdf") return <PaperReader backHref={pdfReaderBackHref(from)} />;
  if (mode === "bite" || source === "favorites") {
    return (
      <PaperReaderShell
        startFromFavorites={source === "favorites"}
        initialStep={step === "card" ? "card" : source === "favorites" ? "select" : "card"}
      />
    );
  }

  return <PaperReader backHref={pdfReaderBackHref(from)} />;
}
