-- AlterTable
ALTER TABLE "health_metrics" ADD COLUMN     "distance_km" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "google_fit_drive_imports" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "drive_file_id" VARCHAR(200) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "modified_time" VARCHAR(50),
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "latest_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_fit_drive_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_fit_drive_imports_user_id_drive_file_id_key" ON "google_fit_drive_imports"("user_id", "drive_file_id");

-- AddForeignKey
ALTER TABLE "google_fit_drive_imports" ADD CONSTRAINT "google_fit_drive_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
