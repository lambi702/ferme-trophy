-- Le modèle bonus/malus passe de "par équipe" à "par vélo" : les anciennes
-- lignes Purchase/RaceAdjustment (données de démo) sont incompatibles et
-- supprimées avant la migration (voir AGENTS.md, remise à zéro 2026-10-01).
DELETE FROM "RaceAdjustment";
DELETE FROM "Purchase";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_targetTeamId_fkey";

-- DropForeignKey
ALTER TABLE "RaceAdjustment" DROP CONSTRAINT "RaceAdjustment_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "RaceAdjustment" DROP CONSTRAINT "RaceAdjustment_teamId_fkey";

-- DropIndex
DROP INDEX "Purchase_targetTeamId_idx";

-- DropIndex
DROP INDEX "RaceAdjustment_teamId_idx";

-- AlterTable
ALTER TABLE "Dossard" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "PointsTransaction" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "performedBy" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Purchase" DROP COLUMN "targetTeamId",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "itemName" TEXT NOT NULL,
ADD COLUMN     "lapDelta" INTEGER NOT NULL,
ADD COLUMN     "performedBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "targetDossardId" TEXT NOT NULL,
ADD COLUMN     "type" "ItemType" NOT NULL,
ALTER COLUMN "itemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RaceAdjustment" DROP COLUMN "teamId",
ADD COLUMN     "dossardId" TEXT NOT NULL,
ADD COLUMN     "performedBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reason" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "RaceLapEvent" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Purchase_targetDossardId_idx" ON "Purchase"("targetDossardId");

-- CreateIndex
CREATE INDEX "RaceAdjustment_dossardId_idx" ON "RaceAdjustment"("dossardId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceLapEvent_externalId_key" ON "RaceLapEvent"("externalId");

-- CreateIndex
CREATE INDEX "RaceLapEvent_createdAt_idx" ON "RaceLapEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_targetDossardId_fkey" FOREIGN KEY ("targetDossardId") REFERENCES "Dossard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MarketplaceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceAdjustment" ADD CONSTRAINT "RaceAdjustment_dossardId_fkey" FOREIGN KEY ("dossardId") REFERENCES "Dossard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceAdjustment" ADD CONSTRAINT "RaceAdjustment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

