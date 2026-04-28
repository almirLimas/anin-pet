-- CreateTable
CREATE TABLE "FeedbackNPS" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "token" TEXT NOT NULL,
    "respondidoEm" TIMESTAMP(3),
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackNPS_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackNPS_token_key" ON "FeedbackNPS"("token");

-- AddForeignKey
ALTER TABLE "FeedbackNPS" ADD CONSTRAINT "FeedbackNPS_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
