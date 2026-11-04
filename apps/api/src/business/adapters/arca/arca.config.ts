import { readFileSync } from 'fs';

export type ArcaEnvironment = 'homologacion' | 'produccion';

export interface ArcaConfig {
  environment: ArcaEnvironment;
  wsaaUrl: string;
  wsfeUrl: string;
  /** UNNA's own certificate: every café delegates "wsfe" to UNNA's CUIT (S12). */
  certificatePem: string;
  privateKeyPem: string;
  timeoutMs: number;
}

export const ARCA_ENDPOINTS: Record<ArcaEnvironment, { wsaaUrl: string; wsfeUrl: string }> = {
  homologacion: {
    wsaaUrl: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfeUrl: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaaUrl: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfeUrl: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

const REQUIRED_VARIABLES = ['ARCA_ENV', 'ARCA_CERT_PATH', 'ARCA_KEY_PATH'] as const;
const DEFAULT_TIMEOUT_MS = 15000;

const present = (value: string | undefined): value is string => value !== undefined && value.trim() !== '';

/** True when every variable the real adapter needs is set; the module wires the simulator otherwise. */
export function isArcaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return REQUIRED_VARIABLES.every((name) => present(env[name]));
}

/** Validates the environment and reads both PEM files. Errors name variables and paths, never contents. */
export function loadArcaConfig(
  env: NodeJS.ProcessEnv = process.env,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): ArcaConfig {
  const missing = REQUIRED_VARIABLES.filter((name) => !present(env[name]));
  if (missing.length > 0) throw new Error(`ARCA no configurado: faltan ${missing.join(', ')}`);

  const environment = env.ARCA_ENV!.trim();
  if (environment !== 'homologacion' && environment !== 'produccion') {
    throw new Error("ARCA_ENV inválido: debe ser 'homologacion' o 'produccion'");
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (present(env.ARCA_TIMEOUT_MS)) {
    timeoutMs = Number(env.ARCA_TIMEOUT_MS);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('ARCA_TIMEOUT_MS inválido: debe ser un entero positivo de milisegundos');
    }
  }

  return {
    environment,
    ...ARCA_ENDPOINTS[environment],
    certificatePem: readPem('ARCA_CERT_PATH', env.ARCA_CERT_PATH!.trim(), readFile),
    privateKeyPem: readPem('ARCA_KEY_PATH', env.ARCA_KEY_PATH!.trim(), readFile),
    timeoutMs,
  };
}

function readPem(variable: string, path: string, readFile: (path: string) => string): string {
  try {
    return readFile(path);
  } catch {
    throw new Error(`No se pudo leer ${variable} (${path})`);
  }
}
