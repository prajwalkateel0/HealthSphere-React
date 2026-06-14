-- AlterTable
ALTER TABLE "health_metrics" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "wearable_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'google_fit',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "last_sync" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wearable_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wearable_tokens_user_id_provider_key" ON "wearable_tokens"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "wearable_tokens" ADD CONSTRAINT "wearable_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
