-- DropIndex
DROP INDEX "Bridge_name_county_state_key";

-- AlterTable
ALTER TABLE "Bridge" ADD COLUMN "importKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Bridge_importKey_key" ON "Bridge"("importKey");

-- CreateIndex
CREATE INDEX "Bridge_name_idx" ON "Bridge"("name");

