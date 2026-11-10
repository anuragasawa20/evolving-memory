import { connection } from "next/server";
import { AppNav } from "@/components/app-nav";
import { MyLearning } from "@/components/learning/my-learning";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { getOrganizationMemoryStatus } from "@/services/organization-memory.service";
import { listPersonalTechniques } from "@/services/technique.service";

export const instant = false;

export default async function LearningPage() {
  await connection();
  const organization = await getDefaultOrganizationContext();
  const [techniques, walrus] = await Promise.all([
    listPersonalTechniques(organization.organizationId),
    getOrganizationMemoryStatus(organization.organizationId),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <MyLearning
        organizationName={organization.organizationName}
        initialTechniques={techniques}
        initialWalrus={walrus}
      />
    </div>
  );
}
