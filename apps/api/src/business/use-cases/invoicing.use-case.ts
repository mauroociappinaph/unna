import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  BusinessRepositoryPort,
  FiscalAuthorizerPort,
  FiscalDocument,
  Order,
  OrderRepositoryPort,
  Page,
  PageRequest,
  Receipt,
  ReceiptIssueUnitOfWorkPort,
  ReceiptRepositoryPort,
  ReceiptSummary,
  resolveFiscalDocument,
} from '@unna/domain';
import { pageOrInvalidCursor } from './page-result';
import { Issuer, ReceiptIssueLease } from './receipt-issue-lease';

export { FiscalAuthorizerUnavailableError } from './receipt-issue-lease';

export const RECEIPT_TYPES = ['ticket', 'A', 'B', 'C'] as const;
export type IssuableReceiptType = (typeof RECEIPT_TYPES)[number];

interface Result<T> {
  ok: boolean;
  value?: T;
  error?: Error;
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(message: string): Result<T> => ({ ok: false, error: new Error(message) });
const notFound = <T>(message: string): Result<T> => ({ ok: false, error: new NotFoundError(message) });

const isOneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  (values as readonly string[]).includes(value);

export interface IssueReceiptCommand {
  type: IssuableReceiptType;
  customerName?: string;
  customerTaxId?: string;
  customerCondition?: string;
}

@Injectable()
export class InvoicingUseCase {
  private readonly issues: ReceiptIssueLease;

  constructor(
    @Inject('OrderRepositoryPort') private readonly orders: OrderRepositoryPort,
    @Inject('ReceiptRepositoryPort') private readonly receipts: ReceiptRepositoryPort,
    @Inject('BusinessRepositoryPort') private readonly businesses: BusinessRepositoryPort,
    @Inject('ReceiptIssueUnitOfWorkPort') unitOfWork: ReceiptIssueUnitOfWorkPort,
    @Inject('FiscalAuthorizerPort') authorizer: FiscalAuthorizerPort,
  ) {
    this.issues = new ReceiptIssueLease(unitOfWork, authorizer);
  }

  /**
   * Issues the receipt of a paid order. Tickets take the next number of their own sequence; A/B/C
   * are authorized by ARCA, without locks held, under the lease of their sequence and keep the
   * number ARCA approved (ReceiptIssueLease, S18). When ARCA rejects or fails, the receipt stays a
   * draft without a number and a retry reuses it.
   */
  async issueReceipt(businessId: string, orderId: string, command: IssueReceiptCommand): Promise<Result<Receipt>> {
    if (!isOneOf(RECEIPT_TYPES, command.type)) return fail('Tipo de comprobante inválido');
    const { type } = command;

    const order = await this.orders.findByIdAndBusinessId(orderId, businessId);
    if (!order) return notFound('Pedido no encontrado');
    if (order.paymentStatus !== 'completed') return fail('El pedido debe estar pagado para emitir un comprobante');

    const business = await this.businesses.findById(businessId);
    if (!business) return notFound('Negocio no encontrado');
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
    return this.issues.issue(scope, issuer, (previous) =>
      Receipt.create({
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
        replaces: previous,
      }),
    );
  }

  async getReceipt(businessId: string, receiptId: string): Promise<Result<Receipt>> {
    const receipt = await this.receipts.findByIdAndBusinessId(receiptId, businessId);
    return receipt ? ok(receipt) : notFound('Comprobante no encontrado');
  }

  /** Newest first, without the items (each receipt carries its itemCount). */
  async listReceipts(businessId: string, page: PageRequest): Promise<Result<Page<ReceiptSummary>>> {
    return pageOrInvalidCursor(await this.receipts.findPageByBusinessId(businessId, page));
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
