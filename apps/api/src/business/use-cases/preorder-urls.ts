// Public links of the pedido anticipado (S20), on the web (FRONTEND_URL).

const frontendUrl = (env: NodeJS.ProcessEnv): string => (env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** The menu link of a sucursal, printed as a QR. */
export function preorderMenuUrl(slug: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${frontendUrl(env)}/pedido/${slug}`;
}

/** The tracking page of a checkout; also the back URL given to Mercado Pago. */
export function preorderTrackingUrl(trackingToken: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${frontendUrl(env)}/pedido/seguimiento/${trackingToken}`;
}
