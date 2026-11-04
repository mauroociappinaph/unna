-- AlterTable
ALTER TABLE "qr_charges" ALTER COLUMN "mpOrderId" DROP NOT NULL,
ALTER COLUMN "qrData" DROP NOT NULL;

-- AlterTable
ALTER TABLE "receipt_sequences" ADD COLUMN     "issuingReceiptId" TEXT,
ADD COLUMN     "issuingUntil" TIMESTAMP(3);

