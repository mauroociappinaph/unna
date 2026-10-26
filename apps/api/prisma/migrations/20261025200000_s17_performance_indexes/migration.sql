-- CreateIndex
CREATE INDEX "cash_sessions_businessId_createdAt_idx" ON "cash_sessions"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "orders_businessId_paymentStatus_createdAt_idx" ON "orders"("businessId", "paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "orders_businessId_createdAt_idx" ON "orders"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "receipts_orderId_idx" ON "receipts"("orderId");

-- CreateIndex
CREATE INDEX "receipts_businessId_createdAt_idx" ON "receipts"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_businessId_createdAt_idx" ON "stock_movements"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

