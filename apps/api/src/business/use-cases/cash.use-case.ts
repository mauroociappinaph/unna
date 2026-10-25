import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRepositoryPort,
  CashAmounts,
  CashMovementType,
  CashSession,
  CashSessionListFilters,
  CashSessionRepositoryPort,
  CashUnitOfWorkPort,
} from '@unna/domain';

interface Result<T> {
  ok: boolean;
  value?: T;
  error?: Error;
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(message: string): Result<T> => ({ ok: false, error: new Error(message) });

/** Domain rules throw; report them as a failed result so nothing after them is written. */
const attempt = <T>(change: () => T): Result<T> => {
  try {
    return ok(change());
  } catch (error) {
    return fail((error as Error).message);
  }
};

const NOT_FOUND = 'Caja no encontrada';

@Injectable()
export class CashUseCase {
  constructor(
    @Inject('CashSessionRepositoryPort') private readonly sessions: CashSessionRepositoryPort,
    @Inject('CashUnitOfWorkPort') private readonly unitOfWork: CashUnitOfWorkPort,
    @Inject('BusinessRepositoryPort') private readonly businesses: BusinessRepositoryPort,
  ) {}

  async open(command: { businessId: string; sucursalId: string; openingAmount: number; openedBy: string }): Promise<Result<CashSession>> {
    const business = await this.businesses.findById(command.businessId);
    if (!business) return fail('Negocio no encontrado');
    if (!business.sucursales.some((s) => s.id === command.sucursalId && s.isActive)) return fail('Sucursal no encontrada');

    const session = attempt(() => CashSession.create(command));
    if (!session.ok) return session;

    // Under the sucursal lock a concurrent opening waits and then sees this session.
    return this.unitOfWork.withSucursalLock(command.businessId, command.sucursalId, async (sessions) => {
      if (await sessions.findOpenBySucursal(command.businessId, command.sucursalId)) {
        return fail<CashSession>('Ya hay una caja abierta en esta sucursal');
      }
      await sessions.save(session.value!);
      return session;
    });
  }

  async current(businessId: string, sucursalId: string): Promise<Result<CashSession | null>> {
    return ok(await this.sessions.findOpenBySucursal(businessId, sucursalId));
  }

  async get(businessId: string, sessionId: string): Promise<Result<CashSession>> {
    const session = await this.sessions.findByIdAndBusinessId(sessionId, businessId);
    return session ? ok(session) : fail(NOT_FOUND);
  }

  async list(businessId: string, filters: CashSessionListFilters): Promise<Result<CashSession[]>> {
    return ok(await this.sessions.listByBusiness(businessId, filters));
  }

  async addMovement(command: {
    businessId: string;
    sessionId: string;
    type: CashMovementType;
    amount: number;
    reason: string;
    createdBy: string;
  }): Promise<Result<CashSession>> {
    return this.unitOfWork.withSessionLock(command.sessionId, command.businessId, async (sessions) => {
      const session = await sessions.findByIdAndBusinessId(command.sessionId, command.businessId);
      if (!session) return fail<CashSession>(NOT_FOUND);
      const updated = attempt(() => session.addMovement(command));
      if (!updated.ok) return updated;
      await sessions.save(updated.value!);
      return updated;
    });
  }

  // The session lock waits for payments still being linked to the session, so the payments read
  // here are all the payments the session will ever have: later ones find it closed.
  async close(command: {
    businessId: string;
    sessionId: string;
    closedBy: string;
    declared: Partial<CashAmounts>;
    notes?: string;
  }): Promise<Result<CashSession>> {
    return this.unitOfWork.withSessionLock(command.sessionId, command.businessId, async (sessions) => {
      const session = await sessions.findByIdAndBusinessId(command.sessionId, command.businessId);
      if (!session) return fail<CashSession>(NOT_FOUND);
      if (!session.isOpen) return fail<CashSession>('La caja ya está cerrada');
      const payments = await sessions.findPaymentsBySession(session.id);
      const closed = attempt(() => session.close({ ...command, payments }));
      if (!closed.ok) return closed;
      await sessions.save(closed.value!);
      return closed;
    });
  }
}
