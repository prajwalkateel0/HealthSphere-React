-- AlterTable: add extra nutrition fields to food_database
ALTER TABLE "food_database"
  ADD COLUMN "category"          VARCHAR(100),
  ADD COLUMN "sugar"             DECIMAL(6,2),
  ADD COLUMN "sodium"            DECIMAL(7,2),
  ADD COLUMN "avoid_if"         TEXT,
  ADD COLUMN "vitamins_minerals" TEXT,
  ADD COLUMN "portion_size"      VARCHAR(100);
