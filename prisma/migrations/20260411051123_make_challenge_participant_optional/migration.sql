-- DropForeignKey
ALTER TABLE "Challenge" DROP CONSTRAINT "Challenge_participantId_fkey";

-- AlterTable
ALTER TABLE "Challenge" ALTER COLUMN "participantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
