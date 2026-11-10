-- CreateEnum
CREATE TYPE "SalespersonRole" AS ENUM ('ADMIN', 'SALES_REP');

-- CreateEnum
CREATE TYPE "CaseSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "StrategyScope" AS ENUM ('PERSONAL', 'ORGANIZATIONAL');

-- CreateEnum
CREATE TYPE "ExecutionSource" AS ENUM ('DEALOS_RECOMMENDED', 'SALESPERSON_INDEPENDENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StrategyExecutionStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'MODIFIED', 'DISMISSED', 'EXECUTED', 'OUTCOME_PENDING', 'OUTCOME_RECORDED');

-- CreateEnum
CREATE TYPE "OutcomeType" AS ENUM ('POSITIVE_RESPONSE', 'MEETING_BOOKED', 'DEMO_ACCEPTED', 'PROPOSAL_REQUESTED', 'OBJECTION_RESOLVED', 'DEAL_ADVANCED', 'DEAL_WON', 'DEAL_LOST', 'NO_CHANGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PlaybookStatus" AS ENUM ('DRAFT', 'EVIDENCE_ACCUMULATING', 'REVIEW_REQUIRED', 'APPROVED', 'ACTIVE', 'REVISED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrganizationEntityType" AS ENUM ('CASE_INSTANCE', 'PLAYBOOK_VERSION', 'PERSONAL_TECHNIQUE');

-- AlterTable
ALTER TABLE "PersonalTechnique" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "caseInstanceId" UUID,
ADD COLUMN     "playbookVersionId" UUID;

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salesperson" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "SalespersonRole" NOT NULL DEFAULT 'SALES_REP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Salesperson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseCategory" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentCategoryId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseInstance" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "salespersonId" UUID,
    "categoryId" UUID NOT NULL,
    "subtype" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "confidence" DECIMAL(4,2),
    "dealStage" "DealStage",
    "severity" "CaseSeverity",
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "strategyType" TEXT NOT NULL,
    "scope" "StrategyScope" NOT NULL DEFAULT 'ORGANIZATIONAL',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyExecution" (
    "id" UUID NOT NULL,
    "caseInstanceId" UUID NOT NULL,
    "strategyId" UUID NOT NULL,
    "recommendationId" UUID,
    "salespersonId" UUID,
    "executionStatus" "StrategyExecutionStatus" NOT NULL DEFAULT 'EXECUTED',
    "decisionSource" "ExecutionSource" NOT NULL DEFAULT 'UNKNOWN',
    "actualApproach" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyOutcome" (
    "id" UUID NOT NULL,
    "strategyExecutionId" UUID NOT NULL,
    "outcomeType" "OutcomeType" NOT NULL,
    "evidence" TEXT,
    "sourceCallId" UUID,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isInferred" BOOLEAN NOT NULL DEFAULT false,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationalPlaybook" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "caseCategoryId" UUID NOT NULL,
    "subtype" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PlaybookStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationalPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookVersion" (
    "id" UUID NOT NULL,
    "playbookId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "recommendedStrategyId" UUID,
    "guidance" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "exceptions" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "confidence" DECIMAL(4,2),
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookEvidence" (
    "id" UUID NOT NULL,
    "playbookVersionId" UUID NOT NULL,
    "caseInstanceId" UUID,
    "strategyExecutionId" UUID,
    "evidenceType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMemorySync" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "entityType" "OrganizationEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "namespace" TEXT NOT NULL,
    "status" "MemorySyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blobReferences" JSONB,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMemorySync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Salesperson_organizationId_idx" ON "Salesperson"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseCategory_code_key" ON "CaseCategory"("code");

-- CreateIndex
CREATE INDEX "CaseCategory_parentCategoryId_idx" ON "CaseCategory"("parentCategoryId");

-- CreateIndex
CREATE INDEX "CaseInstance_organizationId_idx" ON "CaseInstance"("organizationId");

-- CreateIndex
CREATE INDEX "CaseInstance_dealId_idx" ON "CaseInstance"("dealId");

-- CreateIndex
CREATE INDEX "CaseInstance_callId_idx" ON "CaseInstance"("callId");

-- CreateIndex
CREATE INDEX "CaseInstance_categoryId_subtype_idx" ON "CaseInstance"("categoryId", "subtype");

-- CreateIndex
CREATE INDEX "Strategy_organizationId_idx" ON "Strategy"("organizationId");

-- CreateIndex
CREATE INDEX "Strategy_organizationId_name_idx" ON "Strategy"("organizationId", "name");

-- CreateIndex
CREATE INDEX "StrategyExecution_caseInstanceId_idx" ON "StrategyExecution"("caseInstanceId");

-- CreateIndex
CREATE INDEX "StrategyExecution_strategyId_idx" ON "StrategyExecution"("strategyId");

-- CreateIndex
CREATE INDEX "StrategyExecution_recommendationId_idx" ON "StrategyExecution"("recommendationId");

-- CreateIndex
CREATE INDEX "StrategyOutcome_strategyExecutionId_idx" ON "StrategyOutcome"("strategyExecutionId");

-- CreateIndex
CREATE INDEX "StrategyOutcome_sourceCallId_idx" ON "StrategyOutcome"("sourceCallId");

-- CreateIndex
CREATE INDEX "OrganizationalPlaybook_organizationId_idx" ON "OrganizationalPlaybook"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationalPlaybook_caseCategoryId_subtype_idx" ON "OrganizationalPlaybook"("caseCategoryId", "subtype");

-- CreateIndex
CREATE INDEX "PlaybookVersion_playbookId_idx" ON "PlaybookVersion"("playbookId");

-- CreateIndex
CREATE INDEX "PlaybookVersion_approvalStatus_idx" ON "PlaybookVersion"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookVersion_playbookId_version_key" ON "PlaybookVersion"("playbookId", "version");

-- CreateIndex
CREATE INDEX "PlaybookEvidence_playbookVersionId_idx" ON "PlaybookEvidence"("playbookVersionId");

-- CreateIndex
CREATE INDEX "PlaybookEvidence_caseInstanceId_idx" ON "PlaybookEvidence"("caseInstanceId");

-- CreateIndex
CREATE INDEX "PlaybookEvidence_strategyExecutionId_idx" ON "PlaybookEvidence"("strategyExecutionId");

-- CreateIndex
CREATE INDEX "OrganizationMemorySync_organizationId_idx" ON "OrganizationMemorySync"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMemorySync_status_idx" ON "OrganizationMemorySync"("status");

-- CreateIndex
CREATE INDEX "OrganizationMemorySync_entityType_idx" ON "OrganizationMemorySync"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMemorySync_entityType_entityId_namespace_key" ON "OrganizationMemorySync"("entityType", "entityId", "namespace");

-- CreateIndex
CREATE INDEX "PersonalTechnique_organizationId_idx" ON "PersonalTechnique"("organizationId");

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_caseInstanceId_fkey" FOREIGN KEY ("caseInstanceId") REFERENCES "CaseInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_playbookVersionId_fkey" FOREIGN KEY ("playbookVersionId") REFERENCES "PlaybookVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTechnique" ADD CONSTRAINT "PersonalTechnique_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salesperson" ADD CONSTRAINT "Salesperson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCategory" ADD CONSTRAINT "CaseCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "CaseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseInstance" ADD CONSTRAINT "CaseInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseInstance" ADD CONSTRAINT "CaseInstance_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseInstance" ADD CONSTRAINT "CaseInstance_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseInstance" ADD CONSTRAINT "CaseInstance_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseInstance" ADD CONSTRAINT "CaseInstance_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CaseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyExecution" ADD CONSTRAINT "StrategyExecution_caseInstanceId_fkey" FOREIGN KEY ("caseInstanceId") REFERENCES "CaseInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyExecution" ADD CONSTRAINT "StrategyExecution_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyExecution" ADD CONSTRAINT "StrategyExecution_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyExecution" ADD CONSTRAINT "StrategyExecution_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyOutcome" ADD CONSTRAINT "StrategyOutcome_strategyExecutionId_fkey" FOREIGN KEY ("strategyExecutionId") REFERENCES "StrategyExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyOutcome" ADD CONSTRAINT "StrategyOutcome_sourceCallId_fkey" FOREIGN KEY ("sourceCallId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationalPlaybook" ADD CONSTRAINT "OrganizationalPlaybook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationalPlaybook" ADD CONSTRAINT "OrganizationalPlaybook_caseCategoryId_fkey" FOREIGN KEY ("caseCategoryId") REFERENCES "CaseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookVersion" ADD CONSTRAINT "PlaybookVersion_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "OrganizationalPlaybook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookVersion" ADD CONSTRAINT "PlaybookVersion_recommendedStrategyId_fkey" FOREIGN KEY ("recommendedStrategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookVersion" ADD CONSTRAINT "PlaybookVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookEvidence" ADD CONSTRAINT "PlaybookEvidence_playbookVersionId_fkey" FOREIGN KEY ("playbookVersionId") REFERENCES "PlaybookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookEvidence" ADD CONSTRAINT "PlaybookEvidence_caseInstanceId_fkey" FOREIGN KEY ("caseInstanceId") REFERENCES "CaseInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookEvidence" ADD CONSTRAINT "PlaybookEvidence_strategyExecutionId_fkey" FOREIGN KEY ("strategyExecutionId") REFERENCES "StrategyExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMemorySync" ADD CONSTRAINT "OrganizationMemorySync_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
