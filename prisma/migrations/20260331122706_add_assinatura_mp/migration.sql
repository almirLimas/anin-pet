-- CreateEnum
CREATE TYPE "AssinaturaStatus" AS ENUM ('trial', 'pendente', 'ativa', 'suspensa', 'cancelada');

-- DropIndex
DROP INDEX "Cliente_codigo_key";

-- DropIndex
DROP INDEX "Cliente_cpf_key";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "assinaturaStatus" "AssinaturaStatus" NOT NULL DEFAULT 'trial',
ADD COLUMN     "mpAssinaturaId" TEXT,
ADD COLUMN     "mpPagamentoId" TEXT,
ADD COLUMN     "trialExpiraEm" TIMESTAMP(3);
