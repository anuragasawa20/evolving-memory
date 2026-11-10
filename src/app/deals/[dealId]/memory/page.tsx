import { connection } from "next/server";
import { notFound } from "next/navigation";
import { MemoryExplorer } from "@/components/memory/memory-explorer";
import { getMemoryExplorer } from "@/services/memory-explorer.service";

export const instant = false;

interface PageProps {
  params: Promise<{ dealId: string }>;
}

export default async function MemoryExplorerPage({ params }: PageProps) {
  await connection();
  const { dealId } = await params;
  const explorer = await getMemoryExplorer(dealId);
  if (!explorer) notFound();

  return <MemoryExplorer dealId={dealId} initialData={explorer} />;
}
