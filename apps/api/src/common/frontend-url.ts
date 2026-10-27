const LOCAL_WEB = 'http://localhost:3000';
const MISSING = 'Falta FRONTEND_URL: en producción es obligatoria la URL de la web (por ejemplo https://unna-web.onrender.com)';

/**
 * Origin of the web app (CORS, links in emails, Mercado Pago back URLs), without trailing slashes.
 * Defaults to the local web app only outside production; in production a missing value throws, so
 * the API refuses to start (configureApp) instead of sending customers to localhost.
 */
export function frontendUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.FRONTEND_URL ?? '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (env.NODE_ENV === 'production') throw new Error(MISSING);
  return LOCAL_WEB;
}
