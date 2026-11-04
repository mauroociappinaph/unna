import { CashSession, expectedAmounts, differenceAmounts } from '../cash-session';

const open = (openingAmount = 10000) =>
  CashSession.create({ businessId: 'biz-A', sucursalId: 'suc-1', openedBy: 'user-1', openingAmount });

const paid = (method: string, amount: number, status = 'completed') => ({ method, amount, status });

describe('CashSession', () => {
  describe('open', () => {
    it('starts open with the opening float and no movements', () => {
      const session = open(5000);

      expect(session.status).toBe('open');
      expect(session.isOpen).toBe(true);
      expect(session.businessId).toBe('biz-A');
      expect(session.sucursalId).toBe('suc-1');
      expect(session.openedBy).toBe('user-1');
      expect(session.openingAmount).toBe(5000);
      expect(session.movements).toEqual([]);
      expect(session.expected).toBeUndefined();
    });

    it('accepts a zero opening float', () => {
      expect(open(0).openingAmount).toBe(0);
    });

    it.each([-1, 10.5, Number.NaN])('rejects an opening float of %p', (amount) => {
      expect(() => open(amount)).toThrow('El fondo inicial debe ser un monto en centavos mayor o igual a 0');
    });
  });

  describe('addMovement', () => {
    it('records a cash in or out with its reason and author, returning a new session', () => {
      const session = open();

      const updated = session.addMovement({ type: 'out', amount: 2000, reason: ' Pago a proveedor ', createdBy: 'user-2' });

      expect(session.movements).toEqual([]);
      expect(updated.movements).toHaveLength(1);
      expect(updated.movements[0]).toMatchObject({ sessionId: session.id, type: 'out', amount: 2000, reason: 'Pago a proveedor', createdBy: 'user-2' });
    });

    it.each([0, -100, 1.5])('rejects an amount of %p', (amount) => {
      expect(() => open().addMovement({ type: 'in', amount, reason: 'cambio', createdBy: 'u' })).toThrow(
        'El monto debe ser un entero positivo en centavos',
      );
    });

    it('rejects a movement without a reason', () => {
      expect(() => open().addMovement({ type: 'in', amount: 100, reason: '  ', createdBy: 'u' })).toThrow(
        'El motivo es obligatorio',
      );
    });

    it('rejects an unknown movement type', () => {
      expect(() => open().addMovement({ type: 'x' as 'in', amount: 100, reason: 'r', createdBy: 'u' })).toThrow(
        'Tipo de movimiento inválido',
      );
    });
  });

  describe('expected and difference', () => {
    it('cash = float + completed cash payments + ins - outs; other methods = their completed payments', () => {
      const movements = [
        { type: 'in' as const, amount: 3000 },
        { type: 'out' as const, amount: 1500 },
        { type: 'in' as const, amount: 500 },
      ];
      const payments = [
        paid('cash', 1000),
        paid('cash', 2500),
        paid('card', 4000),
        paid('mercado_pago', 700),
        paid('qr', 300),
        paid('transfer', 900),
        paid('card', 9999, 'failed'),
        paid('cash', 8888, 'refunded'),
      ];

      expect(expectedAmounts(10000, movements, payments)).toEqual({
        cash: 10000 + 1000 + 2500 + 3000 - 1500 + 500,
        card: 4000,
        mercado_pago: 700,
        transfer: 900,
        qr: 300,
      });
    });

    it('difference = declared - expected per method, counting a missing declared method as 0', () => {
      const expected = { cash: 15000, card: 4000, mercado_pago: 700, transfer: 0, qr: 300 };

      expect(differenceAmounts({ cash: 14500, card: 4000, mercado_pago: 800 }, expected)).toEqual({
        cash: -500,
        card: 0,
        mercado_pago: 100,
        transfer: 0,
        qr: -300,
      });
    });
  });

  describe('close', () => {
    it('stores expected, declared and difference computed from the movements and the payments', () => {
      const session = open(10000)
        .addMovement({ type: 'in', amount: 2000, reason: 'cambio', createdBy: 'u' })
        .addMovement({ type: 'out', amount: 500, reason: 'hielo', createdBy: 'u' });

      const closed = session.close({
        closedBy: 'user-9',
        declared: { cash: 13000, card: 3000 },
        payments: [paid('cash', 1000), paid('card', 3000), paid('transfer', 1200)],
        notes: ' faltó cambio ',
      });

      expect(session.status).toBe('open');
      expect(closed.status).toBe('closed');
      expect(closed.isOpen).toBe(false);
      expect(closed.closedBy).toBe('user-9');
      expect(closed.closedAt).toBeInstanceOf(Date);
      expect(closed.notes).toBe('faltó cambio');
      expect(closed.expected).toEqual({ cash: 12500, card: 3000, mercado_pago: 0, transfer: 1200, qr: 0 });
      expect(closed.declared).toEqual({ cash: 13000, card: 3000, mercado_pago: 0, transfer: 0, qr: 0 });
      expect(closed.difference).toEqual({ cash: 500, card: 0, mercado_pago: 0, transfer: -1200, qr: 0 });
    });

    it.each([-1, 2.5])('rejects a declared amount of %p', (amount) => {
      expect(() => open().close({ closedBy: 'u', declared: { cash: amount }, payments: [] })).toThrow(
        'Los montos declarados deben ser enteros en centavos mayores o iguales a 0',
      );
    });

    it('makes the session immutable: no movements and no second close', () => {
      const closed = open().close({ closedBy: 'u', declared: {}, payments: [] });

      expect(() => closed.addMovement({ type: 'in', amount: 100, reason: 'r', createdBy: 'u' })).toThrow('La caja ya está cerrada');
      expect(() => closed.close({ closedBy: 'u', declared: {}, payments: [] })).toThrow('La caja ya está cerrada');
      expect(closed.movements).toEqual([]);
      expect(closed.status).toBe('closed');
    });
  });
});
