-- CreateTable
CREATE TABLE "infrastructure_test" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infrastructure_test_pkey" PRIMARY KEY ("id")
);
