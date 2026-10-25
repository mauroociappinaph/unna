import 'reflect-metadata';
import { createHash } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA, HEADERS_METADATA } from '@nestjs/common/constants';
import { BoardOrder, BoardSucursal, OrderBoardRepositoryPort, OrderStatus } from '@unna/domain';
import { OrderBoardUseCase } from '../order-board.use-case';
import { OrderBoardController } from '../../order-board.controller';
import { PublicOrderBoardController } from '../../public-order-board.controller';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../../../common/guards/business-owner.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { fake } from './test-doubles';

const NOW = new Date('2026-10-25T15:00:00Z');
const TODAY = { from: new Date('2026-10-25T03:00:00Z'), to: new Date('2026-10-26T03:00:00Z') };
const SUCURSAL: BoardSucursal = { id: 'suc-1', businessId: 'biz-A', name: 'Palermo' };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const WELL_FORMED_UNKNOWN = 'A'.repeat(43);

const boardOrder = (overrides: Partial<BoardOrder> & { id: string; status: OrderStatus; minute: number }): BoardOrder => {
  const { minute, ...rest } = overrides;
  return {
    orderNumber: `ORD-20261025-0${overrides.id.padStart(3, '0')}`,
    type: 'takeaway',
    items: [],
    createdAt: new Date(Date.UTC(2026, 9, 25, 12, minute)),
    updatedAt: new Date(Date.UTC(2026, 9, 25, 13, minute)),
    ...rest,
  };
};

/** In-memory board repository: sucursales by business and token hash, and today's paid orders. */
const fakeBoard = (orders: BoardOrder[] = []) => {
  const hashes = new Map<string, string | null>([[SUCURSAL.id, null]]);
  const port = {
    findSucursal: jest.fn(async (businessId: string, sucursalId: string) =>
      businessId === SUCURSAL.businessId && sucursalId === SUCURSAL.id ? SUCURSAL : null),
    findSucursalByDisplayTokenHash: jest.fn(async (hash: string) => (hashes.get(SUCURSAL.id) === hash ? SUCURSAL : null)),
    setDisplayTokenHash: jest.fn(async (_businessId: string, sucursalId: string, hash: string | null) => {
      hashes.set(sucursalId, hash);
    }),
    findPaidOrders: jest.fn(async () => orders),
  } satisfies OrderBoardRepositoryPort;
  return { port, hashes, useCase: new OrderBoardUseCase(fake<OrderBoardRepositoryPort>(port)) };
};

