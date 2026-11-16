-- CreateTable
CREATE TABLE "BidFeedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "county" TEXT,
    "location" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PA',
    "kind" TEXT NOT NULL,
    "typeLabel" TEXT,
    "estimatedValue" DECIMAL,
    "valueText" TEXT,
    "dueAt" DATETIME,
    "preBidAt" DATETIME,
    "preBidText" TEXT,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "why" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadCompanyId" TEXT,
    "opportunityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "BidFeedItem_leadCompanyId_fkey" FOREIGN KEY ("leadCompanyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BidFeedItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BidFeedItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BidFeedCompanies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BidFeedCompanies_A_fkey" FOREIGN KEY ("A") REFERENCES "BidFeedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BidFeedCompanies_B_fkey" FOREIGN KEY ("B") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BidFeedItem_externalKey_key" ON "BidFeedItem"("externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "BidFeedItem_opportunityId_key" ON "BidFeedItem"("opportunityId");

-- CreateIndex
CREATE INDEX "BidFeedItem_status_dueAt_idx" ON "BidFeedItem"("status", "dueAt");

-- CreateIndex
CREATE INDEX "BidFeedItem_kind_idx" ON "BidFeedItem"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "_BidFeedCompanies_AB_unique" ON "_BidFeedCompanies"("A", "B");

-- CreateIndex
CREATE INDEX "_BidFeedCompanies_B_index" ON "_BidFeedCompanies"("B");
