-- DropForeignKey
ALTER TABLE "AvaliacaoCliente" DROP CONSTRAINT "AvaliacaoCliente_agendamentoId_fkey";

-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "taxaBusca" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "taxaBusca" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "AvaliacaoCliente" ADD CONSTRAINT "AvaliacaoCliente_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
