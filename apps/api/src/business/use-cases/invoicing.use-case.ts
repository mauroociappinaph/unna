import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRepositoryPort,
  FiscalAuthorizationRequest,
  FiscalAuthorizationResult,
  FiscalAuthorizerPort,
  FiscalDocument,
  FiscalReceiptType,
  LockedReceiptIssue,
  Order,
  OrderRepositoryPort,
  Receipt,
  ReceiptIssueUnitOfWorkPort,
  ReceiptRepositoryPort,
  buildArcaQrUrl,
  resolveFiscalDocument,
} from '@unna/domain';

export const RECEIPT_TYPES = ['ticket', 'A', 'B', 'C'] as const;
export type IssuableReceiptType = (typeof RECEIPT_TYPES)[number];

/** ARCA did not answer: the receipt stays a retriable draft. Mapped to 503, not to a client error. */
export class FiscalAuthorizerUnavailableError extends Error {
  constructor() {
    super('ARCA no está disponible en este momento; el comprobante quedó en borrador y podés reintentarlo');
    this.name = 'FiscalAuthorizerUnavailableError';
  }
}

interface Result<T> {
  ok: boolean;
  value?: T;
  error?: Error;
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(message: string): Result<T> => ({ ok: false, error: new Error(message) });

const isOneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  (values as readonly string[]).includes(value);

export interface IssueReceiptCommand {
  type: IssuableReceiptType;
  customerName?: string;
  customerTaxId?: string;
  customerCondition?: string;
}

/** The business data a fiscal receipt needs from ARCA's point of view. */
interface Issuer {
  cuit: string;
  pointOfSale: string;
}

@Injectable()
export class InvoicingUseCase {
  constructor(
    @Inject('OrderRepositoryPort') private readonly orders: OrderRepositoryPort,
    @Inject('ReceiptRepositoryPort') private readonly receipts: ReceiptRepositoryPort,
    @Inject('BusinessRepositoryPort') private readonly businesses: BusinessRepositoryPort,
    @Inject('ReceiptIssueUnitOfWorkPort') private readonly unitOfWork: ReceiptIssueUnitOfWorkPort,
    @Inject('FiscalAuthorizerPort') private readonly authorizer: FiscalAuthorizerPort,
  ) {}

  /**
   * Issues the receipt of a paid order. Tickets take the next number of their own sequence; A/B/C
   * are authorized by ARCA under the lock of their sequence and keep the number ARCA approved.
   * When ARCA rejects or fails, the receipt stays a draft without a number and a retry reuses it.
   */
  async issueReceipt(businessId: string, orderId: string, command: IssueReceiptCommand): Promise<Result<Receipt>> {
    if (!isOneOf(RECEIPT_TYPES, command.type)) return fail('Tipo de comprobante inválido');
    const { type } = command;

    const order = await this.orders.findByIdAndBusinessId(orderId, businessId);
    if (!order) return fail('Pedido no encontrado');
    if (order.paymentStatus !== 'completed') return fail('El pedido debe estar pagado para emitir un comprobante');

    const business = await this.businesses.findById(businessId);
    if (!business) return fail('Negocio no encontrado');
    const issuer: Issuer = { cuit: business.cuit.value, pointOfSale: business.settings.salePoint.padStart(4, '0') };

    let document: FiscalDocument | undefined;
    if (type !== 'ticket') {
      try {
        document = resolveFiscalDocument(business.settings.ivaCondition, type, {
          taxId: command.customerTaxId,
          condition: command.customerCondition,
        });
      } catch (error) {
        return fail((error as Error).message);
      }
    }

    const scope = { businessId, orderId: order.id, pointOfSale: issuer.pointOfSale, receiptType: type };
    return this.unitOfWork.withIssueLock(scope, async (locked) => {
      const existing = await locked.receipts.findByOrderId(order.id);
      if (existing.some((r) => r.status === 'issued')) return fail<Receipt>('El pedido ya tiene un comprobante');

      const draft = Receipt.create({
        businessId,
        sucursalId: order.sucursalId,
        type,
        receiptType: type,
        orderId: order.id,
        orderNumber: order.orderNumber,
        pointOfSale: issuer.pointOfSale,
        paymentMethod: order.paymentMethod ?? 'cash',
        paymentReference: order.paymentReference,
        customerName: command.customerName ?? order.customerName,
        customerTaxId: document && document.docType !== 99 ? document.docNumber : undefined,
        customerCondition: command.customerCondition,
        docType: document?.docType,
        docNumber: document?.docNumber,
        discountAmount: order.discountAmount,
        items: this.receiptLines(order),
        replaces: existing.find((r) => r.status === 'draft'),
      });

      if (type === 'ticket') {
        const number = (await locked.sequence.lastNumber()) + 1;
        await locked.sequence.advanceTo(number);
        const ticket = draft.issueTicket(number);
        await locked.receipts.save(ticket);
        return ok(ticket);
      }
      return this.authorize(draft, type, issuer, locked);
    });
  }

