-- AlterTable
ALTER TABLE "FechamentoCaixa" ADD COLUMN     "porFormaAgendamentos" JSONB,
ADD COLUMN     "porFormaPdv" JSONB,
ADD COLUMN     "qtdAgendamentos" INTEGER,
ADD COLUMN     "qtdPdv" INTEGER,
ADD COLUMN     "totalAgendamentos" DECIMAL(10,2),
ADD COLUMN     "totalPdv" DECIMAL(10,2);
