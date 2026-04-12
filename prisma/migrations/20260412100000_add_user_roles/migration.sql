-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- Add role column (default USER, then set existing users to ADMIN)
ALTER TABLE "Facilitator" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "Facilitator" ADD COLUMN "assignedWorkshopId" TEXT;

-- Set all existing facilitators to ADMIN (they are the original owners)
UPDATE "Facilitator" SET "role" = 'ADMIN';

-- Add FK constraint
ALTER TABLE "Facilitator" ADD CONSTRAINT "Facilitator_assignedWorkshopId_fkey" FOREIGN KEY ("assignedWorkshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
