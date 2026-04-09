-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('Dinheiro', 'Cartao', 'Pix', 'Fiado', 'Outro');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('Concluida', 'Cancelada');

-- CreateEnum
CREATE TYPE "TipoItemVenda" AS ENUM ('Produto', 'Servico');

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusVenda" NOT NULL DEFAULT 'Concluida',
    "formaPagamento" "FormaPagamento" NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "desconto" DECIMAL(10,2),
    "valorPago" DECIMAL(10,2),
    "troco" DECIMAL(10,2),
    "observacoes" TEXT,
    "clienteId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" TEXT NOT NULL,
    "tipo" "TipoItemVenda" NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "produtoId" TEXT,
    "servicoId" TEXT,
    "vendaId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ItemVenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venda_tenantId_numero_key" ON "Venda"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
