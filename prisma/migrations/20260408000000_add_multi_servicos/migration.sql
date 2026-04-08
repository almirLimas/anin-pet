-- CreateTable
CREATE TABLE "AgendamentoServico" (
    "agendamentoId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,

    CONSTRAINT "AgendamentoServico_pkey" PRIMARY KEY ("agendamentoId","servicoId")
);

-- AddForeignKey
ALTER TABLE "AgendamentoServico" ADD CONSTRAINT "AgendamentoServico_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoServico" ADD CONSTRAINT "AgendamentoServico_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MigrateData: copy existing single-service FK into junction table
INSERT INTO "AgendamentoServico" ("agendamentoId", "servicoId")
SELECT id, "servicoId" FROM "Agendamento";

-- AlterTable: drop old single-service FK column
ALTER TABLE "Agendamento" DROP COLUMN "servicoId";
