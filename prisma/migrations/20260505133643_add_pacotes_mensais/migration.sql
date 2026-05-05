-- CreateEnum
CREATE TYPE "StatusPacoteCliente" AS ENUM ('Ativo', 'Expirado', 'Cancelado');

-- CreateTable
CREATE TABLE "PacoteServico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "totalSessoes" INTEGER NOT NULL,
    "validadeDias" INTEGER NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacoteServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacoteClienteAtivo" (
    "id" TEXT NOT NULL,
    "pacoteId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "petId" TEXT,
    "tenantId" TEXT NOT NULL,
    "sessoesUsadas" INTEGER NOT NULL DEFAULT 0,
    "totalSessoes" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "StatusPacoteCliente" NOT NULL DEFAULT 'Ativo',
    "inicioEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "aviso3dEnviadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacoteClienteAtivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PacoteServico_tenantId_nome_key" ON "PacoteServico"("tenantId", "nome");

-- AddForeignKey
ALTER TABLE "PacoteServico" ADD CONSTRAINT "PacoteServico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteClienteAtivo" ADD CONSTRAINT "PacoteClienteAtivo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteClienteAtivo" ADD CONSTRAINT "PacoteClienteAtivo_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "PacoteServico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteClienteAtivo" ADD CONSTRAINT "PacoteClienteAtivo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteClienteAtivo" ADD CONSTRAINT "PacoteClienteAtivo_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
