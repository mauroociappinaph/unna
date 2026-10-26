import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Address,
  FiscalDocType,
  FiscalIvaLine,
  Money,
  Page,
  PageRequest,
  Receipt,
  ReceiptItem,
  ReceiptRepositoryPort,
  ReceiptSummary,
  summarizeReceipt,
} from '@unna/domain';
import { cursorFields, keysetPage, mapPage, NEWEST_FIRST } from './keyset-page';

const money = (cents: number) => Money.fromCents(cents, 'ARS');

/** Address columns hold the fields written from an Address value object; rebuild it on read. */
const toAddress = (json: Prisma.JsonValue | null): Address | undefined =>
  json ? Address.create(json as unknown as Parameters<typeof Address.create>[0]) : undefined;

/** The root client or the client of an open interactive transaction. */
type Db = Prisma.TransactionClient;
/** Runs a batch of writes so they commit together. */
type AtomicWrites = (writes: Prisma.PrismaPromise<unknown>[]) => Promise<unknown>;

/** Inside an open transaction the writes already commit together; run them in order. */
export const inOpenTransaction: AtomicWrites = async (writes) => {
  for (const write of writes) await write;
};

type ReceiptRow = Prisma.ReceiptGetPayload<object>;
type ReceiptRecord = Prisma.ReceiptGetPayload<{ include: { items: true } }>;
type ReceiptFields = Parameters<typeof summarizeReceipt>[0];
/** The list counts the items instead of loading them (S17). */
const withItemCount = { _count: { select: { items: true } } } satisfies Prisma.ReceiptInclude;
type LineModifiers = ReceiptItem['modifiers'];

/** Receipts with their fiscal fields (number, customer document, IVA per rate, ARCA outcome). */
export class PrismaReceiptRepository implements ReceiptRepositoryPort {
  constructor(
    private readonly db: Db,
    private readonly atomically: AtomicWrites,
  ) {}

