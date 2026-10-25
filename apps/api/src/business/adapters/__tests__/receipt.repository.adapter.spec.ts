import { Money, Receipt } from '@unna/domain';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaFiscalReceiptRepositoryAdapter } from '../receipt.repository.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

type Row = Record<string, unknown> & { id: string };

/** Just enough of the Prisma client to store receipts and their items in memory. */
const fakePrisma = () => {
  const receipts: Row[] = [];
  const items: Row[] = [];
  const now = new Date('2026-10-25T12:00:00Z');
  const withItems = (r: Row) => ({ ...r, updatedAt: now, items: items.filter((i) => i.receiptId === r.id).map((i) => ({ ...i, updatedAt: now })) });
  const prisma = {
    receipt: {
      upsert: async ({ where, create, update }: { where: { id: string }; create: Row; update: Row }) => {
        const index = receipts.findIndex((r) => r.id === where.id);
        if (index >= 0) receipts[index] = { ...receipts[index], ...update };
        else receipts.push(create);
      },
      findFirst: async ({ where }: { where: { id: string; businessId: string } }) => {
        const found = receipts.find((r) => r.id === where.id && r.businessId === where.businessId);
        return found ? withItems(found) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        receipts.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)).map(withItems),
    },
    receiptItem: {
      deleteMany: async ({ where }: { where: { receiptId: string } }) => {
        for (let i = items.length - 1; i >= 0; i--) if (items[i].receiptId === where.receiptId) items.splice(i, 1);
      },
      createMany: async ({ data }: { data: Row[] }) => {
        items.push(...data);
      },
    },
    $transaction: async (writes: Promise<unknown>[]) => {
      for (const write of writes) await write;
    },
  };
  return { prisma: fake<PrismaService>(prisma), receipts };
};

const draftA = () => {
  const unitPrice = Money.fromCents(1000);
  return Receipt.create({
    businessId: 'biz-A',
    sucursalId: 'suc-1',
    type: 'A',
    receiptType: 'A',
    orderId: 'order-1',
    pointOfSale: '0003',
    paymentMethod: 'cash',
    customerTaxId: '20123456786',
    customerCondition: 'responsable_inscripto',
    docType: 80,
    docNumber: '20123456786',
    discountAmount: Money.fromCents(100),
    items: [
      { productId: 'p1', productName: 'Café', quantity: 1, unitPrice, totalPrice: unitPrice, taxRate: 21, taxAmount: unitPrice.percentage(21), modifiers: [] },
      { productId: 'p2', productName: 'Medialuna', quantity: 1, unitPrice, totalPrice: unitPrice, taxRate: 10.5, taxAmount: unitPrice.percentage(10.5), modifiers: [] },
    ],
  });
};

describe('PrismaFiscalReceiptRepositoryAdapter', () => {
  it('stores and reads back the fiscal fields of an authorized receipt', async () => {
    const { prisma, receipts } = fakePrisma();
    const repository = new PrismaFiscalReceiptRepositoryAdapter(prisma);
    const issued = draftA().authorize({
      number: 42,
      cae: '70003010000042',
      caeExpiration: new Date('2026-11-04T00:00:00Z'),
      qrCode: 'https://www.afip.gob.ar/fe/qr/?p=e30=',
      caeResponse: '<raw/>',
    });

    await repository.save(issued);
    const read = await repository.findByIdAndBusinessId(issued.id, 'biz-A');

    expect(receipts[0]).toMatchObject({ receiptNumber: 'A-0003-00000042', invoiceNumber: 42, docType: 80, docNumber: '20123456786', authorizationError: null });
    expect(read).toMatchObject({
      status: 'issued',
      receiptNumber: 'A-0003-00000042',
      invoiceNumber: 42,
      docType: 80,
      docNumber: '20123456786',
      ivaBreakdown: issued.ivaBreakdown,
      cae: '70003010000042',
      caeExpiration: new Date('2026-11-04T00:00:00Z'),
      qrCode: issued.qrCode,
      authorizationError: undefined,
    });
    expect(read!.netAmount.toCents()).toBe(issued.netAmount.toCents());
    expect(read!.ivaAmount.toCents()).toBe(issued.ivaAmount.toCents());
    expect(read!.items.map((i) => i.taxRate)).toEqual([21, 10.5]);
  });

  it('keeps a draft with its authorization error and no number, and finds it by order', async () => {
    const { prisma, receipts } = fakePrisma();
    const repository = new PrismaFiscalReceiptRepositoryAdapter(prisma);
    const draft = draftA().failAuthorization('ARCA no respondió: timeout');

    await repository.save(draft);
    const [read] = await repository.findByOrderId('order-1');

    expect(receipts[0]).toMatchObject({ receiptNumber: `BORRADOR-${draft.id}`, invoiceNumber: null, status: 'draft' });
    expect(read).toMatchObject({ id: draft.id, status: 'draft', invoiceNumber: undefined, authorizationError: 'ARCA no respondió: timeout' });
    expect(await repository.findByIdAndBusinessId(draft.id, 'biz-B')).toBeNull();
  });
});
