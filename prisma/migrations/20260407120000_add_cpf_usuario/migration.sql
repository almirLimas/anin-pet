-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "cpf" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");
