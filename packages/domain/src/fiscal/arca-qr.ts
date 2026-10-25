import { FISCAL_RECEIPT_CODES, type FiscalDocType, type FiscalReceiptType } from '../ports/fiscal.port';

export const ARCA_QR_BASE_URL = 'https://www.afip.gob.ar/fe/qr/?p=';

/** Argentina has no daylight saving time: local time is always UTC-3. */
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface ArcaQrInput {
  issueDate: Date;
  issuerCuit: string;
  pointOfSale: number;
  receiptType: FiscalReceiptType;
  number: number;
  /** Receipt total, in cents. */
  totalAmount: number;
  docType: FiscalDocType;
  docNumber: string;
  cae: string;
}

export interface ArcaQrPayload {
  ver: 1;
  fecha: string;
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: 'PES';
  ctz: 1;
  tipoDocRec: number;
  nroDocRec: number;
  tipoCodAut: 'E';
  codAut: number;
}

/** A date as ARCA reads it: YYYY-MM-DD in Argentina time. */
export function arcaDate(date: Date): string {
  return new Date(date.getTime() - ARGENTINA_OFFSET_MS).toISOString().slice(0, 10);
}

/** QR payload defined by RG 4892 for a receipt authorized with a CAE. */
export function arcaQrPayload(input: ArcaQrInput): ArcaQrPayload {
  return {
    ver: 1,
    fecha: arcaDate(input.issueDate),
    cuit: Number(input.issuerCuit),
    ptoVta: input.pointOfSale,
    tipoCmp: FISCAL_RECEIPT_CODES[input.receiptType],
    nroCmp: input.number,
    importe: Number((input.totalAmount / 100).toFixed(2)),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: input.docType,
    nroDocRec: Number(input.docNumber),
    tipoCodAut: 'E',
    codAut: Number(input.cae),
  };
}

/** URL to print as the receipt QR: the payload as base64 JSON. */
export function buildArcaQrUrl(input: ArcaQrInput): string {
  return ARCA_QR_BASE_URL + Buffer.from(JSON.stringify(arcaQrPayload(input))).toString('base64');
}
