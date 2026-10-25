// Contract with the fiscal authority (ARCA, ex AFIP). UNNA authorizes receipts on behalf of each
// business through a delegation to UNNA's own CUIT (S12), so `issuerCuit` is always the café's CUIT.
// Amounts are integer cents; adapters convert to ARCA's decimal pesos.

export type FiscalReceiptType = 'A' | 'B' | 'C';

/** ARCA "CbteTipo" codes for the supported receipt types. */
export const FISCAL_RECEIPT_CODES: Record<FiscalReceiptType, number> = { A: 1, B: 6, C: 11 };

/** ARCA "DocTipo": 80 CUIT, 96 DNI, 99 consumidor final sin identificar (number "0"). */
export type FiscalDocType = 80 | 96 | 99;

/**
 * ARCA "CondicionIVAReceptorId" (RG 5616): 1 responsable inscripto, 4 exento, 5 consumidor final,
 * 6 monotributo. Required on every receipt.
 */
export type FiscalVatCondition = 1 | 4 | 5 | 6;

export interface FiscalIvaLine {
  /** IVA rate as a percentage, e.g. 21 or 10.5. */
  rate: number;
  /** Net taxable base, in cents. */
  base: number;
  /** IVA amount, in cents. */
  amount: number;
}

export interface FiscalAuthorizationRequest {
  issuerCuit: string;
  pointOfSale: number;
  receiptType: FiscalReceiptType;
  /** Number to authorize: the last authorized number + 1. */
  number: number;
  issueDate: Date;
  /** 1 = productos. */
  concept: 1;
  docType: FiscalDocType;
  /** "0" when docType is 99. */
  docNumber: string;
  /** Customer IVA condition as an ARCA code (RG 5616). */
  receiverVatCondition: FiscalVatCondition;
  /** Net taxed amount (A/B). For C receipts the whole total goes here and IVA is 0. */
  netAmount: number;
  exemptAmount: number;
  ivaAmount: number;
  totalAmount: number;
  /** IVA per rate; empty for C receipts. */
  ivaBreakdown: FiscalIvaLine[];
  currency: 'PES';
}

export interface FiscalAuthorizationError {
  code: string;
  message: string;
}

export type FiscalAuthorizationResult =
  | { approved: true; number: number; cae: string; caeExpiration: Date; raw?: string }
  | { approved: false; errors: FiscalAuthorizationError[]; raw?: string };

export interface FiscalAuthorizerPort {
  /** Last number ARCA authorized for (issuer, point of sale, type); 0 when none. */
  lastAuthorizedNumber(issuerCuit: string, pointOfSale: number, receiptType: FiscalReceiptType): Promise<number>;
  /**
   * Requests a CAE. Rejections come back as `approved: false`; transport failures (timeouts,
   * ARCA unavailable) throw, so the caller can keep the receipt as a retriable draft.
   */
  authorize(request: FiscalAuthorizationRequest): Promise<FiscalAuthorizationResult>;
}
