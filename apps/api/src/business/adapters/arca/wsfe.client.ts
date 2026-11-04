import {
  FISCAL_RECEIPT_CODES,
  FiscalAuthorizationError,
  FiscalAuthorizationRequest,
  FiscalAuthorizationResult,
  FiscalIvaLine,
  FiscalReceiptType,
} from '@unna/domain';
import { argentineDate, parseArgentineDate } from './argentina-time';
import { ArcaUnavailableError, postSoap } from './soap';
import { element, innerXml, innerXmlAll, textOf } from './xml';

export { argentineDate } from './argentina-time';

const NAMESPACE = 'http://ar.gov.afip.dif.FEV1/';

/** WSFE Auth: UNNA's ticket, acting for the café's CUIT through its "wsfe" delegation (S12). */
export interface WsfeAuth {
  token: string;
  sign: string;
  cuit: string;
}

/** ARCA "AlicIva.Id" per IVA rate (percentage). */
export const IVA_RATE_CODES: ReadonlyMap<number, number> = new Map([
  [0, 3],
  [2.5, 9],
  [5, 8],
  [10.5, 4],
  [21, 5],
  [27, 6],
]);

/** Integer cents → pesos with exactly two decimals, without floating-point rounding. */
export function formatPesos(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(`Importe inválido para ARCA: ${cents} centavos`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

const ar = (name: string, text: string | number): string => element(`ar:${name}`, text);

function envelope(operation: string, auth: WsfeAuth, body: string): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${NAMESPACE}">` +
    `<soap:Body><ar:${operation}><ar:Auth>${ar('Token', auth.token)}${ar('Sign', auth.sign)}${ar('Cuit', auth.cuit)}</ar:Auth>` +
    `${body}</ar:${operation}></soap:Body></soap:Envelope>`
  );
}

export function buildFECompUltimoAutorizadoEnvelope(auth: WsfeAuth, pointOfSale: number, receiptType: FiscalReceiptType): string {
  return envelope('FECompUltimoAutorizado', auth, ar('PtoVta', pointOfSale) + ar('CbteTipo', FISCAL_RECEIPT_CODES[receiptType]));
}

/** One receipt; elements follow the WSDL sequence order. */
export function buildFECAESolicitarEnvelope(auth: WsfeAuth, request: FiscalAuthorizationRequest): string {
  const header = ar('CantReg', 1) + ar('PtoVta', request.pointOfSale) + ar('CbteTipo', FISCAL_RECEIPT_CODES[request.receiptType]);
  const iva = request.receiptType !== 'C' && request.ivaBreakdown.length > 0 ? `<ar:Iva>${request.ivaBreakdown.map(alicIva).join('')}</ar:Iva>` : '';
  const detail =
    ar('Concepto', request.concept) +
    ar('DocTipo', request.docType) +
    ar('DocNro', request.docNumber) +
    ar('CbteDesde', request.number) +
    ar('CbteHasta', request.number) +
    ar('CbteFch', argentineDate(request.issueDate)) +
    ar('ImpTotal', formatPesos(request.totalAmount)) +
    ar('ImpTotConc', formatPesos(0)) +
    ar('ImpNeto', formatPesos(request.netAmount)) +
    ar('ImpOpEx', formatPesos(request.exemptAmount)) +
    ar('ImpTrib', formatPesos(0)) +
    ar('ImpIVA', formatPesos(request.ivaAmount)) +
    ar('MonId', request.currency) +
    ar('MonCotiz', 1) +
    // RG 5616: customer IVA condition, right after MonCotiz as in the WSDL sequence.
    ar('CondicionIVAReceptorId', request.receiverVatCondition) +
    iva;
  return envelope(
    'FECAESolicitar',
    auth,
    `<ar:FeCAEReq><ar:FeCabReq>${header}</ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>${detail}</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`,
  );
}

function alicIva(line: FiscalIvaLine): string {
  const code = IVA_RATE_CODES.get(line.rate);
  if (code === undefined) throw new Error(`Alícuota de IVA no soportada por ARCA: ${line.rate}%`);
  return `<ar:AlicIva>${ar('Id', code)}${ar('BaseImp', formatPesos(line.base))}${ar('Importe', formatPesos(line.amount))}</ar:AlicIva>`;
}

