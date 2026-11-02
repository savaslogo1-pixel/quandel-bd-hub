-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "annualKwh" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "annualTherms" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "annualUtilitySpend" DECIMAL;
ALTER TABLE "Organization" ADD COLUMN "baselineYears" TEXT;
ALTER TABLE "Organization" ADD COLUMN "eui" DECIMAL;
ALTER TABLE "Organization" ADD COLUMN "utilityAccounts" TEXT;

-- CreateTable
CREATE TABLE "EnergyMeasure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "cost" DECIMAL,
    "annualSavings" DECIMAL,
    "annualKwhSaved" INTEGER,
    "annualThermsSaved" INTEGER,
    "electivePayEligible" BOOLEAN NOT NULL DEFAULT false,
    "electivePayAmount" DECIMAL,
    "usefulLifeYears" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "EnergyMeasure_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MvReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "dueDate" DATETIME,
    "guaranteedSavings" DECIMAL,
    "actualSavings" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "MvReport_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bridge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "structureId" TEXT,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PA',
    "county" TEXT NOT NULL,
    "municipality" TEXT,
    "ownerName" TEXT,
    "ownerVerified" BOOLEAN NOT NULL DEFAULT false,
    "ownerOrgId" TEXT,
    "routeType" TEXT,
    "condition" TEXT,
    "yearBuilt" INTEGER,
    "lengthFt" DECIMAL,
    "widthFt" DECIMAL,
    "bridgeType" TEXT,
    "adt" INTEGER,
    "bundleCandidate" BOOLEAN,
    "status" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "importBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bridge_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BridgeBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PA',
    "status" TEXT NOT NULL DEFAULT 'concept',
    "notes" TEXT,
    "unitCostPerSqFt" DECIMAL,
    "designPct" DECIMAL,
    "cmPct" DECIMAL,
    "contingencyPct" DECIMAL,
    "opportunityId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BridgeBundle_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BridgeBundle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleBridge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "bridgeId" TEXT NOT NULL,
    "estimate" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundleBridge_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "BridgeBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleBridge_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "Bridge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "projectType" TEXT,
    "deliveryMethod" TEXT,
    "value" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startYear" INTEGER,
    "completionYear" INTEGER,
    "referenceContactId" TEXT,
    "results" TEXT,
    "annualSavingsAchieved" DECIMAL,
    "photoUrls" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_referenceContactId_fkey" FOREIGN KEY ("referenceContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "kind" TEXT,
    "website" TEXT,
    "headquarters" TEXT,
    "ownership" TEXT,
    "profile" TEXT,
    "pricingNotes" TEXT,
    "howTheyWin" TEXT,
    "ourResponse" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompetitorProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitorId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "county" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PA',
    "orgId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "when" TEXT,
    "year" INTEGER,
    "value" DECIMAL,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompetitorProject_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompetitorProject_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ProjectCompanies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ProjectCompanies_A_fkey" FOREIGN KEY ("A") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ProjectCompanies_B_fkey" FOREIGN KEY ("B") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CompetitorRivals" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CompetitorRivals_A_fkey" FOREIGN KEY ("A") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CompetitorRivals_B_fkey" FOREIGN KEY ("B") REFERENCES "Competitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_OppCompetitors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_OppCompetitors_A_fkey" FOREIGN KEY ("A") REFERENCES "Competitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_OppCompetitors_B_fkey" FOREIGN KEY ("B") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
INSERT INTO "new_Opportunity" ("aeNoConflictCertAt", "approvalsBufferDays", "approvalsDeadline", "approvalsTemplate", "awardDate", "boardVoteDate", "competitors", "constructionStartDate", "createdAt", "createdById", "deliveryMethod", "disclosureAt", "disclosureById", "disclosureDecision", "disclosureNote", "dueDate", "estimatedValue", "goNoGo", "goNoGoApproverId", "goNoGoAt", "goNoGoReason", "helpedWriteSpecs", "id", "interviewDate", "leadCompanyId", "lossReason", "name", "nonEnergyScope", "orgId", "outcome", "ownerId", "preBidDate", "probability", "procIndependenceAt", "procIndependenceById", "projectType", "quandelScopeValue", "rfqIssueDate", "stage", "stageEnteredAt", "substantialCompletionDate", "updatedAt", "winThemes") SELECT "aeNoConflictCertAt", "approvalsBufferDays", "approvalsDeadline", "approvalsTemplate", "awardDate", "boardVoteDate", "competitors", "constructionStartDate", "createdAt", "createdById", "deliveryMethod", "disclosureAt", "disclosureById", "disclosureDecision", "disclosureNote", "dueDate", "estimatedValue", "goNoGo", "goNoGoApproverId", "goNoGoAt", "goNoGoReason", "helpedWriteSpecs", "id", "interviewDate", "leadCompanyId", "lossReason", "name", "nonEnergyScope", "orgId", "outcome", "ownerId", "preBidDate", "probability", "procIndependenceAt", "procIndependenceById", "projectType", "quandelScopeValue", "rfqIssueDate", "stage", "stageEnteredAt", "substantialCompletionDate", "updatedAt", "winThemes" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");
CREATE INDEX "Opportunity_orgId_idx" ON "Opportunity"("orgId");
CREATE INDEX "Opportunity_leadCompanyId_idx" ON "Opportunity"("leadCompanyId");
CREATE INDEX "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MvReport_opportunityId_year_key" ON "MvReport"("opportunityId", "year");

-- CreateIndex
CREATE INDEX "Bridge_county_idx" ON "Bridge"("county");

-- CreateIndex
CREATE UNIQUE INDEX "Bridge_name_county_state_key" ON "Bridge"("name", "county", "state");

-- CreateIndex
CREATE UNIQUE INDEX "BundleBridge_bundleId_bridgeId_key" ON "BundleBridge"("bundleId", "bridgeId");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_key_key" ON "Competitor"("key");

-- CreateIndex
CREATE INDEX "CompetitorProject_orgId_idx" ON "CompetitorProject"("orgId");

-- CreateIndex
CREATE INDEX "CompetitorProject_competitorId_idx" ON "CompetitorProject"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectCompanies_AB_unique" ON "_ProjectCompanies"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectCompanies_B_index" ON "_ProjectCompanies"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompetitorRivals_AB_unique" ON "_CompetitorRivals"("A", "B");

-- CreateIndex
CREATE INDEX "_CompetitorRivals_B_index" ON "_CompetitorRivals"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_OppCompetitors_AB_unique" ON "_OppCompetitors"("A", "B");

-- CreateIndex
CREATE INDEX "_OppCompetitors_B_index" ON "_OppCompetitors"("B");
