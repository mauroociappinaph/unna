-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "address" JSONB NOT NULL,
ADD COLUMN     "cuit" TEXT NOT NULL,
ADD COLUMN     "schedule" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "sucursales" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayTokenHash" TEXT,
    "displayTokenCreatedAt" TIMESTAMP(3),
    "mpStoreId" TEXT,
    "mpPosId" TEXT,
    "mpPosExternalId" TEXT,
    "qrImageUrl" TEXT,
    "qrTemplateUrl" TEXT,
    "mpProvisioningAt" TIMESTAMP(3),
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "basePrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "costPrice" INTEGER,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "sku" TEXT,
    "barcode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modifierGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "components" JSONB NOT NULL DEFAULT '[]',
    "preparationTimeMinutes" INTEGER,
    "calories" INTEGER,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_options" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minSelection" INTEGER NOT NULL DEFAULT 0,
    "maxSelection" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "validDays" INTEGER[],
    "validFromTime" TEXT,
    "validToTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_entries" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "unitCost" INTEGER,
    "totalCost" INTEGER,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "minThreshold" INTEGER NOT NULL DEFAULT 10,
    "maxThreshold" INTEGER,
    "reorderPoint" INTEGER NOT NULL DEFAULT 5,
    "reorderQuantity" INTEGER NOT NULL DEFAULT 20,
    "lastCountedAt" TIMESTAMP(3),
    "lastMovementAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tableNumber" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "deliveryAddress" JSONB,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "notes" TEXT,
    "sucursalName" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "taxAmount" INTEGER NOT NULL,
    "notes" TEXT,
    "modifiers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "cashSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "invoiceNumber" INTEGER,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "orderId" TEXT,
    "orderNumber" TEXT,
    "cae" TEXT,
    "caeExpiration" TIMESTAMP(3),
    "pointOfSale" TEXT NOT NULL,
    "receiptType" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentReference" TEXT,
    "customerName" TEXT,
    "customerTaxId" TEXT,
    "customerAddress" JSONB,
    "customerCondition" TEXT,
    "docType" INTEGER,
    "docNumber" TEXT,
    "ivaBreakdown" JSONB,
    "authorizationError" TEXT,
    "caeRequest" TEXT,
    "caeResponse" TEXT,
    "pdfUrl" TEXT,
    "qrCode" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "taxAmount" INTEGER NOT NULL,
    "modifiers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedBy" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingAmount" INTEGER NOT NULL,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "expected" JSONB,
    "declared" JSONB,
    "difference" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_sequences" (
    "businessId" TEXT NOT NULL,
    "pointOfSale" TEXT NOT NULL,
    "receiptType" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_sequences_pkey" PRIMARY KEY ("businessId","pointOfSale","receiptType")
);

-- CreateTable
CREATE TABLE "mercadopago_connections" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mpUserId" TEXT NOT NULL,
    "liveMode" BOOLEAN NOT NULL,
    "scope" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadopago_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercadopago_oauth_attempts" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "encryptedCodeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercadopago_oauth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_charges" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mpOrderId" TEXT NOT NULL,
    "mpPaymentId" TEXT,
    "qrData" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "paymentError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductModifierGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_displayTokenHash_key" ON "sucursales"("displayTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_mpPosExternalId_key" ON "sucursales"("mpPosExternalId");

-- CreateIndex
CREATE INDEX "categories_businessId_isActive_idx" ON "categories"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_businessId_isActive_idx" ON "products"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "products_businessId_categoryId_idx" ON "products"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "products_businessId_status_idx" ON "products"("businessId", "status");

-- CreateIndex
CREATE INDEX "modifier_groups_businessId_isActive_idx" ON "modifier_groups"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "price_lists_businessId_isActive_idx" ON "price_lists"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_entries_priceListId_productId_key" ON "price_list_entries"("priceListId", "productId");

-- CreateIndex
CREATE INDEX "stock_movements_businessId_productId_createdAt_idx" ON "stock_movements"("businessId", "productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_productId_key" ON "stock_levels"("productId");

-- CreateIndex
CREATE INDEX "stock_levels_businessId_idx" ON "stock_levels"("businessId");

-- CreateIndex
CREATE INDEX "orders_businessId_status_idx" ON "orders"("businessId", "status");

-- CreateIndex
CREATE INDEX "orders_businessId_sucursalId_createdAt_idx" ON "orders"("businessId", "sucursalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_businessId_orderNumber_key" ON "orders"("businessId", "orderNumber");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_cashSessionId_idx" ON "payments"("cashSessionId");

-- CreateIndex
CREATE INDEX "payments_businessId_status_createdAt_idx" ON "payments"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "receipts_businessId_status_createdAt_idx" ON "receipts"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "receipts_businessId_orderId_idx" ON "receipts"("businessId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_businessId_receiptNumber_key" ON "receipts"("businessId", "receiptNumber");

-- CreateIndex
CREATE INDEX "receipt_items_receiptId_idx" ON "receipt_items"("receiptId");

-- CreateIndex
CREATE INDEX "cash_sessions_businessId_sucursalId_status_idx" ON "cash_sessions"("businessId", "sucursalId", "status");

-- CreateIndex
CREATE INDEX "cash_movements_sessionId_idx" ON "cash_movements"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "mercadopago_connections_businessId_key" ON "mercadopago_connections"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "mercadopago_oauth_attempts_stateHash_key" ON "mercadopago_oauth_attempts"("stateHash");

-- CreateIndex
CREATE INDEX "mercadopago_oauth_attempts_expiresAt_idx" ON "mercadopago_oauth_attempts"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "qr_charges_mpOrderId_key" ON "qr_charges"("mpOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "qr_charges_paymentId_key" ON "qr_charges"("paymentId");

-- CreateIndex
CREATE INDEX "qr_charges_businessId_orderId_status_idx" ON "qr_charges"("businessId", "orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "_ProductModifierGroups_AB_unique" ON "_ProductModifierGroups"("A", "B");

-- CreateIndex
CREATE INDEX "_ProductModifierGroups_B_index" ON "_ProductModifierGroups"("B");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_cuit_key" ON "businesses"("cuit");

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_connections" ADD CONSTRAINT "mercadopago_connections_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_oauth_attempts" ADD CONSTRAINT "mercadopago_oauth_attempts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_charges" ADD CONSTRAINT "qr_charges_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_charges" ADD CONSTRAINT "qr_charges_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_charges" ADD CONSTRAINT "qr_charges_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_charges" ADD CONSTRAINT "qr_charges_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductModifierGroups" ADD CONSTRAINT "_ProductModifierGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductModifierGroups" ADD CONSTRAINT "_ProductModifierGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

