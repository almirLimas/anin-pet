-- CreateEnum
CREATE TYPE "StatusGaiola" AS ENUM ('Aguardando', 'EmBanho', 'Secando', 'AguardandoBusca', 'AguardandoCliente', 'Pronto', 'Entregue');

-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN IF NOT EXISTS "gaiola" INTEGER;
ALTER TABLE "Agendamento" ADD COLUMN IF NOT EXISTS "statusGaiola" "StatusGaiola";
