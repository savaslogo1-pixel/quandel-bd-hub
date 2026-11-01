-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadCompanyId" TEXT NOT NULL,
    "projectType" TEXT,
    "deliveryMethod" TEXT,
    "nonEnergyScope" BOOLEAN NOT NULL DEFAULT false,
    "estimatedValue" DECIMAL,
    "quandelScopeValue" DECIMAL,
    "probability" INTEGER,
    "ownerId" TEXT,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "stageEnteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goNoGo" TEXT,
    "goNoGoReason" TEXT,
    "goNoGoAt" DATETIME,
    "goNoGoApproverId" TEXT,
    "outcome" TEXT,
    "lossReason" TEXT,
    "rfqIssueDate" DATETIME,
    "preBidDate" DATETIME,
    "dueDate" DATETIME,
    "interviewDate" DATETIME,
    "boardVoteDate" DATETIME,
    "awardDate" DATETIME,
    "constructionStartDate" DATETIME,
    "substantialCompletionDate" DATETIME,
    "competitors" TEXT,
    "winThemes" TEXT,
    "helpedWriteSpecs" BOOLEAN,
    "procIndependenceAt" DATETIME,
    "procIndependenceById" TEXT,
    "disclosureDecision" TEXT,
    "disclosureNote" TEXT,
    "disclosureAt" DATETIME,
    "disclosureById" TEXT,
    "aeNoConflictCertAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Opportunity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_leadCompanyId_fkey" FOREIGN KEY ("leadCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_goNoGoApproverId_fkey" FOREIGN KEY ("goNoGoApproverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_procIndependenceById_fkey" FOREIGN KEY ("procIndependenceById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_disclosureById_fkey" FOREIGN KEY ("disclosureById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpportunityChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "doneAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpportunityChecklistItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityChecklistItem_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpportunityStageChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "fromStage" INTEGER,
    "toStage" INTEGER NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpportunityStageChange_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityStageChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_OppSupport" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_OppSupport_A_fkey" FOREIGN KEY ("A") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_OppSupport_B_fkey" FOREIGN KEY ("B") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "notes" TEXT,
    "nextStep" TEXT,
    "nextStepDate" DATETIME,
    "nextStepDone" BOOLEAN NOT NULL DEFAULT false,
    "agendaItems" TEXT,
    "votesTaken" TEXT,
    "minutesUrl" TEXT,
    "financingDiscussed" BOOLEAN NOT NULL DEFAULT false,
    "financialAdvisorContactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Activity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_financialAdvisorContactId_fkey" FOREIGN KEY ("financialAdvisorContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("agendaItems", "createdAt", "createdById", "financialAdvisorContactId", "financingDiscussed", "id", "minutesUrl", "nextStep", "nextStepDate", "nextStepDone", "notes", "occurredAt", "opportunityId", "orgId", "type", "updatedAt", "votesTaken") SELECT "agendaItems", "createdAt", "createdById", "financialAdvisorContactId", "financingDiscussed", "id", "minutesUrl", "nextStep", "nextStepDate", "nextStepDone", "notes", "occurredAt", "opportunityId", "orgId", "type", "updatedAt", "votesTaken" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_orgId_occurredAt_idx" ON "Activity"("orgId", "occurredAt");
CREATE INDEX "Activity_nextStepDate_idx" ON "Activity"("nextStepDate");
CREATE INDEX "Activity_createdById_idx" ON "Activity"("createdById");
CREATE INDEX "Activity_opportunityId_idx" ON "Activity"("opportunityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- CreateIndex
CREATE INDEX "Opportunity_orgId_idx" ON "Opportunity"("orgId");

-- CreateIndex
CREATE INDEX "Opportunity_leadCompanyId_idx" ON "Opportunity"("leadCompanyId");

-- CreateIndex
CREATE INDEX "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityChecklistItem_opportunityId_itemKey_key" ON "OpportunityChecklistItem"("opportunityId", "itemKey");

-- CreateIndex
CREATE INDEX "OpportunityStageChange_opportunityId_createdAt_idx" ON "OpportunityStageChange"("opportunityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_OppSupport_AB_unique" ON "_OppSupport"("A", "B");

-- CreateIndex
CREATE INDEX "_OppSupport_B_index" ON "_OppSupport"("B");
