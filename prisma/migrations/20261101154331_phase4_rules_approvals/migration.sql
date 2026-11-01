-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "approvalsBufferDays" INTEGER;
ALTER TABLE "Opportunity" ADD COLUMN "approvalsDeadline" DATETIME;
ALTER TABLE "Opportunity" ADD COLUMN "approvalsTemplate" TEXT;

-- CreateTable
CREATE TABLE "StateRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "value" DECIMAL,
    "unit" TEXT,
    "source" TEXT,
    "lastVerifiedAt" DATETIME,
    "lastVerifiedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "StateRule_lastVerifiedById_fkey" FOREIGN KEY ("lastVerifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "body" TEXT,
    "document" TEXT NOT NULL DEFAULT 'OTHER',
    "needsMeeting" BOOLEAN NOT NULL DEFAULT false,
    "waitAfterDays" INTEGER,
    "waitRuleKey" TEXT,
    "meetingDate" DATETIME,
    "agendaDeadline" DATETIME,
    "dateSetBy" TEXT,
    "ownerContactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "ApprovalStep_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_ownerContactId_fkey" FOREIGN KEY ("ownerContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StateRule_key_key" ON "StateRule"("key");

-- CreateIndex
CREATE INDEX "StateRule_jurisdiction_topic_idx" ON "StateRule"("jurisdiction", "topic");

-- CreateIndex
CREATE INDEX "ApprovalStep_opportunityId_sortOrder_idx" ON "ApprovalStep"("opportunityId", "sortOrder");

-- CreateIndex
CREATE INDEX "ApprovalStep_meetingDate_idx" ON "ApprovalStep"("meetingDate");
