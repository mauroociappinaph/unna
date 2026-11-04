import type { ConfigService } from '@nestjs/config';

/** Signing secret of each token type, so a token of one type never verifies as another. */
export interface JwtSecrets {
  access: string;
  refresh: string;
  reset: string;
}

type SecretEnv = Partial<Record<string, string | undefined>>;

const MIN_LENGTH = 32;
const KEYS = { access: 'JWT_SECRET', refresh: 'JWT_REFRESH_SECRET', reset: 'JWT_RESET_SECRET' } as const;
const GENERATE = 'generalo con openssl rand -base64 48';

const missing = (key: string) => `Falta ${key}: en producción cada tipo de token necesita su propio secreto de al menos ${MIN_LENGTH} caracteres (${GENERATE})`;
const tooShort = (key: string) => `${key} es demasiado corto: en producción tiene que tener al menos ${MIN_LENGTH} caracteres (${GENERATE})`;
const repeated = (first: string, second: string) => `${first} y ${second} no pueden ser iguales: cada tipo de token necesita su propio secreto`;

/**
 * JWT_SECRET (access), JWT_REFRESH_SECRET (refresh) and JWT_RESET_SECRET (reset and email links).
 * In production all three are required, distinct and at least 32 characters long; otherwise this
 * throws and the API refuses to start (configureApp). Outside production a missing refresh or reset
 * secret is derived from JWT_SECRET, so local setups keep working with distinct keys.
 */
export function jwtSecrets(env: SecretEnv = process.env): JwtSecrets {
  if (env.NODE_ENV !== 'production') {
    const access = env.JWT_SECRET;
    if (!access) throw new Error('Falta JWT_SECRET: la API no puede firmar sesiones sin él');
    return { access, refresh: env.JWT_REFRESH_SECRET || `${access}:refresh`, reset: env.JWT_RESET_SECRET || `${access}:reset` };
  }

  const required = (key: string): string => {
    const value = env[key];
    if (!value) throw new Error(missing(key));
    if (value.length < MIN_LENGTH) throw new Error(tooShort(key));
    return value;
  };
  const secrets: JwtSecrets = { access: required(KEYS.access), refresh: required(KEYS.refresh), reset: required(KEYS.reset) };
  const pairs = [['access', 'refresh'], ['access', 'reset'], ['refresh', 'reset']] as const;
  for (const [first, second] of pairs) {
    if (secrets[first] === secrets[second]) throw new Error(repeated(KEYS[first], KEYS[second]));
  }
  return secrets;
}

/** The same secrets read through Nest's ConfigService (process env plus the .env files). */
export function jwtSecretsFrom(config: Pick<ConfigService, 'get'>): JwtSecrets {
  const env: SecretEnv = { NODE_ENV: config.get('NODE_ENV') };
  Object.values(KEYS).forEach((key) => {
    env[key] = config.get(key);
  });
  return jwtSecrets(env);
}
