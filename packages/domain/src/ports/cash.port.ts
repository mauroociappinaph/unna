// Cash register sessions (caja y turnos, S12). The payment side (linking a payment to the open
// session under the order lock) is LockedCashSessionsPort in repository.port.ts.
import type { CashSession, CashSessionPayment, CashSessionStatus } from '../cash/cash-session';
import type { CashSessionSummary } from '../cash/cash-session-summary';
import type { Page, PageRequest } from '../common/pagination';

export interface CashSessionListFilters {
  sucursalId?: string;
  status?: CashSessionStatus;
  from?: Date;
  to?: Date;
}

export interface CashSessionRepositoryPort {
  findOpenBySucursal(businessId: string, sucursalId: string): Promise<CashSession | null>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<CashSession | null>;
  /** Newest first, without the movements. Null when the cursor is not a session of the business. */
  findPageByBusiness(businessId: string, filters: CashSessionListFilters, page: PageRequest): Promise<Page<CashSessionSummary> | null>;
  /** Payments taken in the session, whatever their status. */
  findPaymentsBySession(sessionId: string): Promise<CashSessionPayment[]>;
  /** Writes the session and any movement not stored yet; stored movements never change. */
  save(session: CashSession): Promise<void>;
}

export interface CashUnitOfWorkPort {
  /**
   * Runs `work` in one transaction holding a lock on the sucursal, so two openings for the same
   * sucursal run one after another and the second sees the first one's session.
   */
  withSucursalLock<T>(businessId: string, sucursalId: string, work: (sessions: CashSessionRepositoryPort) => Promise<T>): Promise<T>;
  /**
   * Runs `work` in one transaction holding an exclusive lock on the session. It waits for payments
   * that hold the session's shared lock, and payments started after it see the session's new state.
   */
  withSessionLock<T>(sessionId: string, businessId: string, work: (sessions: CashSessionRepositoryPort) => Promise<T>): Promise<T>;
}