  async getReceipt(businessId: string, receiptId: string): Promise<Result<Receipt>> {
    const receipt = await this.receipts.findByIdAndBusinessId(receiptId, businessId);
    return receipt ? ok(receipt) : fail('Comprobante no encontrado');
  }

  async listReceipts(businessId: string): Promise<Result<Receipt[]>> {
    return ok(await this.receipts.findByBusinessId(businessId));
  }

  /** Runs under the sequence lock: the number advances only when ARCA approves it, so there are no gaps. */
  private async authorize(draft: Receipt, type: FiscalReceiptType, issuer: Issuer, locked: LockedReceiptIssue): Promise<Result<Receipt>> {
    const pointOfSale = Number(issuer.pointOfSale);
    let lastAuthorized: number;
    try {
      lastAuthorized = await this.authorizer.lastAuthorizedNumber(issuer.cuit, pointOfSale, type);
    } catch (error) {
      return this.keepRetriableDraft(draft, error, locked);
    }

    const request: FiscalAuthorizationRequest = {
      issuerCuit: issuer.cuit,
      pointOfSale,
      receiptType: type,
      number: Math.max(await locked.sequence.lastNumber(), lastAuthorized) + 1,
      issueDate: new Date(),
      concept: 1,
      docType: draft.docType!,
      docNumber: draft.docNumber!,
      netAmount: draft.netAmount.toCents(),
      exemptAmount: 0,
      ivaAmount: draft.ivaAmount.toCents(),
      totalAmount: draft.totalAmount.toCents(),
      ivaBreakdown: draft.ivaBreakdown,
      currency: 'PES',
    };
    const requested = draft.setCaeRequest(JSON.stringify(request));

    let result: FiscalAuthorizationResult;
    try {
      result = await this.authorizer.authorize(request);
    } catch (error) {
      return this.keepRetriableDraft(requested, error, locked);
    }

    if (!result.approved) {
      const message = `ARCA rechazó el comprobante: ${result.errors.map((e) => `${e.code} - ${e.message}`).join('; ')}`;
      await locked.receipts.save(requested.failAuthorization(message));
      return fail(message);
    }

    await locked.sequence.advanceTo(result.number);
    const issued = requested.authorize({
      number: result.number,
      cae: result.cae,
      caeExpiration: result.caeExpiration,
      caeResponse: result.raw,
      qrCode: buildArcaQrUrl({
        issueDate: request.issueDate,
        issuerCuit: issuer.cuit,
        pointOfSale,
        receiptType: type,
        number: result.number,
        totalAmount: request.totalAmount,
        docType: request.docType,
        docNumber: request.docNumber,
        cae: result.cae,
      }),
    });
    await locked.receipts.save(issued);
    return ok(issued);
  }

  /** ARCA did not answer (timeout, outage): keep the draft without a number so the cashier can retry. */
  private async keepRetriableDraft(draft: Receipt, error: unknown, locked: LockedReceiptIssue): Promise<Result<Receipt>> {
    await locked.receipts.save(draft.failAuthorization(`ARCA no respondió: ${(error as Error).message}`));
    return { ok: false, error: new FiscalAuthorizerUnavailableError() };
  }

  private receiptLines(order: Order): Parameters<typeof Receipt.create>[0]['items'] {
    return order.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      productSku: i.productSku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      taxRate: i.taxRate,
      taxAmount: i.taxAmount,
      modifiers: i.modifiers,
    }));
  }
}
