-- CreateTable
CREATE TABLE "FechamentoCaixa" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "totalVendas" DECIMAL(10,2) NOT NULL,
    "quantidadeVendas" INTEGER NOT NULL,
    "porFormaPagamento" JSONB NOT NULL,
    "observacoes" TEXT,
    "usuarioId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FechamentoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoCaixa_tenantId_data_key" ON "FechamentoCaixa"("tenantId", "data");

-- AddForeignKey
ALTER TABLE "FechamentoCaixa" ADD CONSTRAINT "FechamentoCaixa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoCaixa" ADD CONSTRAINT "FechamentoCaixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
