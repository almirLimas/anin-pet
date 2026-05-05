-- CreateTable
CREATE TABLE "_PacoteServicos" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PacoteServicos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PacoteServicos_B_index" ON "_PacoteServicos"("B");

-- AddForeignKey
ALTER TABLE "_PacoteServicos" ADD CONSTRAINT "_PacoteServicos_A_fkey" FOREIGN KEY ("A") REFERENCES "PacoteServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PacoteServicos" ADD CONSTRAINT "_PacoteServicos_B_fkey" FOREIGN KEY ("B") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