/** `Code`/`Msg` pairs of every `item` element (Obs, Err) inside `xml`. */
function codedMessages(xml: string, item: string): FiscalAuthorizationError[] {
  return innerXmlAll(xml, item).map((entry) => ({ code: textOf(entry, 'Code') ?? '', message: textOf(entry, 'Msg') ?? '' }));
}

const describeErrors = (errors: FiscalAuthorizationError[]): string => errors.map((e) => `${e.code} - ${e.message}`).join('; ');

export function parseFECompUltimoAutorizadoResponse(body: string): number {
  const result = innerXml(body, 'FECompUltimoAutorizadoResult');
  if (result === undefined) throw new ArcaUnavailableError('ARCA (WSFEv1) FECompUltimoAutorizado: respuesta inesperada');
  const errors = codedMessages(innerXml(result, 'Errors') ?? '', 'Err');
  if (errors.length > 0) {
    throw new ArcaUnavailableError(`ARCA (WSFEv1) FECompUltimoAutorizado devolvió errores: ${describeErrors(errors)}`);
  }
  const number = Number(textOf(result, 'CbteNro'));
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ArcaUnavailableError('ARCA (WSFEv1) FECompUltimoAutorizado: respuesta inesperada');
  }
  return number;
}

/** `raw` keeps the response XML, which carries no token, sign or key material. */
export function parseFECAESolicitarResponse(body: string, requestedNumber: number): FiscalAuthorizationResult {
  const result = innerXml(body, 'FECAESolicitarResult');
  if (result === undefined) throw new ArcaUnavailableError('ARCA (WSFEv1) FECAESolicitar: respuesta inesperada');

  const detail = innerXml(result, 'FECAEDetResponse') ?? '';
  const outcome = textOf(detail, 'Resultado') ?? textOf(innerXml(result, 'FeCabResp') ?? '', 'Resultado');
  const errors = [
    ...codedMessages(innerXml(detail, 'Observaciones') ?? '', 'Obs'),
    ...codedMessages(innerXml(result, 'Errors') ?? '', 'Err'),
  ];

  if (outcome === 'A') {
    const cae = textOf(detail, 'CAE');
    const expiration = textOf(detail, 'CAEFchVto');
    if (!cae || !expiration) throw new ArcaUnavailableError('ARCA (WSFEv1) FECAESolicitar: aprobado sin CAE');
    const number = Number(textOf(detail, 'CbteDesde') ?? requestedNumber);
    return { approved: true, number, cae, caeExpiration: parseArgentineDate(expiration), raw: body };
  }
  if (outcome === 'R' || errors.length > 0) return { approved: false, errors, raw: body };
  throw new ArcaUnavailableError('ARCA (WSFEv1) FECAESolicitar: respuesta inesperada');
}

export interface WsfeClientOptions {
  url: string;
  timeoutMs: number;
}

export class WsfeClient {
  constructor(private readonly options: WsfeClientOptions) {}

  async lastAuthorized(auth: WsfeAuth, pointOfSale: number, receiptType: FiscalReceiptType): Promise<number> {
    const body = await this.call('FECompUltimoAutorizado', buildFECompUltimoAutorizadoEnvelope(auth, pointOfSale, receiptType));
    return parseFECompUltimoAutorizadoResponse(body);
  }

  async requestCae(auth: WsfeAuth, request: FiscalAuthorizationRequest): Promise<FiscalAuthorizationResult> {
    const body = await this.call('FECAESolicitar', buildFECAESolicitarEnvelope(auth, request));
    return parseFECAESolicitarResponse(body, request.number);
  }

  private call(operation: string, envelopeXml: string): Promise<string> {
    return postSoap({
      service: 'WSFEv1',
      url: this.options.url,
      soapAction: `${NAMESPACE}${operation}`,
      envelope: envelopeXml,
      timeoutMs: this.options.timeoutMs,
    });
  }
}
