/** Outside production, or in production in the explicit staging mode (UNNA_ENV=staging, exact value). */
function isNotRealProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV !== 'production' || env.UNNA_ENV === 'staging';
}

/**
 * Whether the ARCA and Mercado Pago simulators may run (S16). Always outside production; in
 * production only in the explicit staging mode (UNNA_ENV=staging, exact value), a test deployment
 * that must never hold real customer data or real payments.
 */
export function simulatorsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return isNotRealProduction(env);
}

/** Whether Swagger (/api/docs) is served (S17): not in real production, where it maps the whole API. */
export function swaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isNotRealProduction(env);
}
