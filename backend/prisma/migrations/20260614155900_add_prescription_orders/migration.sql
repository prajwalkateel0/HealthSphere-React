-- CreateEnum
CREATE TYPE "PrescriptionOrderStatus" AS ENUM ('pending', 'approved', 'preparing', 'dispatched', 'delivered', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('collection', 'delivery');

-- CreateTable
CREATE TABLE "prescription_orders" (
    "id" SERIAL NOT NULL,
    "prescription_id" INTEGER NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "status" "PrescriptionOrderStatus" NOT NULL DEFAULT 'pending',
    "delivery_method" "DeliveryMethod" NOT NULL DEFAULT 'collection',
    "delivery_address" TEXT,
    "pharmacy_name" VARCHAR(150),
    "patient_notes" TEXT,
    "doctor_notes" TEXT,
    "estimated_ready" TIMESTAMP(3),
    "payment_intent_id" VARCHAR(255),
    "ordered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_orders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "prescription_orders" ADD CONSTRAINT "prescription_orders_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_orders" ADD CONSTRAINT "prescription_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_orders" ADD CONSTRAINT "prescription_orders_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
