import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { OrganizationIntelligence } from "@/components/organization/organization-intelligence";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { getOrganizationIntelligence } from "@/services/organizational-intelligence.service";

export const instant = false;

type IntelligenceTab =
  | "cases"
  | "strategies"
  | "playbooks"
  | "insights"
  | "walrus";

const TABS = new Set<IntelligenceTab>([
  "cases",
  "strategies",
  "playbooks",
  "insights",
  "walrus",
]);

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const organization = await getDefaultOrganizationContext();
  const intelligence = await getOrganizationIntelligence(
    organization.organizationId,
  );
  if (!intelligence) notFound();

  const requested = (await searchParams).tab;
  const initialTab =
    requested && TABS.has(requested as IntelligenceTab)
      ? (requested as IntelligenceTab)
      : undefined;

  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <OrganizationIntelligence
        initialData={intelligence}
        initialTab={initialTab}
      />
    </div>
  );
}
