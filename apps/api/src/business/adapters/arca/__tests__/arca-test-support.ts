// Test-only: forge creates a throwaway key pair and a self-signed certificate; nothing here verifies signatures.
import forge from 'node-forge';
import { FiscalAuthorizationRequest } from '@unna/domain';

export interface TestCredentials {
  certificatePem: string;
  privateKeyPem: string;
}

export function throwawayCredentials(): TestCredentials {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01';
  certificate.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  certificate.validity.notAfter = new Date('2028-01-01T00:00:00Z');
  const subject = [{ name: 'commonName', value: 'unna-test' }];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certificatePem: forge.pki.certificateToPem(certificate),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

export const xmlResponse = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });

export const soapFault = (code: string, message: string): string =>
  '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>' +
  `<soapenv:Fault><faultcode xmlns:ns1="http://xml.apache.org/axis/">${code}</faultcode><faultstring>${message}</faultstring></soapenv:Fault>` +
  '</soapenv:Body></soapenv:Envelope>';

/** loginCmsReturn carries the ticket XML escaped, as WSAA sends it. */
export const loginCmsResponse = (token: string, sign: string, expirationTime: string): string => {
  const ticket =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><loginTicketResponse version="1.0"><header><source>CN=wsaahomo</source>' +
    '<destination>SERIALNUMBER=CUIT 30700000006, CN=unna</destination><uniqueId>123</uniqueId>' +
    `<generationTime>2026-10-25T12:00:00.000-03:00</generationTime><expirationTime>${expirationTime}</expirationTime></header>` +
    `<credentials><token>${token}</token><sign>${sign}</sign></credentials></loginTicketResponse>`;
  const escaped = ticket.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return (
    '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>' +
    `<loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov"><loginCmsReturn>${escaped}</loginCmsReturn></loginCmsResponse>` +
    '</soapenv:Body></soapenv:Envelope>'
  );
};

export const wsfeEnvelope = (inner: string): string =>
  '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body>' +
  `${inner}</soap:Body></soap:Envelope>`;

export const lastAuthorizedResponse = (number: number): string =>
  wsfeEnvelope(
    '<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult>' +
      `<PtoVta>3</PtoVta><CbteTipo>6</CbteTipo><CbteNro>${number}</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`,
  );

export const caeResponse = (detail: string, extra = '', cabResult = 'A'): string =>
  wsfeEnvelope(
    '<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>' +
      `<FeCabResp><Cuit>30712345671</Cuit><PtoVta>3</PtoVta><CbteTipo>1</CbteTipo><FchProceso>20261025120000</FchProceso><CantReg>1</CantReg><Resultado>${cabResult}</Resultado><Reproceso>N</Reproceso></FeCabResp>` +
      `<FeDetResp><FECAEDetResponse>${detail}</FECAEDetResponse></FeDetResp>${extra}` +
      '</FECAESolicitarResult></FECAESolicitarResponse>',
  );

export const fiscalRequest = (overrides: Partial<FiscalAuthorizationRequest> = {}): FiscalAuthorizationRequest => ({
  issuerCuit: '30712345671',
  pointOfSale: 3,
  receiptType: 'A',
  number: 42,
  // 01:30 UTC on Oct 26 is still Oct 25 in Argentina.
  issueDate: new Date('2026-10-26T01:30:00Z'),
  concept: 1,
  docType: 80,
  docNumber: '20123456786',
  receiverVatCondition: 1,
  netAmount: 200000,
  exemptAmount: 0,
  ivaAmount: 31500,
  totalAmount: 231500,
  ivaBreakdown: [
    { rate: 21, base: 100000, amount: 21000 },
    { rate: 10.5, base: 100000, amount: 10500 },
  ],
  currency: 'PES',
  ...overrides,
});
