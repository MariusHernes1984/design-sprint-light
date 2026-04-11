-- Clear existing data that cannot be session-scoped (test data)
DELETE FROM "IdeaCanvas";
DELETE FROM "IdeaScore";
DELETE FROM "Idea";
DELETE FROM "HkvQuestion";

-- Unlink challenges from clusters before deleting clusters
UPDATE "Challenge" SET "clusterId" = NULL WHERE "clusterId" IS NOT NULL;
DELETE FROM "Cluster";

-- AlterTable: Add currentStep to Session
ALTER TABLE "Session" ADD COLUMN "currentStep" "WorkshopStep" NOT NULL DEFAULT 'SESSIONS';

-- AlterTable: Add sessionId to Cluster (required)
ALTER TABLE "Cluster" ADD COLUMN "sessionId" TEXT NOT NULL;

-- AlterTable: Add sessionId to HkvQuestion (required)
ALTER TABLE "HkvQuestion" ADD COLUMN "sessionId" TEXT NOT NULL;

-- AlterTable: Add sessionId to Idea (required)
ALTER TABLE "Idea" ADD COLUMN "sessionId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkvQuestion" ADD CONSTRAINT "HkvQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
