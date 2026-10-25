import { Address } from './address';
import { Money } from './money';

export type ReceiptType = 'A' | 'B' | 'C' | 'ticket' | 'proforma' | 'credit_note' | 'debit_note';
export type ReceiptStatus = 'draft' | 'issued' | 'cancelled' | 'voided';

export interface ReceiptItemProps {
  id: string;
  receiptId: string;
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  taxRate: number;
  taxAmount: Money;
  modifiers?: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export class ReceiptItem {
  public readonly id: string;
  public readonly receiptId: string;
  public readonly productId: string;
  public readonly productName: string;
  public readonly productSku: string | undefined;
  public readonly quantity: number;
  public readonly unitPrice: Money;
  public readonly totalPrice: Money;
  public readonly taxRate: number;
  public readonly taxAmount: Money;
  public readonly modifiers: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: ReceiptItemProps) {
    this.id = props.id;
    this.receiptId = props.receiptId;
    this.productId = props.productId;
    this.productName = props.productName;
    this.productSku = props.productSku;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.totalPrice = props.totalPrice;
    this.taxRate = props.taxRate;
    this.taxAmount = props.taxAmount;
    this.modifiers = props.modifiers ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<ReceiptItemProps, 'id' | 'createdAt' | 'updatedAt'>): ReceiptItem {
    if (!props.productId) throw new Error('Product ID es obligatorio');
    if (!props.productName || !props.productName.trim()) throw new Error('Nombre de producto es obligatorio');
    if (props.quantity <= 0) throw new Error('Cantidad debe ser mayor a 0');
    if (props.unitPrice.amount < 0) throw new Error('Precio unitario no puede ser negativo');
    if (props.taxRate < 0 || props.taxRate > 100) throw new Error('Tasa de impuesto inválida');

    const now = new Date();
    return new ReceiptItem({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ReceiptItemProps): ReceiptItem {
    return new ReceiptItem(props);
  }

  private toProps(): ReceiptItemProps {
    return {
      id: this.id,
      receiptId: this.receiptId,
      productId: this.productId,
      productName: this.productName,
      productSku: this.productSku,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalPrice: this.totalPrice,
      taxRate: this.taxRate,
      taxAmount: this.taxAmount,
      modifiers: this.modifiers,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export interface ReceiptProps {
  id: string;
  businessId: string;
  sucursalId: string;
  receiptNumber: string;       // e.g., "A-0001-00000001"
  type: ReceiptType;
  status: ReceiptStatus;
  orderId?: string;
  orderNumber?: string;
  cae?: string;                // CAE for AFIP (Argentina)
  caeExpiration?: Date;
  pointOfSale: string;         // 4 digits
  receiptType: string;         // 'A', 'B', 'C', etc.
  subtotal: Money;
  taxAmount: Money;
  discountAmount: Money;
  totalAmount: Money;
  paymentMethod: string;
  paymentReference?: string;
  customerName?: string;
  customerTaxId?: string;      // CUIT/DNI
  customerAddress?: Address;
  customerCondition?: string;  // IVA condition
  caeRequest?: string;         // CAE request XML/JSON
  caeResponse?: string;        // CAE response XML/JSON
  pdfUrl?: string;
  qrCode?: string;
  items: ReceiptItem[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  issuedAt?: Date;
  cancelledAt?: Date;
  cancelledReason?: string;
}

export class Receipt {
  public readonly id: string;
  public readonly businessId: string;
  public readonly sucursalId: string;
  public readonly receiptNumber: string;
  public readonly type: ReceiptType;
  public readonly status: ReceiptStatus;
  public readonly orderId: string | undefined;
  public readonly orderNumber: string | undefined;
  public readonly cae: string | undefined;
  public readonly caeExpiration: Date | undefined;
  public readonly pointOfSale: string;
  public readonly receiptType: string;
  public readonly subtotal: Money;
  public readonly taxAmount: Money;
  public readonly discountAmount: Money;
  public readonly totalAmount: Money;
  public readonly paymentMethod: string;
  public readonly paymentReference: string | undefined;
  public readonly customerName: string | undefined;
  public readonly customerTaxId: string | undefined;
  public readonly customerAddress: Address | undefined;
  public readonly customerCondition: string | undefined;
  public readonly caeRequest: string | undefined;
  public readonly caeResponse: string | undefined;
  public readonly pdfUrl: string | undefined;
  public readonly qrCode: string | undefined;
  public readonly items: ReceiptItem[];
  public readonly notes: string | undefined;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly issuedAt: Date | undefined;
  public readonly cancelledAt: Date | undefined;
  public readonly cancelledReason: string | undefined;

  private constructor(props: ReceiptProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.sucursalId = props.sucursalId;
    this.receiptNumber = props.receiptNumber;
    this.type = props.type;
    this.status = props.status;
    this.orderId = props.orderId;
    this.orderNumber = props.orderNumber;
    this.cae = props.cae;
    this.caeExpiration = props.caeExpiration;
    this.pointOfSale = props.pointOfSale;
    this.receiptType = props.receiptType;
    this.subtotal = props.subtotal;
    this.taxAmount = props.taxAmount;
    this.discountAmount = props.discountAmount;
    this.totalAmount = props.totalAmount;
    this.paymentMethod = props.paymentMethod;
    this.paymentReference = props.paymentReference;
    this.customerName = props.customerName;
    this.customerTaxId = props.customerTaxId;
    this.customerAddress = props.customerAddress;
    this.customerCondition = props.customerCondition;
    this.caeRequest = props.caeRequest;
    this.caeResponse = props.caeResponse;
    this.pdfUrl = props.pdfUrl;
    this.qrCode = props.qrCode;
    this.items = props.items;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.issuedAt = props.issuedAt;
    this.cancelledAt = props.cancelledAt;
    this.cancelledReason = props.cancelledReason;
  }

  public static create(props: Omit<ReceiptProps, 'id' | 'createdAt' | 'updatedAt' | 'receiptNumber' | 'subtotal' | 'taxAmount' | 'discountAmount' | 'totalAmount' | 'status' | 'items'> & { items: Array<Omit<ReceiptItemProps, 'id' | 'receiptId' | 'createdAt' | 'updatedAt'>>; discountAmount?: Money }): Receipt {
    if (!props.businessId) throw new Error('Business ID es obligatorio');
    if (!props.sucursalId) throw new Error('Sucursal ID es obligatorio');
    if (!props.pointOfSale || props.pointOfSale.length !== 4) throw new Error('Punto de venta debe ser 4 dígitos');
    if (!props.receiptType || !['A', 'B', 'C', 'ticket', 'proforma', 'credit_note', 'debit_note'].includes(props.receiptType)) {
      throw new Error('Tipo de comprobante inválido');
    }
    if (!props.paymentMethod || !props.paymentMethod.trim()) throw new Error('Método de pago es obligatorio');
    if (!props.items || props.items.length === 0) throw new Error('El comprobante debe tener al menos un item');

    const now = new Date();
    const receiptId = crypto.randomUUID();
    const items = props.items.map(item => ReceiptItem.create({
      ...item,
      receiptId,
    }));

    const subtotal = items.reduce((sum, item) => sum.add(item.totalPrice), Money.zero('ARS'));
    const taxAmount = items.reduce((sum, item) => sum.add(item.taxAmount), Money.zero('ARS'));
    const discountAmount = props.discountAmount ?? Money.zero('ARS');
    if (discountAmount.amount > subtotal.amount) throw new Error('El descuento no puede ser mayor al subtotal');
    const totalAmount = subtotal.add(taxAmount).subtract(discountAmount);

    // Generate receipt number: TYPE-POS-XXXXXXXX
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const receiptNumber = `${props.receiptType}-${props.pointOfSale}-${year}${month}${randomSuffix}`;

    return new Receipt({
      ...props,
      id: receiptId,
      receiptNumber,
      status: 'draft',
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      items,
      createdAt: now,
      updatedAt: now,
    } as ReceiptProps);
  }

  public static reconstitute(props: ReceiptProps): Receipt {
    return new Receipt(props);
  }

  public issue(cae?: string, caeExpiration?: Date, caeResponse?: string): Receipt {
    if (this.status !== 'draft') throw new Error('Solo borradores pueden emitirse');
    return new Receipt({
      ...this.toProps(),
      status: 'issued',
      cae,
      caeExpiration,
      caeResponse,
      issuedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public cancel(reason: string): Receipt {
    if (this.status !== 'issued') throw new Error('Solo comprobantes emitidos pueden cancelarse');
    return new Receipt({
      ...this.toProps(),
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason,
      updatedAt: new Date(),
    });
  }

  public voidReceipt(reason: string): Receipt {
    if (this.status !== 'issued') throw new Error('Solo comprobantes emitidos pueden anularse');
    return new Receipt({
      ...this.toProps(),
      status: 'voided',
      cancelledAt: new Date(),
      cancelledReason: reason,
      updatedAt: new Date(),
    });
  }

  public setPdfUrl(url: string): Receipt {
    return new Receipt({
      ...this.toProps(),
      pdfUrl: url,
      updatedAt: new Date(),
    });
  }

  public setQrCode(qr: string): Receipt {
    return new Receipt({
      ...this.toProps(),
      qrCode: qr,
      updatedAt: new Date(),
    });
  }

  public setCaeRequest(request: string): Receipt {
    return new Receipt({
      ...this.toProps(),
      caeRequest: request,
      updatedAt: new Date(),
    });
  }

  private toProps(): ReceiptProps {
    return {
      id: this.id,
      businessId: this.businessId,
      sucursalId: this.sucursalId,
      receiptNumber: this.receiptNumber,
      type: this.type,
      status: this.status,
      orderId: this.orderId,
      orderNumber: this.orderNumber,
      cae: this.cae,
      caeExpiration: this.caeExpiration,
      pointOfSale: this.pointOfSale,
      receiptType: this.receiptType,
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      discountAmount: this.discountAmount,
      totalAmount: this.totalAmount,
      paymentMethod: this.paymentMethod,
      paymentReference: this.paymentReference,
      customerName: this.customerName,
      customerTaxId: this.customerTaxId,
      customerAddress: this.customerAddress,
      customerCondition: this.customerCondition,
      caeRequest: this.caeRequest,
      caeResponse: this.caeResponse,
      pdfUrl: this.pdfUrl,
      qrCode: this.qrCode,
      items: this.items,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      issuedAt: this.issuedAt,
      cancelledAt: this.cancelledAt,
      cancelledReason: this.cancelledReason,
    };
  }
}