-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('DISCOVERY', 'QUALIFICATION', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('ACTIVE', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "FactCategory" AS ENUM ('PAIN_POINT', 'OBJECTION', 'BUYING_SIGNAL', 'REQUIREMENT', 'COMMITMENT', 'STAKEHOLDER', 'BUDGET', 'TIMELINE', 'DECISION_CRITERIA', 'OTHER');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MemorySyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Deal" (
    "id" UUID NOT NULL,
    "customerName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "stage" "DealStage" NOT NULL DEFAULT 'DISCOVERY',
    "status" "DealStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "title" TEXT,
    "callDate" TIMESTAMP(3),
    "transcript" TEXT NOT NULL,
    "summary" TEXT,
    "callNumber" INTEGER NOT NULL,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "suggestedStage" "DealStage",
    "stageReasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedFact" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "category" "FactCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "evidence" TEXT,
    "confidence" DECIMAL(4,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorySync" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "namespace" TEXT NOT NULL,
    "status" "MemorySyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "jobReferences" JSONB,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorySync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_updatedAt_idx" ON "Deal"("updatedAt");

-- CreateIndex
CREATE INDEX "Call_dealId_idx" ON "Call"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Call_dealId_callNumber_key" ON "Call"("dealId", "callNumber");

-- CreateIndex
CREATE INDEX "ExtractedFact_dealId_idx" ON "ExtractedFact"("dealId");

-- CreateIndex
CREATE INDEX "ExtractedFact_callId_idx" ON "ExtractedFact"("callId");

-- CreateIndex
CREATE INDEX "ExtractedFact_dealId_category_idx" ON "ExtractedFact"("dealId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "MemorySync_callId_key" ON "MemorySync"("callId");

-- CreateIndex
CREATE INDEX "MemorySync_dealId_idx" ON "MemorySync"("dealId");

-- CreateIndex
CREATE INDEX "MemorySync_status_idx" ON "MemorySync"("status");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySync" ADD CONSTRAINT "MemorySync_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySync" ADD CONSTRAINT "MemorySync_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
