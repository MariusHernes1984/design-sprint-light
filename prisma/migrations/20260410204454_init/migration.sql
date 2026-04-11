-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkshopStep" AS ENUM ('PREWORK', 'SESSIONS', 'CLUSTERING', 'HKV', 'IDEATION', 'PRIORITIZATION', 'MATRIX', 'CANVAS', 'RESULTS');

-- CreateEnum
CREATE TYPE "ChallengeSource" AS ENUM ('PREWORK', 'SESSION');

-- CreateEnum
CREATE TYPE "ValueLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "MatrixQuadrant" AS ENUM ('PRIORITER_NA', 'STRATEGISKE_SATSINGER', 'RASKE_GEVINSTER', 'PARKER');

-- CreateTable
CREATE TABLE "Facilitator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facilitator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "customerName" TEXT,
    "joinCode" TEXT NOT NULL,
    "status" "WorkshopStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" "WorkshopStep" NOT NULL DEFAULT 'PREWORK',
    "facilitatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "workshopId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" "ChallengeSource" NOT NULL,
    "workshopId" TEXT NOT NULL,
    "sessionId" TEXT,
    "participantId" TEXT NOT NULL,
    "clusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "workshopId" TEXT NOT NULL,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HkvQuestion" (
    "id" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "benefit" TEXT NOT NULL,
    "constraint" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "clusterId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HkvQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "hkvQuestionId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "participantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaScore" (
    "id" TEXT NOT NULL,
    "utilityValue" "ValueLevel" NOT NULL,
    "feasibility" "ValueLevel" NOT NULL,
    "dataAvailability" TEXT,
    "systemReadiness" TEXT,
    "timeHorizon" TEXT,
    "matrixQuadrant" "MatrixQuadrant" NOT NULL,
    "ideaId" TEXT NOT NULL,

    CONSTRAINT "IdeaScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaCanvas" (
    "id" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "solutionSummary" TEXT NOT NULL,
    "dataNeeds" TEXT NOT NULL,
    "stakeholders" TEXT,
    "firstSteps" TEXT NOT NULL,
    "expectedOutcome" TEXT,
    "isAiDraft" BOOLEAN NOT NULL DEFAULT false,
    "ideaId" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaCanvas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Facilitator_email_key" ON "Facilitator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workshop_joinCode_key" ON "Workshop"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_name_workshopId_key" ON "Participant"("name", "workshopId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaScore_ideaId_key" ON "IdeaScore"("ideaId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaCanvas_ideaId_key" ON "IdeaCanvas"("ideaId");

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "Facilitator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkvQuestion" ADD CONSTRAINT "HkvQuestion_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkvQuestion" ADD CONSTRAINT "HkvQuestion_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_hkvQuestionId_fkey" FOREIGN KEY ("hkvQuestionId") REFERENCES "HkvQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaScore" ADD CONSTRAINT "IdeaScore_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvas" ADD CONSTRAINT "IdeaCanvas_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
