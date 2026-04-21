-- CreateEnum
CREATE TYPE "StatusOrdemServico" AS ENUM ('Aberta', 'Concluida', 'Cancelada');

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "observacoes" TEXT,
    "status" "StatusOrdemServico" NOT NULL DEFAULT 'Aberta',
    "formaPagamento" "FormaPagamento",
    "desconto" DECIMAL(10,2),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOrdemServico" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "tipo" "TipoItemVenda" NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "precoUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "produtoId" TEXT,
    "servicoId" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ItemOrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_agendamentoId_key" ON "OrdemServico"("agendamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_tenantId_numero_key" ON "OrdemServico"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrdemServico" ADD CONSTRAINT "ItemOrdemServico_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrdemServico" ADD CONSTRAINT "ItemOrdemServico_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrdemServico" ADD CONSTRAINT "ItemOrdemServico_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOrdemServico" ADD CONSTRAINT "ItemOrdemServico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
