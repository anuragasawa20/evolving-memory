-- CreateEnum
CREATE TYPE "MemoryRelationshipType" AS ENUM ('BELONGS_TO', 'DISCOVERED_IN', 'RELATED_TO', 'ADDRESSES', 'UPDATED_BY', 'INFLUENCED', 'CONFIRMS', 'CONTRADICTS');

-- CreateEnum
CREATE TYPE "RelationshipOrigin" AS ENUM ('EXPLICIT', 'INFERRED');

-- CreateEnum
CREATE TYPE "MemoryLearningAction" AS ENUM ('CREATED', 'CONFIRMED', 'REFINED', 'CONTRADICTED');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'MODIFIED', 'DISMISSED', 'EXECUTED', 'OUTCOME_PENDING', 'OUTCOME_RECORDED');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('CALL_ANALYZED', 'MEMORY_CREATED', 'MEMORY_CONFIRMED', 'MEMORY_REFINED', 'MEMORY_CONTRADICTED', 'TECHNIQUE_ADDED', 'RECOMMENDATION_GENERATED', 'MEMORY_SYNCED', 'MEMORY_SYNC_FAILED');

-- AlterTable
ALTER TABLE "ExtractedFact" ADD COLUMN     "isInferred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "MemoryVersion" (
    "id" UUID NOT NULL,
    "memoryId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "evidence" TEXT,
    "memoryType" "FactCategory" NOT NULL,
    "confidence" DECIMAL(4,2),
    "sourceCallId" UUID,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryRelationship" (
    "id" UUID NOT NULL,
    "sourceMemoryId" UUID NOT NULL,
    "targetMemoryId" UUID NOT NULL,
    "relationshipType" "MemoryRelationshipType" NOT NULL,
    "origin" "RelationshipOrigin" NOT NULL DEFAULT 'EXPLICIT',
    "explanation" TEXT,
    "sourceCallId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryLearningEvent" (
    "id" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "memoryId" UUID NOT NULL,
    "sourceCallId" UUID,
    "action" "MemoryLearningAction" NOT NULL,
    "previousVersionId" UUID,
    "newVersionId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryLearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "callId" UUID,
    "content" TEXT NOT NULL,
    "reasoning" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'SUGGESTED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationMemory" (
    "recommendationId" UUID NOT NULL,
    "memoryId" UUID NOT NULL,
    "contribution" TEXT,

    CONSTRAINT "RecommendationMemory_pkey" PRIMARY KEY ("recommendationId","memoryId")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "eventType" "TimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceCallId" UUID,
    "sourceMemoryId" UUID,
    "recommendationId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalTechnique" (
    "id" UUID NOT NULL,
    "dealId" UUID,
    "memoryId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalTechnique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryVersion_memoryId_idx" ON "MemoryVersion"("memoryId");

-- CreateIndex
CREATE INDEX "MemoryVersion_sourceCallId_idx" ON "MemoryVersion"("sourceCallId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryVersion_memoryId_versionNumber_key" ON "MemoryVersion"("memoryId", "versionNumber");

-- CreateIndex
CREATE INDEX "MemoryRelationship_sourceMemoryId_idx" ON "MemoryRelationship"("sourceMemoryId");

-- CreateIndex
CREATE INDEX "MemoryRelationship_targetMemoryId_idx" ON "MemoryRelationship"("targetMemoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryRelationship_sourceMemoryId_targetMemoryId_relationsh_key" ON "MemoryRelationship"("sourceMemoryId", "targetMemoryId", "relationshipType");

-- CreateIndex
CREATE INDEX "MemoryLearningEvent_dealId_idx" ON "MemoryLearningEvent"("dealId");

-- CreateIndex
CREATE INDEX "MemoryLearningEvent_memoryId_idx" ON "MemoryLearningEvent"("memoryId");

-- CreateIndex
CREATE INDEX "MemoryLearningEvent_sourceCallId_idx" ON "MemoryLearningEvent"("sourceCallId");

-- CreateIndex
CREATE INDEX "Recommendation_dealId_idx" ON "Recommendation"("dealId");

-- CreateIndex
CREATE INDEX "Recommendation_callId_idx" ON "Recommendation"("callId");

-- CreateIndex
CREATE INDEX "Recommendation_dealId_createdAt_idx" ON "Recommendation"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationMemory_memoryId_idx" ON "RecommendationMemory"("memoryId");

-- CreateIndex
CREATE INDEX "TimelineEvent_dealId_createdAt_idx" ON "TimelineEvent"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_sourceCallId_idx" ON "TimelineEvent"("sourceCallId");

-- CreateIndex
CREATE INDEX "TimelineEvent_sourceMemoryId_idx" ON "TimelineEvent"("sourceMemoryId");

-- CreateIndex
CREATE INDEX "TimelineEvent_recommendationId_idx" ON "TimelineEvent"("recommendationId");

-- CreateIndex
CREATE INDEX "PersonalTechnique_dealId_idx" ON "PersonalTechnique"("dealId");

-- CreateIndex
CREATE INDEX "PersonalTechnique_memoryId_idx" ON "PersonalTechnique"("memoryId");

-- AddForeignKey
ALTER TABLE "MemoryVersion" ADD CONSTRAINT "MemoryVersion_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "ExtractedFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryVersion" ADD CONSTRAINT "MemoryVersion_sourceCallId_fkey" FOREIGN KEY ("sourceCallId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRelationship" ADD CONSTRAINT "MemoryRelationship_sourceMemoryId_fkey" FOREIGN KEY ("sourceMemoryId") REFERENCES "ExtractedFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRelationship" ADD CONSTRAINT "MemoryRelationship_targetMemoryId_fkey" FOREIGN KEY ("targetMemoryId") REFERENCES "ExtractedFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRelationship" ADD CONSTRAINT "MemoryRelationship_sourceCallId_fkey" FOREIGN KEY ("sourceCallId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLearningEvent" ADD CONSTRAINT "MemoryLearningEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLearningEvent" ADD CONSTRAINT "MemoryLearningEvent_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "ExtractedFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLearningEvent" ADD CONSTRAINT "MemoryLearningEvent_sourceCallId_fkey" FOREIGN KEY ("sourceCallId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLearningEvent" ADD CONSTRAINT "MemoryLearningEvent_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "MemoryVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryLearningEvent" ADD CONSTRAINT "MemoryLearningEvent_newVersionId_fkey" FOREIGN KEY ("newVersionId") REFERENCES "MemoryVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationMemory" ADD CONSTRAINT "RecommendationMemory_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationMemory" ADD CONSTRAINT "RecommendationMemory_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "ExtractedFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_sourceCallId_fkey" FOREIGN KEY ("sourceCallId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_sourceMemoryId_fkey" FOREIGN KEY ("sourceMemoryId") REFERENCES "ExtractedFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTechnique" ADD CONSTRAINT "PersonalTechnique_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTechnique" ADD CONSTRAINT "PersonalTechnique_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "ExtractedFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
