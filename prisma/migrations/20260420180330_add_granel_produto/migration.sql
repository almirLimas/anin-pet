/*
  Warnings:

  - You are about to alter the column `quantidade` on the `ItemOrdemServico` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,3)`.
  - You are about to alter the column `quantidade` on the `ItemVenda` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,3)`.
  - You are about to alter the column `quantidade` on the `Movimentacao` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,3)`.
  - You are about to alter the column `quantidadeAtual` on the `Produto` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,3)`.
  - You are about to alter the column `estoqueMinimo` on the `Produto` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,3)`.

*/
-- AlterTable
ALTER TABLE "ItemOrdemServico" ALTER COLUMN "quantidade" SET DEFAULT 1,
ALTER COLUMN "quantidade" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "ItemVenda" ALTER COLUMN "quantidade" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "Movimentacao" ALTER COLUMN "quantidade" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "granel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unidadeBase" TEXT,
ALTER COLUMN "quantidadeAtual" SET DEFAULT 0,
ALTER COLUMN "quantidadeAtual" SET DATA TYPE DECIMAL(10,3),
ALTER COLUMN "estoqueMinimo" SET DEFAULT 0,
ALTER COLUMN "estoqueMinimo" SET DATA TYPE DECIMAL(10,3);
