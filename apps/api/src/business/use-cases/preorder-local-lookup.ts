import { Inject, Injectable } from '@nestjs/common';
import {
  argentinaClock,
  CashSessionRepositoryPort,
  isWellFormedPreorderSlug,
  MercadoPagoConnectionRepositoryPort,
  NotFoundError,
  PreorderLocal,
  preorderNotAcceptingReason,
  PreorderRepositoryPort,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

// Same answer for malformed, unknown and disabled slugs.
export const PREORDER_LOCAL_NOT_FOUND = 'Este local no recibe pedidos anticipados';

/** Resolves the public link of a sucursal and whether it takes orders right now (S20). */
@Injectable()
export class PreorderLocalLookup {
  constructor(
    @Inject('PreorderRepositoryPort') private readonly preorders: Pick<PreorderRepositoryPort, 'findEnabledBySlug'>,
    @Inject('CashSessionRepositoryPort') private readonly cashSessions: Pick<CashSessionRepositoryPort, 'findOpenBySucursal'>,
    @Inject('MercadoPagoConnectionRepositoryPort') private readonly mercadoPago: Pick<MercadoPagoConnectionRepositoryPort, 'findConnection'>,
  ) {}

  /** Malformed slugs never reach the database. */
  async find(slug: string): Promise<UseCaseResult<PreorderLocal>> {
    const local = isWellFormedPreorderSlug(slug) ? await this.preorders.findEnabledBySlug(slug) : null;
    return local ? { ok: true, value: local } : { ok: false, error: new NotFoundError(PREORDER_LOCAL_NOT_FOUND) };
  }

  /**
   * Why the local does not take orders now (inactive, closed by its schedule in Argentina time, caja
   * closed or Mercado Pago not connected); null when it does.
   */
  async notAcceptingReason(local: PreorderLocal, now: Date): Promise<string | null> {
    const { day, time } = argentinaClock(now);
    const [cash, connection] = await Promise.all([
      this.cashSessions.findOpenBySucursal(local.businessId, local.id),
      this.mercadoPago.findConnection(local.businessId),
    ]);
    return preorderNotAcceptingReason({
      active: local.isActive && local.businessActive,
      open: local.schedule.isOpenAt(day, time),
      cashOpen: cash !== null,
      mercadoPagoConnected: connection !== null,
    });
  }
}
