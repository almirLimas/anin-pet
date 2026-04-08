ALTER TABLE "Cliente"
  ADD COLUMN "mensalista"    BOOLEAN         NOT NULL DEFAULT false,
  ADD COLUMN "valorMensal"   DECIMAL(10, 2),
  ADD COLUMN "diaVencimento" INTEGER;
