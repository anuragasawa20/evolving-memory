import { prisma } from "@/lib/prisma";
import { CASE_TAXONOMY } from "@/lib/case-taxonomy";

const DEFAULT_SLUG = process.env.DEFAULT_ORGANIZATION_SLUG ?? "dealos-demo";
const DEFAULT_ORG_NAME =
  process.env.DEFAULT_ORGANIZATION_NAME ?? "DealOS Demo Organization";
const DEFAULT_REP_NAME = process.env.DEFAULT_SALES_REP ?? "Alex Morgan";

export interface OrganizationContext {
  organizationId: string;
  organizationName: string;
  salespersonId: string;
  salespersonName: string;
}

export async function getDefaultOrganizationContext(): Promise<OrganizationContext> {
  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_SLUG },
    create: { name: DEFAULT_ORG_NAME, slug: DEFAULT_SLUG },
    update: {},
  });

  let salesperson = await prisma.salesperson.findFirst({
    where: { organizationId: organization.id, name: DEFAULT_REP_NAME },
    select: { id: true, name: true },
  });

  if (!salesperson) {
    salesperson = await prisma.salesperson.create({
      data: {
        organizationId: organization.id,
        name: DEFAULT_REP_NAME,
        role: "SALES_REP",
      },
      select: { id: true, name: true },
    });
  }

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    salespersonId: salesperson.id,
    salespersonName: salesperson.name,
  };
}

export async function ensureCaseTaxonomy(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const category of CASE_TAXONOMY) {
    const parent = await prisma.caseCategory.upsert({
      where: { code: category.code },
      create: {
        code: category.code,
        name: category.name,
        description: category.description,
        isActive: true,
      },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
      },
    });
    ids.set(category.code, parent.id);

    for (const subtype of category.subtypes) {
      const child = await prisma.caseCategory.upsert({
        where: { code: subtype.code },
        create: {
          code: subtype.code,
          name: subtype.name,
          description: `${category.name}: ${subtype.name}`,
          parentCategoryId: parent.id,
          isActive: true,
        },
        update: {
          name: subtype.name,
          description: `${category.name}: ${subtype.name}`,
          parentCategoryId: parent.id,
          isActive: true,
        },
      });
      ids.set(subtype.code, child.id);
    }
  }

  return ids;
}
