-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'TRAINEE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base" TEXT,
    "sells" TEXT,
    "buyers" TEXT,
    "procurementPaths" TEXT,
    "isParent" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PicklistValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "list" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Organization_parentOrgId_fkey" FOREIGN KEY ("parentOrgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_relationshipOwnerId_fkey" FOREIGN KEY ("relationshipOwnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "orgId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "decisionRole" TEXT,
    "function" TEXT,
    "relationshipStrength" INTEGER,
    "lastTouch" DATETIME,
    "nextTouch" DATETIME,
    "preferredChannel" TEXT,
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Contact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
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
    CONSTRAINT "Activity_financialAdvisorContactId_fkey" FOREIGN KEY ("financialAdvisorContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "ext_expires_in" INTEGER,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_UserCompanies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_UserCompanies_A_fkey" FOREIGN KEY ("A") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_UserCompanies_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_OrgCompanies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_OrgCompanies_A_fkey" FOREIGN KEY ("A") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_OrgCompanies_B_fkey" FOREIGN KEY ("B") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ContactInfluence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ContactInfluence_A_fkey" FOREIGN KEY ("A") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ContactInfluence_B_fkey" FOREIGN KEY ("B") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ActivityContacts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ActivityContacts_A_fkey" FOREIGN KEY ("A") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ActivityContacts_B_fkey" FOREIGN KEY ("B") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ActivityCompanies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ActivityCompanies_A_fkey" FOREIGN KEY ("A") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ActivityCompanies_B_fkey" FOREIGN KEY ("B") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "PicklistValue_list_active_sortOrder_idx" ON "PicklistValue"("list", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PicklistValue_list_value_key" ON "PicklistValue"("list", "value");

-- CreateIndex
CREATE INDEX "Organization_state_orgType_idx" ON "Organization"("state", "orgType");

-- CreateIndex
CREATE INDEX "Organization_tier_status_idx" ON "Organization"("tier", "status");

-- CreateIndex
CREATE INDEX "Organization_relationshipOwnerId_idx" ON "Organization"("relationshipOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_state_orgType_key" ON "Organization"("name", "state", "orgType");

-- CreateIndex
CREATE INDEX "Contact_orgId_idx" ON "Contact"("orgId");

-- CreateIndex
CREATE INDEX "Contact_nextTouch_idx" ON "Contact"("nextTouch");

-- CreateIndex
CREATE INDEX "Activity_orgId_occurredAt_idx" ON "Activity"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "Activity_nextStepDate_idx" ON "Activity"("nextStepDate");

-- CreateIndex
CREATE INDEX "Activity_createdById_idx" ON "Activity"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "_UserCompanies_AB_unique" ON "_UserCompanies"("A", "B");

-- CreateIndex
CREATE INDEX "_UserCompanies_B_index" ON "_UserCompanies"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_OrgCompanies_AB_unique" ON "_OrgCompanies"("A", "B");

-- CreateIndex
CREATE INDEX "_OrgCompanies_B_index" ON "_OrgCompanies"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ContactInfluence_AB_unique" ON "_ContactInfluence"("A", "B");

-- CreateIndex
CREATE INDEX "_ContactInfluence_B_index" ON "_ContactInfluence"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ActivityContacts_AB_unique" ON "_ActivityContacts"("A", "B");

-- CreateIndex
CREATE INDEX "_ActivityContacts_B_index" ON "_ActivityContacts"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ActivityCompanies_AB_unique" ON "_ActivityCompanies"("A", "B");

-- CreateIndex
CREATE INDEX "_ActivityCompanies_B_index" ON "_ActivityCompanies"("B");
