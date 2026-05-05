-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "pacoteClienteAtivoId" TEXT;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_pacoteClienteAtivoId_fkey" FOREIGN KEY ("pacoteClienteAtivoId") REFERENCES "PacoteClienteAtivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
