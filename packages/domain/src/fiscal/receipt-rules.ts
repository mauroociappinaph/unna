import { CUIT } from '../value-objects/cuit';
import type { IVACondition } from '../value-objects/business-settings';
import type { FiscalDocType, FiscalReceiptType } from '../ports/fiscal.port';

export interface FiscalCustomer {
  /** CUIT (11 digits) or DNI (7-8 digits); dots, dashes and spaces are ignored. */
  taxId?: string;
  /** Customer IVA condition, same values as the business one. */
  condition?: string;
}

export interface FiscalDocument {
  docType: FiscalDocType;
  docNumber: string;
}

const IVA_CONDITIONS: readonly string[] = ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'];
/** Customers that receive a factura A from a responsable inscripto. */
const A_CUSTOMERS: readonly string[] = ['responsable_inscripto', 'monotributo'];

/** Which receipts each issuer condition may emit (S12): RI emits A or B, monotributo and exento emit C. */
function assertTypeAllowed(issuer: IVACondition, type: FiscalReceiptType): void {
  switch (issuer) {
    case 'responsable_inscripto':
      if (type === 'C') throw new Error('Un responsable inscripto emite factura A o B, no C');
      return;
    case 'monotributo':
      if (type !== 'C') throw new Error('Un monotributista solo puede emitir factura C');
      return;
    case 'exento':
      if (type !== 'C') throw new Error('Un exento solo puede emitir factura C');
      return;
    default:
      throw new Error('Un negocio registrado como consumidor final no puede emitir facturas; actualizá su condición de IVA');
  }
}

function assertCustomerCondition(type: FiscalReceiptType, condition: string | undefined): void {
  if (condition === undefined) return;
  if (!IVA_CONDITIONS.includes(condition)) throw new Error('Condición de IVA del cliente inválida');
  if (type === 'A' && !A_CUSTOMERS.includes(condition)) {
    throw new Error('La factura A es para clientes responsables inscriptos o monotributistas; a un consumidor final o exento corresponde factura B');
  }
  if (type === 'B' && A_CUSTOMERS.includes(condition)) {
    throw new Error('A un cliente responsable inscripto o monotributista corresponde factura A');
  }
}

/** ARCA document for the customer: CUIT (80), DNI (96) or consumidor final sin identificar (99, "0"). */
function customerDocument(type: FiscalReceiptType, taxId: string | undefined): FiscalDocument {
  const digits = taxId?.replace(/[-.\s]/g, '') ?? '';
  if (type === 'A') {
    if (!digits) throw new Error('La factura A requiere el CUIT del cliente');
    return { docType: 80, docNumber: CUIT.create(digits).value };
  }
  if (!digits) return { docType: 99, docNumber: '0' };
  if (digits.length === 11) return { docType: 80, docNumber: CUIT.create(digits).value };
  if (/^\d{7,8}$/.test(digits)) return { docType: 96, docNumber: digits };
  throw new Error('Documento del cliente inválido: ingresá un CUIT de 11 dígitos o un DNI de 7 u 8');
}

/**
 * Checks that the business may issue `type` to this customer and returns the customer document
 * to send to ARCA. Throws with the reason when the combination is not allowed.
 */
export function resolveFiscalDocument(issuer: IVACondition, type: FiscalReceiptType, customer: FiscalCustomer): FiscalDocument {
  assertTypeAllowed(issuer, type);
  assertCustomerCondition(type, customer.condition);
  return customerDocument(type, customer.taxId);
}
