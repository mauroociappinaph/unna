import type { QrChargeRecord } from '@unna/domain';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaQrChargeRepositoryAdapter } from '../qr-charge.repository.adapter';
import { PrismaQrChargeUnitOfWorkAdapter } from '../qr-charge-unit-of-work.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

const CHARGE: QrChargeRecord = {
  id: 'charge-1', businessId: 'biz-A', orderId: 'order-1', sucursalId: 'suc-1', amount: 12345, status: 'pending', mpOrderId: 'ORD1',
  mpPaymentId: null, qrData: 'qr', expiresAt: new Date('2026-10-25T12:15:00Z'), paidAt: null, paymentId: null, paymentError: null,
  createdAt: new Date('2026-10-25T12:00:00Z'),
};
const ROW = { ...CHARGE, updatedAt: new Date('2026-10-25T12:00:00Z') };

describe('PrismaQrChargeRepositoryAdapter (S15)', () => {
  it('scopes reads by id and by order to the business', async () => {
    const findFirst = jest.fn(async () => ROW);
    const findMany = jest.fn(async () => [ROW]);
    const adapter = new PrismaQrChargeRepositoryAdapter(fake<PrismaService>({ qrCharge: { findFirst, findMany } }));

    await expect(adapter.findById('biz-A', 'charge-1')).resolves.toEqual(CHARGE);
    await expect(adapter.findPendingByOrder('biz-A', 'order-1')).resolves.toEqual([CHARGE]);

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'charge-1', businessId: 'biz-A' } });
    expect(findMany).toHaveBeenCalledWith({ where: { businessId: 'biz-A', orderId: 'order-1', status: 'pending' }, orderBy: { createdAt: 'asc' } });
  });

  it('finds a charge by its unique Mercado Pago order id', async () => {
    const findUnique = jest.fn(async () => null);
    const adapter = new PrismaQrChargeRepositoryAdapter(fake<PrismaService>({ qrCharge: { findUnique } }));

    await expect(adapter.findByMpOrderId('ORD1')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { mpOrderId: 'ORD1' } });
  });

  it('creates the whole record and updates only the outcome fields, scoped to the business', async () => {
    const create = jest.fn(async () => ROW);
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const adapter = new PrismaQrChargeRepositoryAdapter(fake<PrismaService>({ qrCharge: { create, updateMany } }));
    const paid = { ...CHARGE, status: 'paid' as const, mpPaymentId: 'PAY1', paidAt: new Date('2026-10-25T12:01:00Z'), paymentId: 'pay-1' };

    await adapter.create(CHARGE);
    await adapter.update(paid);

    expect(create).toHaveBeenCalledWith({ data: CHARGE });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'charge-1', businessId: 'biz-A' },
      data: { status: 'paid', mpPaymentId: 'PAY1', paidAt: paid.paidAt, paymentId: 'pay-1', paymentError: null },
    });
  });
});

describe('PrismaQrChargeUnitOfWorkAdapter (S15)', () => {
  it('locks the order row first and binds the charges to the same transaction, with room for a Mercado Pago call', async () => {
    const calls: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async (sql: TemplateStringsArray) => { calls.push(sql.join('?')); return []; }),
      qrCharge: { findFirst: jest.fn(async () => { calls.push('qrCharge.findFirst'); return null; }) },
    };
    const $transaction = jest.fn(async (work: (client: unknown) => unknown) => work(tx));
    const unitOfWork = new PrismaQrChargeUnitOfWorkAdapter(fake<PrismaService>({ $transaction }));

    const result = await unitOfWork.withOrderLock('order-1', 'biz-A', async ({ qrCharges }) => qrCharges.findById('biz-A', 'charge-1'));

    expect(result).toBeNull();
    expect(calls[0]).toMatch(/SELECT id FROM orders WHERE id = \? AND "businessId" = \? FOR UPDATE/);
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual(['order-1', 'biz-A']);
    expect(calls[1]).toBe('qrCharge.findFirst');
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 30_000 });
  });
});
