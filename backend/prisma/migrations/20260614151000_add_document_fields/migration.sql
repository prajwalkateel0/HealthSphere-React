-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "description" TEXT,
ADD COLUMN     "doc_type" VARCHAR(50) NOT NULL DEFAULT 'other',
ADD COLUMN     "file_name" VARCHAR(255);
