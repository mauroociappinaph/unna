// Test-only: forge parses the CMS back to inspect it; it never verifies signatures (GHSA-86w9-cpqp-85rv).
import forge from 'node-forge';
import { buildLoginTicketRequest, parseLoginCmsResponse, signLoginTicketRequest, WsaaClient } from '../wsaa.client';
import { loginCmsResponse, soapFault, TestCredentials, throwawayCredentials, xmlResponse } from './arca-test-support';

const WSAA_URL = 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
const NOW = new Date('2026-10-25T15:00:00Z');
const EXPIRES = '2026-10-26T00:00:00.000-03:00';
const ALREADY_AUTHENTICATED = soapFault('ns1:coe.alreadyAuthenticated', 'El CEE ya posee un TA valido para el acceso al WSN solicitado');

describe('WSAA', () => {
  let credentials: TestCredentials;
  let fetchMock: jest.SpyInstance;

  beforeAll(() => {
    credentials = throwawayCredentials();
  });

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const client = (now: () => Date = () => NOW, timeoutMs = 15000) =>
    new WsaaClient({ url: WSAA_URL, ...credentials, timeoutMs, now });

  it('builds the TRA for wsfe with a 10-minute window in Argentine time', () => {
    expect(buildLoginTicketRequest(NOW, 'wsfe')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>' +
        '<uniqueId>1792940400</uniqueId><generationTime>2026-10-25T11:50:00-03:00</generationTime>' +
        '<expirationTime>2026-10-25T12:10:00-03:00</expirationTime></header><service>wsfe</service></loginTicketRequest>',
    );
  });

  it('signs the TRA as attached CMS SignedData with sha256 and the certificate, in bare base64', () => {
    const tra = buildLoginTicketRequest(NOW, 'wsfe');
    const cms = signLoginTicketRequest(tra, credentials.certificatePem, credentials.privateKeyPem);

    expect(cms).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const der = forge.util.decode64(cms);
    const message = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der)) as forge.pkcs7.PkcsSignedData & {
      rawCapture: { content: forge.asn1.Asn1 };
    };
    // forge leaves `content` empty for SignedData; the attached [0] EXPLICIT OCTET STRING is in rawCapture.
    const attached = (message.rawCapture.content.value as forge.asn1.Asn1[])[0];
    expect(attached.type).toBe(forge.asn1.Type.OCTETSTRING);
    expect(forge.util.decodeUtf8(attached.value as string)).toBe(tra);
    expect(message.certificates).toHaveLength(1);
    expect(forge.pki.certificateToPem(message.certificates[0])).toBe(credentials.certificatePem);
    expect(der).toContain(forge.asn1.oidToDer(forge.pki.oids.sha256).getBytes());
  });

  it('refuses a key or certificate it cannot parse without echoing it', () => {
    expect(() => new WsaaClient({ url: WSAA_URL, certificatePem: 'not a cert', privateKeyPem: credentials.privateKeyPem, timeoutMs: 1 })).toThrow(
      'ARCA: el certificado (ARCA_CERT_PATH) no es un PEM X.509 válido',
    );
    expect(() => new WsaaClient({ url: WSAA_URL, certificatePem: credentials.certificatePem, privateKeyPem: 'secret-ish', timeoutMs: 1 })).toThrow(
      'ARCA: la clave privada (ARCA_KEY_PATH) no es un PEM RSA válido sin contraseña',
    );
  });

  it('parses token, sign and expiration from the escaped loginTicketResponse', () => {
    expect(parseLoginCmsResponse(loginCmsResponse('TOK&EN', 'SI+GN=', EXPIRES))).toEqual({
      token: 'TOK&EN',
      sign: 'SI+GN=',
      expiresAt: new Date('2026-10-26T03:00:00Z'),
    });
  });

  it('posts the loginCms envelope and caches the ticket until shortly before it expires', async () => {
    fetchMock.mockResolvedValue(xmlResponse(loginCmsResponse('T1', 'S1', EXPIRES)));
    let now = NOW;
    const wsaa = client(() => now);

    expect(await wsaa.getTicket()).toEqual({ token: 'T1', sign: 'S1', expiresAt: new Date('2026-10-26T03:00:00Z') });
    now = new Date('2026-10-26T02:49:00Z');
    expect(await wsaa.getTicket()).toMatchObject({ token: 'T1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WSAA_URL);
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' } });
    expect(init.body).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?><soapenv:Envelope xmlns:soapenv="http:\/\/schemas\.xmlsoap\.org\/soap\/envelope\/" xmlns:wsaa="http:\/\/wsaa\.view\.sua\.dvadac\.desein\.afip\.gov"><soapenv:Header\/><soapenv:Body><wsaa:loginCms><wsaa:in0>[A-Za-z0-9+/]+=*<\/wsaa:in0><\/wsaa:loginCms><\/soapenv:Body><\/soapenv:Envelope>$/,
    );

    fetchMock.mockResolvedValue(xmlResponse(loginCmsResponse('T2', 'S2', '2026-10-26T12:00:00.000-03:00')));
    now = new Date('2026-10-26T02:51:00Z');
    expect(await wsaa.getTicket()).toMatchObject({ token: 'T2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one login among concurrent callers', async () => {
    fetchMock.mockResolvedValue(xmlResponse(loginCmsResponse('T1', 'S1', EXPIRES)));
    const wsaa = client();

    const tickets = await Promise.all([wsaa.getTicket(), wsaa.getTicket(), wsaa.getTicket()]);

    expect(tickets.map((t) => t.token)).toEqual(['T1', 'T1', 'T1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps using the cached ticket when WSAA says one is still valid', async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse(loginCmsResponse('T1', 'S1', EXPIRES)));
    let now = NOW;
    const wsaa = client(() => now);
    await wsaa.getTicket();

    fetchMock.mockResolvedValueOnce(xmlResponse(ALREADY_AUTHENTICATED, 500));
    now = new Date('2026-10-26T02:55:00Z');

    expect(await wsaa.getTicket()).toMatchObject({ token: 'T1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains the situation when WSAA says a ticket is valid but none is cached', async () => {
    fetchMock.mockResolvedValue(xmlResponse(ALREADY_AUTHENTICATED, 500));

    await expect(client().getTicket()).rejects.toThrow(
      'ARCA (WSAA) ya emitió un ticket de acceso vigente que este proceso no tiene en memoria',
    );
  });

  it('throws on other SOAP faults, non-200 responses, network errors and timeouts', async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse(soapFault('ns1:cms.cert.untrusted', 'Certificado no emitido por AC de confianza'), 500));
    await expect(client().getTicket()).rejects.toThrow('ARCA (WSAA) devolvió un error SOAP: ns1:cms.cert.untrusted - Certificado no emitido por AC de confianza');

    fetchMock.mockResolvedValueOnce(xmlResponse('<html>Bad gateway</html>', 502));
    await expect(client().getTicket()).rejects.toThrow('ARCA (WSAA) respondió HTTP 502');

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(client().getTicket()).rejects.toThrow('ARCA (WSAA) no respondió: fetch failed');

    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    );
    await expect(client(() => NOW, 20).getTicket()).rejects.toThrow('ARCA (WSAA) no respondió en 20 ms');
  });
});
