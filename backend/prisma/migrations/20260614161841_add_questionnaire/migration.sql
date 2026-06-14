-- CreateTable
CREATE TABLE "patient_questionnaire" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_questionnaire_answers" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "question_key" VARCHAR(100) NOT NULL,
    "answer" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_questionnaire_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_questionnaire_patient_id_key" ON "patient_questionnaire"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_questionnaire_answers_patient_id_question_key_key" ON "patient_questionnaire_answers"("patient_id", "question_key");

-- AddForeignKey
ALTER TABLE "patient_questionnaire" ADD CONSTRAINT "patient_questionnaire_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_questionnaire_answers" ADD CONSTRAINT "patient_questionnaire_answers_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
