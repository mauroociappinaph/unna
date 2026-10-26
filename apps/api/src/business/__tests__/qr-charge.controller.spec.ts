import 'reflect-metadata';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { QrChargeController } from '../qr-charge.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../../common/guards/business-owner.guard';
import type { QrChargeUseCase } from '../use-cases/qr-charge.use-case';
import { fake } from '../use-cases/__tests__/test-doubles';

const VIEW = { id: 'charge-1', orderId: 'order-1', amount: 100, status: 'pending', qrData: 'qr', expiresAt: 'x', paidAt: null, paymentRegistered: false, paymentError: null };

describe('QrChargeController (S15)', () => {
  it('guards every route with JWT and BusinessOwnerGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, QrChargeController)).toEqual([JwtAuthGuard, BusinessOwnerGuard]);
  });

  it('creates, reads and cancels the charges of the business of the route', async () => {
    const qrCharges = {
      create: jest.fn(async () => ({ ok: true, value: VIEW })),
      get: jest.fn(async () => ({ ok: true, value: VIEW })),
      cancel: jest.fn(async () => ({ ok: true, value: { ...VIEW, status: 'cancelled' } })),
    };
    const controller = new QrChargeController(fake<QrChargeUseCase>(qrCharges));

    await expect(controller.create('biz-A', 'order-1')).resolves.toEqual(VIEW);
    await expect(controller.get('biz-A', 'charge-1')).resolves.toEqual(VIEW);
    await expect(controller.cancel('biz-A', 'charge-1')).resolves.toMatchObject({ status: 'cancelled' });
    expect(qrCharges.create).toHaveBeenCalledWith('biz-A', 'order-1');
    expect(qrCharges.get).toHaveBeenCalledWith('biz-A', 'charge-1');
    expect(qrCharges.cancel).toHaveBeenCalledWith('biz-A', 'charge-1');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, QrChargeController.prototype.cancel)).toBe(200);
  });
});
