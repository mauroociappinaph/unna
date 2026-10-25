import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderRepositoryPort,
  OrderListFilters,
  PaymentRepositoryPort,
  PaymentRecord,
  ReceiptRepositoryPort,
  Order,
  OrderItem,
  Receipt,
  ReceiptItem,
  Money,
} from '@unna/domain';

const money = (cents: number) => Money.fromCents(cents, 'ARS');

@Injectable()
export class PrismaOrderRepositoryAdapter implements OrderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(order: Order): Promise<void> {
    const data = {
      businessId: order.businessId,
      sucursalId: order.sucursalId,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      tableNumber: order.tableNumber ?? null,
      customerName: order.customerName ?? null,
      customerPhone: order.customerPhone ?? null,
      customerEmail: order.customerEmail ?? null,
      deliveryAddress: (order.deliveryAddress as any) ?? undefined,
      subtotal: order.subtotal.toCents(),
      taxAmount: order.taxAmount.toCents(),
      discountAmount: order.discountAmount.toCents(),
      totalAmount: order.totalAmount.toCents(),
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod ?? null,
      paymentReference: order.paymentReference ?? null,
      notes: order.notes ?? null,
      sucursalName: order.sucursalName,
      completedAt: order.completedAt ?? null,
      cancelledAt: order.cancelledAt ?? null,
      cancelledReason: order.cancelledReason ?? null,
    };
    await this.prisma.$transaction([
      this.prisma.order.upsert({
        where: { id: order.id },
        create: { id: order.id, ...data, createdAt: order.createdAt },
        update: data,
      }),
      this.prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
      this.prisma.orderItem.createMany({
        data: order.items.map((i) => ({
          id: i.id,
          orderId: order.id,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? null,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toCents(),
          totalPrice: i.totalPrice.toCents(),
          taxRate: i.taxRate,
          taxAmount: i.taxAmount.toCents(),
          notes: i.notes ?? null,
          modifiers: i.modifiers as any,
          createdAt: i.createdAt,
        })),
      }),
    ]);
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<Order | null> {
    const record = await this.prisma.order.findFirst({ where: { id, businessId }, include: { items: true } });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string, filters: OrderListFilters = {}): Promise<Order[]> {
    const records = await this.prisma.order.findMany({
      where: {
        businessId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.sucursalId ? { sucursalId: filters.sucursalId } : {}),
        ...(filters.from || filters.to
          ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
          : {}),
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(r: any): Order {
    return Order.reconstitute({
      id: r.id,
      businessId: r.businessId,
      sucursalId: r.sucursalId,
      orderNumber: r.orderNumber,
      type: r.type,
      status: r.status,
      tableNumber: r.tableNumber ?? undefined,
      customerName: r.customerName ?? undefined,
      customerPhone: r.customerPhone ?? undefined,
      customerEmail: r.customerEmail ?? undefined,
      deliveryAddress: r.deliveryAddress ?? undefined,
      items: (r.items ?? []).map((i: any) =>
        OrderItem.reconstitute({
          id: i.id,
          orderId: i.orderId,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? undefined,
          quantity: i.quantity,
          unitPrice: money(i.unitPrice),
          totalPrice: money(i.totalPrice),
          taxRate: i.taxRate,
          taxAmount: money(i.taxAmount),
          notes: i.notes ?? undefined,
          modifiers: (i.modifiers as any) ?? [],
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        }),
      ),
      subtotal: money(r.subtotal),
      taxAmount: money(r.taxAmount),
      discountAmount: money(r.discountAmount),
      totalAmount: money(r.totalAmount),
      paymentStatus: r.paymentStatus,
      paymentMethod: r.paymentMethod ?? undefined,
      paymentReference: r.paymentReference ?? undefined,
      notes: r.notes ?? undefined,
      sucursalName: r.sucursalName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      completedAt: r.completedAt ?? undefined,
      cancelledAt: r.cancelledAt ?? undefined,
      cancelledReason: r.cancelledReason ?? undefined,
    });
  }
}

@Injectable()
export class PrismaPaymentRepositoryAdapter implements PaymentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(p: PaymentRecord): Promise<void> {
    await this.prisma.payment.create({
      data: {
        id: p.id,
        orderId: p.orderId,
        businessId: p.businessId,
        amount: p.amount,
        method: p.method,
        status: p.status,
        reference: p.reference ?? null,
        processedAt: p.processedAt ?? null,
        createdAt: p.createdAt,
      },
    });
  }

  async findByOrderId(orderId: string): Promise<PaymentRecord[]> {
    const records = await this.prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
    return records.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      businessId: r.businessId,
      amount: r.amount,
      method: r.method,
      status: r.status,
      reference: r.reference ?? undefined,
      processedAt: r.processedAt ?? undefined,
      createdAt: r.createdAt,
    }));
  }
}

