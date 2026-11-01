-- CreateTable
CREATE TABLE "FundingProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agency" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "programType" TEXT,
    "eligibleApplicants" TEXT,
    "eligibleUses" TEXT,
    "minAward" DECIMAL,
    "maxAward" DECIMAL,
    "matchPct" DECIMAL,
    "matchBasis" TEXT,
    "matchType" TEXT,
    "reimbursement" BOOLEAN,
    "cycle" TEXT,
    "nextDeadline" DATETIME,
    "url" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "lastVerifiedAt" DATETIME,
    "lastVerifiedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "FundingProgram_lastVerifiedById_fkey" FOREIGN KEY ("lastVerifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FundingProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapitalStackRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "programId" TEXT,
    "otherSource" TEXT,
    "label" TEXT,
    "amount" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "applicationDate" DATETIME,
    "awardDate" DATETIME,
    "reimbursementLagDays" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "CapitalStackRow_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CapitalStackRow_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FundingProgram" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CapitalStackRow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingProgram_key_key" ON "FundingProgram"("key");

-- CreateIndex
CREATE INDEX "FundingProgram_jurisdiction_idx" ON "FundingProgram"("jurisdiction");

-- CreateIndex
CREATE INDEX "FundingProgram_nextDeadline_idx" ON "FundingProgram"("nextDeadline");

-- CreateIndex
CREATE INDEX "CapitalStackRow_opportunityId_sortOrder_idx" ON "CapitalStackRow"("opportunityId", "sortOrder");

-- CreateIndex
CREATE INDEX "CapitalStackRow_programId_idx" ON "CapitalStackRow"("programId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_key_key" ON "Notification"("userId", "key");
