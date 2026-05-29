-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "whatsappEnviarConfirmacao" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "whatsappEnviarLembrete" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "whatsappEnviarAvaliacao" BOOLEAN NOT NULL DEFAULT true;
