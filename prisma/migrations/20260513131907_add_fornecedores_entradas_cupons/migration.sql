-- CreateEnum
CREATE TYPE "StatusEntrada" AS ENUM ('Rascunho', 'Confirmada', 'Cancelada');

-- CreateEnum
CREATE TYPE "TipoCupom" AS ENUM ('Percentual', 'Fixo');

-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "entradaMercadoriaId" TEXT,
ADD COLUMN     "fornecedorId" TEXT;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "cupomCodigo" TEXT,
ADD COLUMN     "cupomDesconto" DECIMAL(10,2),
ADD COLUMN     "cupomId" TEXT;

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "contato" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntradaMercadoria" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusEntrada" NOT NULL DEFAULT 'Rascunho',
    "fornecedorId" TEXT,
    "observacoes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaMercadoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEntradaMercadoria" (
    "id" TEXT NOT NULL,
    "entradaMercadoriaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ItemEntradaMercadoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cupom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCupom" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "usoMaximo" INTEGER,
    "usoAtual" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "expiraEm" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_tenantId_cnpj_key" ON "Fornecedor"("tenantId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "EntradaMercadoria_tenantId_numero_key" ON "EntradaMercadoria"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_tenantId_codigo_key" ON "Cupom"("tenantId", "codigo");

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_entradaMercadoriaId_fkey" FOREIGN KEY ("entradaMercadoriaId") REFERENCES "EntradaMercadoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaMercadoria" ADD CONSTRAINT "EntradaMercadoria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaMercadoria" ADD CONSTRAINT "EntradaMercadoria_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntradaMercadoria" ADD CONSTRAINT "ItemEntradaMercadoria_entradaMercadoriaId_fkey" FOREIGN KEY ("entradaMercadoriaId") REFERENCES "EntradaMercadoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntradaMercadoria" ADD CONSTRAINT "ItemEntradaMercadoria_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntradaMercadoria" ADD CONSTRAINT "ItemEntradaMercadoria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
