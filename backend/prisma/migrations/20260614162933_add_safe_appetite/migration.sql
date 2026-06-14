-- AlterTable
ALTER TABLE "allergies" ADD COLUMN     "allergy_type" VARCHAR(50) NOT NULL DEFAULT 'food',
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ingredient_scans" ADD COLUMN     "ai_summary" TEXT,
ADD COLUMN     "tip" TEXT;

-- CreateTable
CREATE TABLE "food_intolerances" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "intolerance" VARCHAR(255) NOT NULL,
    "severity" "AllergenSeverity" NOT NULL DEFAULT 'moderate',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_intolerances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "preference" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diet_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_dislikes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ingredient" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_dislikes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "food_intolerances" ADD CONSTRAINT "food_intolerances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_preferences" ADD CONSTRAINT "diet_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_dislikes" ADD CONSTRAINT "ingredient_dislikes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
