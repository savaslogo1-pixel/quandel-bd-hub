-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "target" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sheetNames" TEXT NOT NULL,
    "sheetName" TEXT,
    "headerRow" INTEGER NOT NULL DEFAULT 1,
    "headers" TEXT NOT NULL,
    "rows" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "mapping" TEXT,
    "defaults" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "committedAt" DATETIME,
    "undoneAt" DATETIME,
    "fileData" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orgType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "county" TEXT,
    "region" TEXT,
    "address" TEXT,
    "website" TEXT,
    "parentOrgId" TEXT,
    "arcCounty" BOOLEAN NOT NULL DEFAULT false,
    "energyCommunity" BOOLEAN NOT NULL DEFAULT false,
    "opportunityZoneTract" BOOLEAN NOT NULL DEFAULT false,
    "disadvantagedCommunity" BOOLEAN NOT NULL DEFAULT false,
    "fiscalStressStatus" TEXT,
    "population" INTEGER,
    "enrollment" INTEGER,
    "annualBudget" DECIMAL,
    "fiscalYearStart" TEXT,
    "debtOutstanding" DECIMAL,
    "debtLimit" DECIMAL,
    "recentBondIssues" TEXT,
    "creditRating" TEXT,
    "taxCapOverrideHistory" TEXT,
    "buildingCount" INTEGER,
    "oldestBuildingYear" INTEGER,
    "lastMajorRenovationYear" INTEGER,
    "lastEnergyProjectYear" INTEGER,
    "lastEnergyProjectEsco" TEXT,
    "capitalPlanUrl" TEXT,
    "capitalPlanDate" DATETIME,
    "buildingConditionSurveyDate" DATETIME,
    "governingBody" TEXT,
    "meetingWeekday" INTEGER,
    "meetingWeeksOfMonth" TEXT,
    "meetingPatternNote" TEXT,
    "agendaDeadlineDays" INTEGER,
    "voteRules" TEXT,
    "permissiveReferendum" BOOLEAN NOT NULL DEFAULT false,
    "relationshipOwnerId" TEXT,
    "tier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TARGET',
    "source" TEXT,
    "importBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Organization_parentOrgId_fkey" FOREIGN KEY ("parentOrgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_relationshipOwnerId_fkey" FOREIGN KEY ("relationshipOwnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Organization" ("address", "agendaDeadlineDays", "annualBudget", "arcCounty", "buildingConditionSurveyDate", "buildingCount", "capitalPlanDate", "capitalPlanUrl", "county", "createdAt", "createdById", "creditRating", "debtLimit", "debtOutstanding", "disadvantagedCommunity", "energyCommunity", "enrollment", "fiscalStressStatus", "fiscalYearStart", "governingBody", "id", "lastEnergyProjectEsco", "lastEnergyProjectYear", "lastMajorRenovationYear", "meetingPatternNote", "meetingWeekday", "meetingWeeksOfMonth", "name", "oldestBuildingYear", "opportunityZoneTract", "orgType", "parentOrgId", "permissiveReferendum", "population", "recentBondIssues", "region", "relationshipOwnerId", "source", "state", "status", "taxCapOverrideHistory", "tier", "updatedAt", "voteRules", "website") SELECT "address", "agendaDeadlineDays", "annualBudget", "arcCounty", "buildingConditionSurveyDate", "buildingCount", "capitalPlanDate", "capitalPlanUrl", "county", "createdAt", "createdById", "creditRating", "debtLimit", "debtOutstanding", "disadvantagedCommunity", "energyCommunity", "enrollment", "fiscalStressStatus", "fiscalYearStart", "governingBody", "id", "lastEnergyProjectEsco", "lastEnergyProjectYear", "lastMajorRenovationYear", "meetingPatternNote", "meetingWeekday", "meetingWeeksOfMonth", "name", "oldestBuildingYear", "opportunityZoneTract", "orgType", "parentOrgId", "permissiveReferendum", "population", "recentBondIssues", "region", "relationshipOwnerId", "source", "state", "status", "taxCapOverrideHistory", "tier", "updatedAt", "voteRules", "website" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE INDEX "Organization_state_orgType_idx" ON "Organization"("state", "orgType");
CREATE INDEX "Organization_tier_status_idx" ON "Organization"("tier", "status");
CREATE INDEX "Organization_relationshipOwnerId_idx" ON "Organization"("relationshipOwnerId");
CREATE UNIQUE INDEX "Organization_name_state_orgType_key" ON "Organization"("name", "state", "orgType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
