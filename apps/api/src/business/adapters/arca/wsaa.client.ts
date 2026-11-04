// node-forge is used ONLY to sign (never to verify): <=1.4.0 has GHSA-86w9-cpqp-85rv in RSA PKCS#1 v1.5 verification, unfixed.
import forge from 'node-forge';
import { argentineIsoDateTime } from './argentina-time';
import { ArcaSoapFaultError, ArcaUnavailableError, postSoap } from './soap';
import { decodeXml, escapeXml, innerXml, textOf } from './xml';

/** WSAA access ticket (TA). Token and sign are credentials: never log them or store them in receipts. */
export interface AccessTicket {
  token: string;
  sign: string;
  expiresAt: Date;
}

export interface AccessTicketProvider {
  getTicket(): Promise<AccessTicket>;
}

export interface WsaaClientOptions {
  url: string;
  certificatePem: string;
  privateKeyPem: string;
  timeoutMs: number;
  service?: string;
  now?: () => Date;
}

const TRA_WINDOW_MS = 10 * 60 * 1000;
/** A cached ticket is renewed this long before it expires (tickets last 12 h). */
const RENEWAL_MARGIN_MS = 10 * 60 * 1000;

/** Login ticket request (TRA) for `service`, valid from 10 minutes before to 10 minutes after `now`. */
export function buildLoginTicketRequest(now: Date, service: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>' +
    `<uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${argentineIsoDateTime(new Date(now.getTime() - TRA_WINDOW_MS))}</generationTime>` +
    `<expirationTime>${argentineIsoDateTime(new Date(now.getTime() + TRA_WINDOW_MS))}</expirationTime>` +
    `</header><service>${escapeXml(service)}</service></loginTicketRequest>`
  );
}

/** CMS SignedData of the TRA (content attached, sha256, certificate included), as bare base64. */
export function signLoginTicketRequest(tra: string, certificatePem: string, privateKeyPem: string, now: Date = new Date()): string {
  return signWith(tra, parseCertificate(certificatePem), parsePrivateKey(privateKeyPem), now);
}

export function parseLoginCmsResponse(body: string): AccessTicket {
  const encoded = innerXml(body, 'loginCmsReturn');
  if (encoded === undefined) throw new ArcaUnavailableError('ARCA (WSAA) loginCms: respuesta inesperada');
  const ticket = decodeXml(encoded);
  const token = textOf(ticket, 'token');
  const sign = textOf(ticket, 'sign');
  const expiresAt = new Date(textOf(ticket, 'expirationTime') ?? '');
  if (!token || !sign || Number.isNaN(expiresAt.getTime())) {
    throw new ArcaUnavailableError('ARCA (WSAA) loginCms: ticket de acceso incompleto');
  }
  return { token, sign, expiresAt };
}

/**
 * Logs in to WSAA with UNNA's certificate and caches the ticket in memory. WSAA refuses a new ticket
 * while one is valid, so near expiry a refused login keeps the cached ticket; with none cached
 * (e.g. after a restart) there is nothing to reuse until the issued one expires.
 */
export class WsaaClient implements AccessTicketProvider {
  private readonly certificate: forge.pki.Certificate;
  private readonly privateKey: forge.pki.rsa.PrivateKey;
  private readonly service: string;
  private readonly now: () => Date;
  private cached: AccessTicket | null = null;
  private pending: Promise<AccessTicket> | null = null;

  constructor(private readonly options: WsaaClientOptions) {
    this.certificate = parseCertificate(options.certificatePem);
    this.privateKey = parsePrivateKey(options.privateKeyPem);
    this.service = options.service ?? 'wsfe';
    this.now = options.now ?? (() => new Date());
  }

  async getTicket(): Promise<AccessTicket> {
    const now = this.now();
    if (this.cached && this.cached.expiresAt.getTime() - RENEWAL_MARGIN_MS > now.getTime()) return this.cached;
    if (!this.pending) {
      this.pending = this.login(now).finally(() => {
        this.pending = null;
      });
    }
    return this.pending;
  }

  private async login(now: Date): Promise<AccessTicket> {
    const cms = signWith(buildLoginTicketRequest(now, this.service), this.certificate, this.privateKey, now);
    let body: string;
    try {
      body = await postSoap({
        service: 'WSAA',
        url: this.options.url,
        soapAction: '',
        envelope: loginCmsEnvelope(cms),
        timeoutMs: this.options.timeoutMs,
      });
    } catch (error) {
      if (error instanceof ArcaSoapFaultError && isAlreadyAuthenticated(error)) {
        if (this.cached && this.cached.expiresAt.getTime() > this.now().getTime()) return this.cached;
        throw new ArcaUnavailableError(
          'ARCA (WSAA) ya emitió un ticket de acceso vigente que este proceso no tiene en memoria; ' +
            'no se puede facturar hasta que ese ticket venza (hasta 12 h)',
        );
      }
      throw error;
    }
    this.cached = parseLoginCmsResponse(body);
    return this.cached;
  }
}

function loginCmsEnvelope(cms: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body>' +
    `<wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`
  );
}

function isAlreadyAuthenticated(fault: ArcaSoapFaultError): boolean {
  return fault.faultCode.includes('alreadyAuthenticated') || /ya posee un TA v[aá]lido/i.test(fault.faultString);
}

function signWith(tra: string, certificate: forge.pki.Certificate, privateKey: forge.pki.rsa.PrivateKey, now: Date): string {
  const signed = forge.pkcs7.createSignedData();
  signed.content = forge.util.createBuffer(tra, 'utf8');
  signed.addCertificate(certificate);
  signed.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: now.toISOString() },
    ],
  });
  signed.sign();
  return forge.util.encode64(forge.asn1.toDer(signed.toAsn1()).getBytes());
}

// Parse errors are replaced so no PEM fragment ends up in a message or log.
function parseCertificate(pem: string): forge.pki.Certificate {
  try {
    return forge.pki.certificateFromPem(pem);
  } catch {
    throw new Error('ARCA: el certificado (ARCA_CERT_PATH) no es un PEM X.509 válido');
  }
}

function parsePrivateKey(pem: string): forge.pki.rsa.PrivateKey {
  try {
    return forge.pki.privateKeyFromPem(pem) as forge.pki.rsa.PrivateKey;
  } catch {
    throw new Error('ARCA: la clave privada (ARCA_KEY_PATH) no es un PEM RSA válido sin contraseña');
  }
}
