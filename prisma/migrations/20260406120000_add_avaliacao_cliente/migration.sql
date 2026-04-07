-- CreateTable
CREATE TABLE "AvaliacaoCliente" (
    "id" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "respondidaEm" TIMESTAMP(3),
    "agendamentoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoCliente_token_key" ON "AvaliacaoCliente"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoCliente_agendamentoId_key" ON "AvaliacaoCliente"("agendamentoId");

-- AddForeignKey
ALTER TABLE "AvaliacaoCliente" ADD CONSTRAINT "AvaliacaoCliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoCliente" ADD CONSTRAINT "AvaliacaoCliente_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoCliente" ADD CONSTRAINT "AvaliacaoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
