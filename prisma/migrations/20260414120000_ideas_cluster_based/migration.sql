-- AlterTable: make hkvQuestionId optional on Idea
ALTER TABLE "Idea" ALTER COLUMN "hkvQuestionId" DROP NOT NULL;

-- AlterTable: add clusterId to Idea
ALTER TABLE "Idea" ADD COLUMN "clusterId" TEXT;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey (old cascade -> set null)
ALTER TABLE "Idea" DROP CONSTRAINT "Idea_hkvQuestionId_fkey";
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_hkvQuestionId_fkey" FOREIGN KEY ("hkvQuestionId") REFERENCES "HkvQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: set clusterId from hkvQuestion for existing ideas
UPDATE "Idea" SET "clusterId" = (
  SELECT "clusterId" FROM "HkvQuestion" WHERE "HkvQuestion"."id" = "Idea"."hkvQuestionId"
) WHERE "hkvQuestionId" IS NOT NULL;
