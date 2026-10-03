-- Transpondeur + parcours (épreuve) + catégorie par vélo (fichier RaceResult d'O'Top), tapis ayant vu chaque passage.
ALTER TABLE "Dossard" ADD COLUMN "transponder" TEXT;
ALTER TABLE "Dossard" ADD COLUMN "contest" INTEGER;
ALTER TABLE "Dossard" ADD COLUMN "category" INTEGER;
CREATE UNIQUE INDEX "Dossard_transponder_key" ON "Dossard"("transponder");
ALTER TABLE "RaceLapEvent" ADD COLUMN "mats" TEXT[] DEFAULT ARRAY[]::TEXT[];
