// Public links of the pedido anticipado (S20), on the web (FRONTEND_URL).
import { frontendUrl } from '../../common/frontend-url';

/** The menu link of a sucursal, printed as a QR. */
export function preorderMenuUrl(slug: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${frontendUrl(env)}/pedido/${slug}`;
}

/** The tracking page of a checkout; also the back URL given to Mercado Pago. */
export function preorderTrackingUrl(trackingToken: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${frontendUrl(env)}/pedido/seguimiento/${trackingToken}`;
}
