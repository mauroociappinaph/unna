/**
 * Whether the ARCA and Mercado Pago simulators may run (S16). Always outside production; in
 * production only in the explicit staging mode (UNNA_ENV=staging, exact value), a test deployment
 * that must never hold real customer data or real payments.
 */
export function simulatorsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.UNNA_ENV === 'staging';
}
