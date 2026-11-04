-- AlterTable
ALTER TABLE "sucursales" ADD COLUMN     "preorderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preorderSlug" TEXT;

-- CreateTable
CREATE TABLE "online_checkouts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "sucursalName" TEXT NOT NULL,
    "trackingTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "customerName" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "mpOrderId" TEXT,
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "orderId" TEXT,
    "paymentId" TEXT,
    "mpPaymentId" TEXT,
    "paymentError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "online_checkouts_trackingTokenHash_key" ON "online_checkouts"("trackingTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "online_checkouts_mpOrderId_key" ON "online_checkouts"("mpOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "online_checkouts_orderId_key" ON "online_checkouts"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "online_checkouts_paymentId_key" ON "online_checkouts"("paymentId");

-- CreateIndex
CREATE INDEX "online_checkouts_businessId_status_createdAt_idx" ON "online_checkouts"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_preorderSlug_key" ON "sucursales"("preorderSlug");

-- AddForeignKey
ALTER TABLE "online_checkouts" ADD CONSTRAINT "online_checkouts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_checkouts" ADD CONSTRAINT "online_checkouts_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_checkouts" ADD CONSTRAINT "online_checkouts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_checkouts" ADD CONSTRAINT "online_checkouts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

