import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { NotFoundError, PreorderRepositoryPort, PreorderSucursal } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { preorderMenuUrl } from './preorder-urls';

const SUCURSAL_NOT_FOUND = 'Sucursal no encontrada';

export interface PreorderSucursalView {
  sucursalId: string;
  name: string;
  enabled: boolean;
  url: string | null;
}

export interface EnabledPreorder {
  sucursalId: string;
  enabled: true;
  slug: string;
  url: string;
}

const notFound = <T>(): UseCaseResult<T> => ({ ok: false, error: new NotFoundError(SUCURSAL_NOT_FOUND) });

/**
 * The owner enables or disables pedido anticipado per sucursal (S20). The slug is public but not
 * guessable (16 random bytes, base64url); it is kept when disabled, so enabling again gives the
 * same link and printed QR.
 */
@Injectable()
export class PreorderSettingsUseCase {
  constructor(@Inject('PreorderRepositoryPort') private readonly preorders: PreorderRepositoryPort) {}

  async list(businessId: string): Promise<UseCaseResult<{ sucursales: PreorderSucursalView[] }>> {
    const sucursales = await this.preorders.listSucursales(businessId);
    return { ok: true, value: { sucursales: sucursales.map(toView) } };
  }

  /** Idempotent: returns the stored slug. */
  async enable(businessId: string, sucursalId: string): Promise<UseCaseResult<EnabledPreorder>> {
    if (!(await this.preorders.findSucursal(businessId, sucursalId))) return notFound();
    const slug = await this.preorders.enable(businessId, sucursalId, randomBytes(16).toString('base64url'));
    if (!slug) return notFound();
    return { ok: true, value: { sucursalId, enabled: true, slug, url: preorderMenuUrl(slug) } };
  }

  async disable(businessId: string, sucursalId: string): Promise<UseCaseResult<void>> {
    if (!(await this.preorders.findSucursal(businessId, sucursalId))) return notFound();
    await this.preorders.disable(businessId, sucursalId);
    return { ok: true };
  }
}

function toView(sucursal: PreorderSucursal): PreorderSucursalView {
  const url = sucursal.enabled && sucursal.slug ? preorderMenuUrl(sucursal.slug) : null;
  return { sucursalId: sucursal.id, name: sucursal.name, enabled: url !== null, url };
}