@Injectable()
export class PrismaReceiptRepositoryAdapter implements ReceiptRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(receipt: Receipt): Promise<void> {
    const data = {
      businessId: receipt.businessId,
      sucursalId: receipt.sucursalId,
      receiptNumber: receipt.receiptNumber,
      type: receipt.type,
      status: receipt.status,
      orderId: receipt.orderId ?? null,
      orderNumber: receipt.orderNumber ?? null,
      cae: receipt.cae ?? null,
      caeExpiration: receipt.caeExpiration ?? null,
      pointOfSale: receipt.pointOfSale,
      receiptType: receipt.receiptType,
      subtotal: receipt.subtotal.toCents(),
      taxAmount: receipt.taxAmount.toCents(),
      discountAmount: receipt.discountAmount.toCents(),
      totalAmount: receipt.totalAmount.toCents(),
      paymentMethod: receipt.paymentMethod,
      paymentReference: receipt.paymentReference ?? null,
      customerName: receipt.customerName ?? null,
      customerTaxId: receipt.customerTaxId ?? null,
      customerAddress: (receipt.customerAddress as any) ?? undefined,
      customerCondition: receipt.customerCondition ?? null,
      caeRequest: receipt.caeRequest ?? null,
      caeResponse: receipt.caeResponse ?? null,
      pdfUrl: receipt.pdfUrl ?? null,
      qrCode: receipt.qrCode ?? null,
      notes: receipt.notes ?? null,
      issuedAt: receipt.issuedAt ?? null,
      cancelledAt: receipt.cancelledAt ?? null,
      cancelledReason: receipt.cancelledReason ?? null,
    };
    await this.prisma.$transaction([
      this.prisma.receipt.upsert({
        where: { id: receipt.id },
        create: { id: receipt.id, ...data, createdAt: receipt.createdAt },
        update: data,
      }),
      this.prisma.receiptItem.deleteMany({ where: { receiptId: receipt.id } }),
      this.prisma.receiptItem.createMany({
        data: receipt.items.map((i) => ({
          id: i.id,
          receiptId: receipt.id,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? null,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toCents(),
          totalPrice: i.totalPrice.toCents(),
          taxRate: i.taxRate,
          taxAmount: i.taxAmount.toCents(),
          modifiers: i.modifiers as any,
          createdAt: i.createdAt,
        })),
      }),
    ]);
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<Receipt | null> {
    const record = await this.prisma.receipt.findFirst({ where: { id, businessId }, include: { items: true } });
    return record ? this.toDomain(record) : null;
  }

  async findByOrderId(orderId: string): Promise<Receipt[]> {
    const records = await this.prisma.receipt.findMany({ where: { orderId }, include: { items: true } });
    return records.map((r) => this.toDomain(r));
  }

  async findByBusinessId(businessId: string): Promise<Receipt[]> {
    const records = await this.prisma.receipt.findMany({
      where: { businessId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(r: any): Receipt {
    return Receipt.reconstitute({
      id: r.id,
      businessId: r.businessId,
      sucursalId: r.sucursalId,
      receiptNumber: r.receiptNumber,
      type: r.type,
      status: r.status,
      orderId: r.orderId ?? undefined,
      orderNumber: r.orderNumber ?? undefined,
      cae: r.cae ?? undefined,
      caeExpiration: r.caeExpiration ?? undefined,
      pointOfSale: r.pointOfSale,
      receiptType: r.receiptType,
      subtotal: money(r.subtotal),
      taxAmount: money(r.taxAmount),
      discountAmount: money(r.discountAmount),
      totalAmount: money(r.totalAmount),
      paymentMethod: r.paymentMethod,
      paymentReference: r.paymentReference ?? undefined,
      customerName: r.customerName ?? undefined,
      customerTaxId: r.customerTaxId ?? undefined,
      customerAddress: r.customerAddress ?? undefined,
      customerCondition: r.customerCondition ?? undefined,
      caeRequest: r.caeRequest ?? undefined,
      caeResponse: r.caeResponse ?? undefined,
      pdfUrl: r.pdfUrl ?? undefined,
      qrCode: r.qrCode ?? undefined,
      items: (r.items ?? []).map((i: any) =>
        ReceiptItem.reconstitute({
          id: i.id,
          receiptId: i.receiptId,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? undefined,
          quantity: i.quantity,
          unitPrice: money(i.unitPrice),
          totalPrice: money(i.totalPrice),
          taxRate: i.taxRate,
          taxAmount: money(i.taxAmount),
          modifiers: (i.modifiers as any) ?? [],
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        }),
      ),
      notes: r.notes ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      issuedAt: r.issuedAt ?? undefined,
      cancelledAt: r.cancelledAt ?? undefined,
      cancelledReason: r.cancelledReason ?? undefined,
    });
  }
}
