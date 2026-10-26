import { CashUseCase } from '../cash.use-case';
import { CashSession, CashSessionPayment, CashSessionRepositoryPort, CashUnitOfWorkPort } from '@unna/domain';
import { fake } from './test-doubles';

type StoredPayment = CashSessionPayment & { cashSessionId: string };

/** In-memory sessions behind a lock that runs each unit of work after the previous one, like the row locks. */
const cashStore = (initial: CashSession[] = [], payments: StoredPayment[] = []) => {
  const state = { sessions: [...initial], saves: 0 };
  let held = false;
  let queue: Promise<unknown> = Promise.resolve();
  const guard = () => {
    if (!held) throw new Error('write outside the cash lock');
  };
  const sessions: CashSessionRepositoryPort = {
    findOpenBySucursal: async (businessId, sucursalId) =>
      state.sessions.find((s) => s.businessId === businessId && s.sucursalId === sucursalId && s.isOpen) ?? null,
    findByIdAndBusinessId: async (id, businessId) =>
      state.sessions.find((s) => s.id === id && s.businessId === businessId) ?? null,
    findPageByBusiness: async (businessId) => ({
      items: state.sessions
        .filter((s) => s.businessId === businessId)
        .map(({ movements, ...fields }) => ({ ...fields, movementCount: movements.length })),
    }),
    findPaymentsBySession: async (sessionId) => payments.filter((p) => p.cashSessionId === sessionId),
    save: async (session) => {
      guard();
      state.saves++;
      state.sessions = [...state.sessions.filter((s) => s.id !== session.id), session];
    },
  };
  const locked = <T>(work: (s: CashSessionRepositoryPort) => Promise<T>) => {
    const run = queue.then(async () => {
      held = true;
      try {
        return await work(sessions);
      } finally {
        held = false;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };
  const withSucursalLock = jest.fn((_b: string, _s: string, work: (s: CashSessionRepositoryPort) => Promise<unknown>) => locked(work));
  const withSessionLock = jest.fn((_id: string, _b: string, work: (s: CashSessionRepositoryPort) => Promise<unknown>) => locked(work));
  const unitOfWork = fake<CashUnitOfWorkPort>({ withSucursalLock, withSessionLock });
  return { state, sessions, unitOfWork, withSucursalLock, withSessionLock };
};

const business = {
  findById: async (id: string) =>
    id === 'biz-A'
      ? { id, sucursales: [{ id: 'suc-1', isActive: true }, { id: 'suc-off', isActive: false }] }
      : null,
};

const cashFor = (store: ReturnType<typeof cashStore>) => new CashUseCase(store.sessions, store.unitOfWork, fake(business));

const openSession = (sucursalId = 'suc-1', openingAmount = 10000) =>
  CashSession.create({ businessId: 'biz-A', sucursalId, openedBy: 'user-1', openingAmount });

describe('CashUseCase', () => {
  describe('open', () => {
    it('opens a session for the sucursal under the sucursal lock, opened by the user', async () => {
      const store = cashStore();

      const result = await cashFor(store).open({ businessId: 'biz-A', sucursalId: 'suc-1', openingAmount: 5000, openedBy: 'user-1' });

      expect(result.ok).toBe(true);
      expect(store.withSucursalLock).toHaveBeenCalledWith('biz-A', 'suc-1', expect.any(Function));
      expect(store.state.sessions).toEqual([result.value]);
      expect(result.value).toMatchObject({ status: 'open', sucursalId: 'suc-1', openingAmount: 5000, openedBy: 'user-1' });
    });

    it('rejects a second concurrent opening for the same sucursal and writes nothing for it', async () => {
      const store = cashStore();
      const cash = cashFor(store);
      const openOne = () => cash.open({ businessId: 'biz-A', sucursalId: 'suc-1', openingAmount: 0, openedBy: 'user-1' });

      const [first, second] = await Promise.all([openOne(), openOne()]);

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(false);
      expect(second.error!.message).toBe('Ya hay una caja abierta en esta sucursal');
      expect(store.state.saves).toBe(1);
      expect(store.state.sessions).toEqual([first.value]);
    });

    it('allows a new session once the previous one is closed', async () => {
      const closed = openSession().close({ closedBy: 'u', declared: {}, payments: [] });
      const store = cashStore([closed]);

      const result = await cashFor(store).open({ businessId: 'biz-A', sucursalId: 'suc-1', openingAmount: 0, openedBy: 'user-1' });

      expect(result.ok).toBe(true);
      expect(store.state.sessions).toHaveLength(2);
    });

    it.each(['suc-x', 'suc-off'])('rejects an unknown or inactive sucursal (%s) and writes nothing', async (sucursalId) => {
      const store = cashStore();

      const result = await cashFor(store).open({ businessId: 'biz-A', sucursalId, openingAmount: 0, openedBy: 'user-1' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('Sucursal no encontrada');
      expect(store.state.saves).toBe(0);
    });

    it('rejects a negative opening float and writes nothing', async () => {
      const store = cashStore();

      const result = await cashFor(store).open({ businessId: 'biz-A', sucursalId: 'suc-1', openingAmount: -1, openedBy: 'user-1' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('El fondo inicial debe ser un monto en centavos mayor o igual a 0');
      expect(store.state.saves).toBe(0);
    });
  });

  describe('current, get and list', () => {
    it('returns the open session of the sucursal, or null when there is none', async () => {
      const session = openSession();
      const cash = cashFor(cashStore([session]));

      expect((await cash.current('biz-A', 'suc-1')).value).toBe(session);
      expect((await cash.current('biz-A', 'suc-2')).value).toBeNull();
    });

    it('reports an unknown session or one of another business as not found', async () => {
      const session = openSession();
      const cash = cashFor(cashStore([session]));

      expect((await cash.get('biz-B', session.id)).error!.message).toBe('Caja no encontrada');
      expect((await cash.get('biz-A', 'nope')).error!.message).toBe('Caja no encontrada');
      expect((await cash.get('biz-A', session.id)).value).toBe(session);
    });

    it('lists the sessions of the business', async () => {
      const session = openSession();
      const result = await cashFor(cashStore([session])).list('biz-A', {}, { limit: 50 });

      const { movements, ...fields } = session;
      expect(result.value).toEqual({ items: [{ ...fields, movementCount: movements.length }] });
    });
  });

  describe('addMovement', () => {
    it('adds the movement under the session lock, created by the user', async () => {
      const session = openSession();
      const store = cashStore([session]);

      const result = await cashFor(store).addMovement({ businessId: 'biz-A', sessionId: session.id, type: 'in', amount: 2000, reason: 'cambio', createdBy: 'user-2' });

      expect(result.ok).toBe(true);
      expect(store.withSessionLock).toHaveBeenCalledWith(session.id, 'biz-A', expect.any(Function));
      expect(store.state.sessions[0].movements).toEqual([expect.objectContaining({ type: 'in', amount: 2000, reason: 'cambio', createdBy: 'user-2' })]);
    });

    it('rejects a movement on a closed session and writes nothing', async () => {
      const closed = openSession().close({ closedBy: 'u', declared: {}, payments: [] });
      const store = cashStore([closed]);

      const result = await cashFor(store).addMovement({ businessId: 'biz-A', sessionId: closed.id, type: 'out', amount: 100, reason: 'r', createdBy: 'u' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('La caja ya está cerrada');
      expect(store.state.saves).toBe(0);
      expect(store.state.sessions).toEqual([closed]);
    });

    it('rejects an invalid movement and writes nothing', async () => {
      const session = openSession();
      const store = cashStore([session]);

      const result = await cashFor(store).addMovement({ businessId: 'biz-A', sessionId: session.id, type: 'in', amount: 0, reason: 'r', createdBy: 'u' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('El monto debe ser un entero positivo en centavos');
      expect(store.state.saves).toBe(0);
    });

    it('reports an unknown session as not found and writes nothing', async () => {
      const store = cashStore();

      const result = await cashFor(store).addMovement({ businessId: 'biz-A', sessionId: 'nope', type: 'in', amount: 100, reason: 'r', createdBy: 'u' });

      expect(result.error!.message).toBe('Caja no encontrada');
      expect(store.state.saves).toBe(0);
    });
  });

  describe('close', () => {
    it('closes under the session lock, computing expected from that session payments only', async () => {
      const session = openSession('suc-1', 10000).addMovement({ type: 'out', amount: 1000, reason: 'hielo', createdBy: 'u' });
      const other = openSession('suc-2', 0);
      const store = cashStore([session, other], [
        { cashSessionId: session.id, method: 'cash', amount: 2500, status: 'completed' },
        { cashSessionId: session.id, method: 'card', amount: 4000, status: 'completed' },
        { cashSessionId: session.id, method: 'qr', amount: 999, status: 'failed' },
        { cashSessionId: other.id, method: 'cash', amount: 7777, status: 'completed' },
        { cashSessionId: other.id, method: 'transfer', amount: 5555, status: 'completed' },
      ]);

      const result = await cashFor(store).close({
        businessId: 'biz-A',
        sessionId: session.id,
        closedBy: 'user-9',
        declared: { cash: 11000, card: 4000, mercado_pago: 0, transfer: 0, qr: 0 },
        notes: 'ok',
      });

      expect(result.ok).toBe(true);
      expect(store.withSessionLock).toHaveBeenCalledWith(session.id, 'biz-A', expect.any(Function));
      const saved = store.state.sessions.find((s) => s.id === session.id)!;
      expect(saved).toBe(result.value);
      expect(saved).toMatchObject({ status: 'closed', closedBy: 'user-9', notes: 'ok' });
      expect(saved.expected).toEqual({ cash: 11500, card: 4000, mercado_pago: 0, transfer: 0, qr: 0 });
      expect(saved.difference).toEqual({ cash: -500, card: 0, mercado_pago: 0, transfer: 0, qr: 0 });
      expect(store.state.sessions.find((s) => s.id === other.id)).toBe(other);
    });

    it('rejects closing a closed session and writes nothing', async () => {
      const closed = openSession().close({ closedBy: 'u', declared: {}, payments: [] });
      const store = cashStore([closed]);

      const result = await cashFor(store).close({ businessId: 'biz-A', sessionId: closed.id, closedBy: 'u', declared: {} });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('La caja ya está cerrada');
      expect(store.state.saves).toBe(0);
      expect(store.state.sessions).toEqual([closed]);
    });

    it('reports an unknown session as not found and writes nothing', async () => {
      const store = cashStore();

      const result = await cashFor(store).close({ businessId: 'biz-A', sessionId: 'nope', closedBy: 'u', declared: {} });

      expect(result.error!.message).toBe('Caja no encontrada');
      expect(store.state.saves).toBe(0);
    });
  });
});
