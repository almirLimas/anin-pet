-- CreateEnum
CREATE TYPE "ModalidadeAgendamento" AS ENUM ('ClienteTraz', 'PetshopBusca');

-- AlterEnum
ALTER TYPE "StatusAgendamento" ADD VALUE 'NaoCompareceu';

-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "modalidade" "ModalidadeAgendamento" NOT NULL DEFAULT 'ClienteTraz';
