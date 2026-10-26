export interface MercadoPagoConfig {
  clientId: string;
  clientSecret: string;
  /** Must exactly match a Redirect URL registered in the UNNA application. */
  redirectUri: string;
  timeoutMs?: number;
}

const present = (value: string | undefined): value is string => value !== undefined && value.trim() !== '';

/** True when the UNNA application credentials are set; the module wires the simulator otherwise. */
export function isMercadoPagoConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return present(env.MP_CLIENT_ID) && present(env.MP_CLIENT_SECRET);
}

/** Errors name the missing variables, never their values. */
export function loadMercadoPagoConfig(env: NodeJS.ProcessEnv = process.env): MercadoPagoConfig {
  const missing = ['MP_CLIENT_ID', 'MP_CLIENT_SECRET', 'MP_REDIRECT_URI'].filter((name) => !present(env[name]));
  if (missing.length > 0) throw new Error(`Mercado Pago no configurado: falta ${missing.join(', ')}`);
  return { clientId: env.MP_CLIENT_ID!.trim(), clientSecret: env.MP_CLIENT_SECRET!.trim(), redirectUri: env.MP_REDIRECT_URI!.trim() };
}

/** OAuth callback of this API, used by the simulator to "authorize" instantly. */
export function localOAuthCallbackUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (present(env.MP_REDIRECT_URI)) return env.MP_REDIRECT_URI.trim();
  return `http://localhost:${env.PORT || 3001}/api/v1/mercadopago/oauth/callback`;
}