describe('OrderBoardUseCase (S13)', () => {
  describe('bar queue', () => {
    it('reads today\'s paid open orders of the sucursal and splits them into columns, oldest first', async () => {
      const { useCase, port } = fakeBoard([
        boardOrder({ id: '2', status: 'confirmed', minute: 10 }),
        boardOrder({
          id: '1', status: 'pending', minute: 5, customerName: 'Ana Gómez', tableNumber: '4', type: 'dine_in',
          items: [{ productName: 'Latte', quantity: 2, modifiers: ['Leche de almendras'], notes: 'Tibio' }],
        }),
        boardOrder({ id: '3', status: 'preparing', minute: 1 }),
        boardOrder({ id: '4', status: 'ready', minute: 2 }),
      ]);

      const result = await useCase.barQueue('biz-A', 'suc-1', NOW);

      expect(port.findPaidOrders).toHaveBeenCalledWith('biz-A', 'suc-1', TODAY, ['pending', 'confirmed', 'preparing', 'ready']);
      expect(result.ok).toBe(true);
      const queue = result.value!;
      expect(queue.new.map((o) => o.id)).toEqual(['1', '2']);
      expect(queue.preparing.map((o) => o.id)).toEqual(['3']);
      expect(queue.ready.map((o) => o.id)).toEqual(['4']);
      expect(queue.new[0]).toEqual({
        id: '1',
        orderNumber: 'ORD-20261025-0001',
        shortNumber: '001',
        status: 'pending',
        customerName: 'Ana Gómez',
        type: 'dine_in',
        tableNumber: '4',
        items: [{ productName: 'Latte', quantity: 2, modifiers: ['Leche de almendras'], notes: 'Tibio' }],
        createdAt: new Date(Date.UTC(2026, 9, 25, 12, 5)),
        updatedAt: new Date(Date.UTC(2026, 9, 25, 13, 5)),
      });
      expect(queue.new[1]).toMatchObject({ customerName: null, tableNumber: null });
    });

    it('answers 404 for a sucursal of another business without reading orders', async () => {
      const { useCase, port } = fakeBoard();
      const result = await useCase.barQueue('biz-B', 'suc-1', NOW);
      expect(result).toEqual({ ok: false, error: new Error('Sucursal no encontrada') });
      expect(port.findPaidOrders).not.toHaveBeenCalled();
    });
  });

  describe('display token', () => {
    it('returns a 32-byte base64url token once and stores only its SHA-256 hash', async () => {
      const { useCase, port, hashes } = fakeBoard();

      const result = await useCase.generateDisplayToken('biz-A', 'suc-1', NOW);

      const { token, path } = result.value!;
      expect(Object.keys(result.value!).sort()).toEqual(['path', 'token']);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(path).toBe(`/pantalla/${token}`);
      expect(hashes.get('suc-1')).toBe(sha256(token));
      expect(port.setDisplayTokenHash).toHaveBeenCalledWith('biz-A', 'suc-1', sha256(token), NOW);
      expect(JSON.stringify(port.setDisplayTokenHash.mock.calls)).not.toContain(token);
    });

    it('generating again replaces the hash, so the old token stops opening the board', async () => {
      const { useCase } = fakeBoard();
      const first = (await useCase.generateDisplayToken('biz-A', 'suc-1', NOW)).value!.token;
      const second = (await useCase.generateDisplayToken('biz-A', 'suc-1', NOW)).value!.token;

      expect(second).not.toBe(first);
      expect((await useCase.publicBoard(first, NOW)).error?.message).toBe('Pantalla no encontrada');
      expect((await useCase.publicBoard(second, NOW)).ok).toBe(true);
    });

    it('disabling clears the hash, so the token stops opening the board', async () => {
      const { useCase, port, hashes } = fakeBoard();
      const token = (await useCase.generateDisplayToken('biz-A', 'suc-1', NOW)).value!.token;

      expect(await useCase.disableDisplayToken('biz-A', 'suc-1')).toEqual({ ok: true, value: { ok: true } });

      expect(hashes.get('suc-1')).toBeNull();
      expect(port.setDisplayTokenHash).toHaveBeenLastCalledWith('biz-A', 'suc-1', null, null);
      expect((await useCase.publicBoard(token, NOW)).error?.message).toBe('Pantalla no encontrada');
    });

    it.each([
      ['generate', (u: OrderBoardUseCase) => u.generateDisplayToken('biz-B', 'suc-1', NOW)],
      ['disable', (u: OrderBoardUseCase) => u.disableDisplayToken('biz-B', 'suc-1')],
    ])('%s answers 404 for a sucursal of another business and changes nothing', async (_name, act) => {
      const { useCase, port } = fakeBoard();
      expect(await act(useCase)).toEqual({ ok: false, error: new Error('Sucursal no encontrada') });
      expect(port.setDisplayTokenHash).not.toHaveBeenCalled();
    });
  });

  describe('public board', () => {
    const withToken = async (orders: BoardOrder[]) => {
      const board = fakeBoard(orders);
      const token = (await board.useCase.generateDisplayToken('biz-A', 'suc-1', NOW)).value!.token;
      return { ...board, token };
    };

    it('shows only short number, first name and status of today\'s paid orders', async () => {
      const { useCase, port, token } = await withToken([
        boardOrder({ id: '7', status: 'ready', minute: 1, customerName: 'Maximilianoooo Rossi', tableNumber: '3', items: [{ productName: 'Café', quantity: 1, modifiers: [] }] }),
        boardOrder({ id: '5', status: 'pending', minute: 2 }),
        boardOrder({ id: '6', status: 'preparing', minute: 3, customerName: 'Ana' }),
      ]);

      const result = await useCase.publicBoard(token, NOW);

      expect(port.findSucursalByDisplayTokenHash).toHaveBeenCalledWith(sha256(token));
      expect(port.findPaidOrders).toHaveBeenCalledWith('biz-A', 'suc-1', TODAY, ['pending', 'confirmed', 'preparing', 'ready']);
      expect(result.value).toEqual({
        sucursalName: 'Palermo',
        preparing: [
          { shortNumber: '005', name: null, status: 'preparing' },
          { shortNumber: '006', name: 'Ana', status: 'preparing' },
        ],
        ready: [{ shortNumber: '007', name: 'Maximilianoo', status: 'ready' }],
        updatedAt: NOW.toISOString(),
      });
    });

    it.each([
      ['wrong length', 'abc'],
      ['wrong charset', 'A'.repeat(42) + '='],
      ['path traversal', '../../etc/passwd'.padEnd(43, 'A')],
    ])('answers the generic 404 for a malformed token (%s) without querying', async (_name, token) => {
      const { useCase, port } = fakeBoard();
      expect(await useCase.publicBoard(token, NOW)).toEqual({ ok: false, error: new Error('Pantalla no encontrada') });
      expect(port.findSucursalByDisplayTokenHash).not.toHaveBeenCalled();
      expect(port.findPaidOrders).not.toHaveBeenCalled();
    });

    it('answers the same generic 404 for an unknown token without reading orders', async () => {
      const { useCase, port } = fakeBoard();
      expect(await useCase.publicBoard(WELL_FORMED_UNKNOWN, NOW)).toEqual({ ok: false, error: new Error('Pantalla no encontrada') });
      expect(port.findSucursalByDisplayTokenHash).toHaveBeenCalledWith(sha256(WELL_FORMED_UNKNOWN));
      expect(port.findPaidOrders).not.toHaveBeenCalled();
    });
  });
});

describe('order board controllers (S13)', () => {
  it('protects the bar queue and display token routes with JWT + business owner guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrderBoardController)).toEqual([JwtAuthGuard, BusinessOwnerGuard]);
  });

  it('leaves the public board without auth guards (only the rate limit) and marks it no-store', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicOrderBoardController)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicOrderBoardController.prototype.show)).toBeUndefined();
    expect(Reflect.getMetadata(HEADERS_METADATA, PublicOrderBoardController.prototype.show)).toEqual([{ name: 'Cache-Control', value: 'no-store' }]);
  });

  it.each([
    ['malformed', 'nope'],
    ['unknown', WELL_FORMED_UNKNOWN],
  ])('the public route answers a %s token with a 404 that only says "Pantalla no encontrada"', async (_name, token) => {
    const { useCase } = fakeBoard();
    const error = await new PublicOrderBoardController(useCase).show(token).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({ statusCode: 404, message: 'Pantalla no encontrada', error: 'Not Found' });
  });
});
