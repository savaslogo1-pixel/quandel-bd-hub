-- CreateTable
CREATE TABLE "GiftEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "state" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientContactId" TEXT,
    "orgId" TEXT,
    "giverId" TEXT NOT NULL,
    "approverId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GiftEntry_recipientContactId_fkey" FOREIGN KEY ("recipientContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GiftEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GiftEntry_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GiftEntry_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GiftEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LobbyingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "hours" DECIMAL NOT NULL,
    "expenses" DECIMAL NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "officials" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LobbyingEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Opportunity" (
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
    "approvalsDeadline" DATETIME,
    "approvalsBufferDays" INTEGER,
    "approvalsTemplate" TEXT,
    "guaranteeTermYears" INTEGER,
    "ipmvpOption" TEXT,
    "financingRatePct" DECIMAL,
    "nonEnergyCost" DECIMAL,
    "otherFunding" DECIMAL,
    "guaranteedSavingsOverride" DECIMAL,
    "tradeSecretsMarked" BOOLEAN NOT NULL DEFAULT false,
    "restrictedPeriod" BOOLEAN NOT NULL DEFAULT false,
    "designatedContacts" TEXT,
    "lostToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Opportunity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_leadCompanyId_fkey" FOREIGN KEY ("leadCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_goNoGoApproverId_fkey" FOREIGN KEY ("goNoGoApproverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_procIndependenceById_fkey" FOREIGN KEY ("procIndependenceById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_disclosureById_fkey" FOREIGN KEY ("disclosureById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_lostToId_fkey" FOREIGN KEY ("lostToId") REFERENCES "Competitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Opportunity" ("aeNoConflictCertAt", "approvalsBufferDays", "approvalsDeadline", "approvalsTemplate", "awardDate", "boardVoteDate", "competitors", "constructionStartDate", "createdAt", "createdById", "deliveryMethod", "disclosureAt", "disclosureById", "disclosureDecision", "disclosureNote", "dueDate", "estimatedValue", "financingRatePct", "goNoGo", "goNoGoApproverId", "goNoGoAt", "goNoGoReason", "guaranteeTermYears", "guaranteedSavingsOverride", "helpedWriteSpecs", "id", "interviewDate", "ipmvpOption", "leadCompanyId", "lossReason", "lostToId", "name", "nonEnergyCost", "nonEnergyScope", "orgId", "otherFunding", "outcome", "ownerId", "preBidDate", "probability", "procIndependenceAt", "procIndependenceById", "projectType", "quandelScopeValue", "rfqIssueDate", "stage", "stageEnteredAt", "substantialCompletionDate", "updatedAt", "winThemes") SELECT "aeNoConflictCertAt", "approvalsBufferDays", "approvalsDeadline", "approvalsTemplate", "awardDate", "boardVoteDate", "competitors", "constructionStartDate", "createdAt", "createdById", "deliveryMethod", "disclosureAt", "disclosureById", "disclosureDecision", "disclosureNote", "dueDate", "estimatedValue", "financingRatePct", "goNoGo", "goNoGoApproverId", "goNoGoAt", "goNoGoReason", "guaranteeTermYears", "guaranteedSavingsOverride", "helpedWriteSpecs", "id", "interviewDate", "ipmvpOption", "leadCompanyId", "lossReason", "lostToId", "name", "nonEnergyCost", "nonEnergyScope", "orgId", "otherFunding", "outcome", "ownerId", "preBidDate", "probability", "procIndependenceAt", "procIndependenceById", "projectType", "quandelScopeValue", "rfqIssueDate", "stage", "stageEnteredAt", "substantialCompletionDate", "updatedAt", "winThemes" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");
CREATE INDEX "Opportunity_orgId_idx" ON "Opportunity"("orgId");
CREATE INDEX "Opportunity_leadCompanyId_idx" ON "Opportunity"("leadCompanyId");
CREATE INDEX "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GiftEntry_date_idx" ON "GiftEntry"("date");

-- CreateIndex
CREATE INDEX "GiftEntry_giverId_idx" ON "GiftEntry"("giverId");

-- CreateIndex
CREATE INDEX "LobbyingEntry_jurisdiction_date_idx" ON "LobbyingEntry"("jurisdiction", "date");