  async save(receipt: Receipt): Promise<void> {
    const data = {
      businessId: receipt.businessId,
      sucursalId: receipt.sucursalId,
      receiptNumber: receipt.receiptNumber,
      invoiceNumber: receipt.invoiceNumber ?? null,
      type: receipt.type,
      status: receipt.status,
      orderId: receipt.orderId ?? null,
      orderNumber: receipt.orderNumber ?? null,
      cae: receipt.cae ?? null,
      caeExpiration: receipt.caeExpiration ?? null,
      pointOfSale: receipt.pointOfSale,
      receiptType: receipt.receiptType,
      subtotal: receipt.subtotal.toCents(),
      taxAmount: receipt.taxAmount.toCents(),
      discountAmount: receipt.discountAmount.toCents(),
      totalAmount: receipt.totalAmount.toCents(),
      paymentMethod: receipt.paymentMethod,
      paymentReference: receipt.paymentReference ?? null,
      customerName: receipt.customerName ?? null,
      customerTaxId: receipt.customerTaxId ?? null,
      customerAddress: receipt.customerAddress ? { ...receipt.customerAddress } : undefined,
      customerCondition: receipt.customerCondition ?? null,
      docType: receipt.docType ?? null,
      docNumber: receipt.docNumber ?? null,
      ivaBreakdown: receipt.ivaBreakdown.map((line) => ({ rate: line.rate, base: line.base, amount: line.amount })),
      authorizationError: receipt.authorizationError ?? null,
      caeRequest: receipt.caeRequest ?? null,
      caeResponse: receipt.caeResponse ?? null,
      pdfUrl: receipt.pdfUrl ?? null,
      qrCode: receipt.qrCode ?? null,
      notes: receipt.notes ?? null,
      issuedAt: receipt.issuedAt ?? null,
      cancelledAt: receipt.cancelledAt ?? null,
      cancelledReason: receipt.cancelledReason ?? null,
    };
    await this.atomically([
      this.db.receipt.upsert({
        where: { id: receipt.id },
        create: { id: receipt.id, ...data, createdAt: receipt.createdAt },
        update: data,
      }),
      this.db.receiptItem.deleteMany({ where: { receiptId: receipt.id } }),
      this.db.receiptItem.createMany({
        data: receipt.items.map((i) => ({
          id: i.id,
          receiptId: receipt.id,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? null,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toCents(),
          totalPrice: i.totalPrice.toCents(),
          taxRate: i.taxRate,
          taxAmount: i.taxAmount.toCents(),
          modifiers: i.modifiers,
          createdAt: i.createdAt,
        })),
      }),
    ]);
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<Receipt | null> {
    const record = await this.db.receipt.findFirst({ where: { id, businessId }, include: { items: true } });
    return record ? this.toDomain(record) : null;
  }

  async findByOrderId(orderId: string): Promise<Receipt[]> {
    const records = await this.db.receipt.findMany({ where: { orderId }, include: { items: true } });
    return records.map((r) => this.toDomain(r));
  }

  async findPageByBusinessId(businessId: string, page: PageRequest): Promise<Page<ReceiptSummary> | null> {
    const rows = await keysetPage(
      page,
      (id) => this.db.receipt.findFirst({ where: { id, businessId }, select: cursorFields }),
      (after, take) =>
        this.db.receipt.findMany({ where: { AND: after ? [{ businessId }, after] : [{ businessId }] }, include: withItemCount, orderBy: NEWEST_FIRST, take }),
    );
    return mapPage(rows, (r) => summarizeReceipt(this.toFields(r), r._count.items));
  }

  private toDomain(r: ReceiptRecord): Receipt {
    return Receipt.reconstitute({
      ...this.toFields(r),
      items: (r.items ?? []).map((i) =>
        ReceiptItem.reconstitute({
          id: i.id,
          receiptId: i.receiptId,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? undefined,
          quantity: i.quantity,
          unitPrice: money(i.unitPrice),
          totalPrice: money(i.totalPrice),
          taxRate: i.taxRate,
          taxAmount: money(i.taxAmount),
          modifiers: (i.modifiers as LineModifiers | null) ?? [],
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        }),
      ),
    });
  }

  // Stored type, status, document type and IVA lines were written from the domain values, so they are valid.
  private toFields(r: ReceiptRow): ReceiptFields {
    return {
      id: r.id,
      businessId: r.businessId,
      sucursalId: r.sucursalId,
      receiptNumber: r.receiptNumber,
      invoiceNumber: r.invoiceNumber ?? undefined,
      type: r.type as Receipt['type'],
      status: r.status as Receipt['status'],
      orderId: r.orderId ?? undefined,
      orderNumber: r.orderNumber ?? undefined,
      cae: r.cae ?? undefined,
      caeExpiration: r.caeExpiration ?? undefined,
      pointOfSale: r.pointOfSale,
      receiptType: r.receiptType,
      subtotal: money(r.subtotal),
      taxAmount: money(r.taxAmount),
      discountAmount: money(r.discountAmount),
      totalAmount: money(r.totalAmount),
      paymentMethod: r.paymentMethod,
      paymentReference: r.paymentReference ?? undefined,
      customerName: r.customerName ?? undefined,
      customerTaxId: r.customerTaxId ?? undefined,
      customerAddress: toAddress(r.customerAddress),
      customerCondition: r.customerCondition ?? undefined,
      docType: (r.docType ?? undefined) as FiscalDocType | undefined,
      docNumber: r.docNumber ?? undefined,
      ivaBreakdown: (r.ivaBreakdown as FiscalIvaLine[] | null) ?? [],
      authorizationError: r.authorizationError ?? undefined,
      caeRequest: r.caeRequest ?? undefined,
      caeResponse: r.caeResponse ?? undefined,
      pdfUrl: r.pdfUrl ?? undefined,
      qrCode: r.qrCode ?? undefined,
      notes: r.notes ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      issuedAt: r.issuedAt ?? undefined,
      cancelledAt: r.cancelledAt ?? undefined,
      cancelledReason: r.cancelledReason ?? undefined,
    };
  }
}

@Injectable()
export class PrismaFiscalReceiptRepositoryAdapter extends PrismaReceiptRepository {
  constructor(prisma: PrismaService) {
    super(prisma, (writes) => prisma.$transaction(writes));
  }
}
