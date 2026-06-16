-- CreateEnum
CREATE TYPE "ExerciseIntensity" AS ENUM ('low', 'moderate', 'high');

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "log_date" DATE NOT NULL,
    "exercise_type" VARCHAR(100) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "calories_burned" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "intensity" "ExerciseIntensity" NOT NULL DEFAULT 'moderate',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "payment_type" VARCHAR(20) NOT NULL,
    "stripe_payment_intent_id" VARCHAR(100) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'gbp',
    "status" VARCHAR(30) NOT NULL DEFAULT 'succeeded',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
