-- ── Multi-tenancy: Add Tenant model and tenantId to all domain models ──────

-- CreateTable: Tenant
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "plano" "Plano" NOT NULL DEFAULT 'basico',
    "status" "StatusUsuario" NOT NULL DEFAULT 'ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- Insert a default tenant for existing data (if any)
INSERT INTO "Tenant" ("id", "nome", "plano", "status", "updatedAt")
VALUES ('default-tenant-0000000000', 'Petshop Demo', 'basico', 'ativo', NOW());

-- AlterTable: Usuario — remove plano column, add tenantId
ALTER TABLE "Usuario" ADD COLUMN "tenantId" TEXT;
-- Assign existing users to the default tenant
UPDATE "Usuario" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Usuario" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "plano";

-- AlterTable: Cliente — drop old unique constraint on cpf (if exists), add tenantId, add compound uniques
ALTER TABLE "Cliente" DROP CONSTRAINT IF EXISTS "Cliente_cpf_key";
ALTER TABLE "Cliente" DROP CONSTRAINT IF EXISTS "Cliente_codigo_key";
ALTER TABLE "Cliente" ADD COLUMN "tenantId" TEXT;
UPDATE "Cliente" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Cliente" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Pet — add tenantId
ALTER TABLE "Pet" ADD COLUMN "tenantId" TEXT;
UPDATE "Pet" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Pet" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Servico — add tenantId
ALTER TABLE "Servico" ADD COLUMN "tenantId" TEXT;
UPDATE "Servico" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Servico" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Agendamento — add tenantId
ALTER TABLE "Agendamento" ADD COLUMN "tenantId" TEXT;
UPDATE "Agendamento" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Agendamento" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Lancamento — add tenantId
ALTER TABLE "Lancamento" ADD COLUMN "tenantId" TEXT;
UPDATE "Lancamento" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Lancamento" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Produto — add tenantId
ALTER TABLE "Produto" ADD COLUMN "tenantId" TEXT;
UPDATE "Produto" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Produto" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Movimentacao — add tenantId
ALTER TABLE "Movimentacao" ADD COLUMN "tenantId" TEXT;
UPDATE "Movimentacao" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Movimentacao" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Vacina — add tenantId
ALTER TABLE "Vacina" ADD COLUMN "tenantId" TEXT;
UPDATE "Vacina" SET "tenantId" = 'default-tenant-0000000000' WHERE "tenantId" IS NULL;
ALTER TABLE "Vacina" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex: unique constraints
CREATE UNIQUE INDEX "Cliente_tenantId_cpf_key" ON "Cliente"("tenantId", "cpf");
CREATE UNIQUE INDEX "Cliente_tenantId_codigo_key" ON "Cliente"("tenantId", "codigo");

-- AddForeignKey constraints
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vacina" ADD CONSTRAINT "Vacina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
