import { Injectable } from '@nestjs/common';
import {
  FISCAL_RECEIPT_CODES,
  FiscalAuthorizationError,
  FiscalAuthorizationRequest,
  FiscalAuthorizationResult,
  FiscalAuthorizerPort,
  FiscalReceiptType,
} from '@unna/domain';

const CAE_VALIDITY_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Stand-in for ARCA (WSFEv1) until UNNA has homologation credentials (S12, T30f). Deterministic:
 * it keeps the last number per (issuer, point of sale, type) in memory, approves only the next one
 * and derives the CAE from the receipt. A sequence it has not seen yet accepts its first number,
 * because the real ARCA keeps the history this process loses on restart.
 */
@Injectable()
export class ArcaSimulatedAdapter implements FiscalAuthorizerPort {
  private readonly lastNumbers = new Map<string, number>();
  private outage = false;
  private pendingRejection: FiscalAuthorizationError | null = null;

  /** While on, every call throws, like a timeout or ARCA being down. */
  simulateOutage(on: boolean): void {
    this.outage = on;
  }

  /** The next authorization comes back rejected with this error. */
  rejectNext(error: FiscalAuthorizationError): void {
    this.pendingRejection = error;
  }

  async lastAuthorizedNumber(issuerCuit: string, pointOfSale: number, receiptType: FiscalReceiptType): Promise<number> {
    this.assertAvailable();
    return this.lastNumbers.get(this.key(issuerCuit, pointOfSale, receiptType)) ?? 0;
  }

  async authorize(request: FiscalAuthorizationRequest): Promise<FiscalAuthorizationResult> {
    this.assertAvailable();
    if (this.pendingRejection) {
      const error = this.pendingRejection;
      this.pendingRejection = null;
      return { approved: false, errors: [error] };
    }

    const key = this.key(request.issuerCuit, request.pointOfSale, request.receiptType);
    const last = this.lastNumbers.get(key);
    if (last !== undefined && request.number !== last + 1) {
      return {
        approved: false,
        errors: [{ code: '10016', message: 'El número o fecha del comprobante no se corresponde con el próximo a autorizar' }],
      };
    }

    this.lastNumbers.set(key, request.number);
    return {
      approved: true,
      number: request.number,
      cae: this.cae(request),
      caeExpiration: new Date(request.issueDate.getTime() + CAE_VALIDITY_DAYS * DAY_MS),
    };
  }

  private assertAvailable(): void {
    if (this.outage) throw new Error('ARCA simulado no disponible');
  }

  private key(issuerCuit: string, pointOfSale: number, receiptType: FiscalReceiptType): string {
    return `${issuerCuit}|${pointOfSale}|${receiptType}`;
  }

  /** 14 digits: 7, point of sale (4), receipt code (2), number (7). Unique per sequence and number. */
  private cae(request: FiscalAuthorizationRequest): string {
    const pointOfSale = String(request.pointOfSale % 10_000).padStart(4, '0');
    const code = String(FISCAL_RECEIPT_CODES[request.receiptType]).padStart(2, '0');
    const number = String(request.number % 10_000_000).padStart(7, '0');
    return `7${pointOfSale}${code}${number}`;
  }
}
