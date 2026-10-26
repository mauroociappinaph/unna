import {
  CreateMercadoPagoQrOrderRequest,
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  MercadoPagoOrderStatus,
  Money,
  Order,
  PaymentRecord,
  QrChargeLockedRepositories,
  QrChargeRecord,
  QrChargeRepositoryPort,
  QrChargeUnitOfWorkPort,
} from '@unna/domain';
import { fake } from './test-doubles';
import { BUSINESS, fakeGateway, InMemoryMercadoPagoRepository, NOW, sucursal, testCipher } from './mercadopago-fakes';
import { MercadoPagoAccessTokenProvider } from '../mercadopago-access-token.provider';
import { QrChargeSync } from '../qr-charge-sync';
import { QrChargeUseCase } from '../qr-charge.use-case';

export { BUSINESS, NOW };
export const ACCESS_TOKEN = 'APP_USR-access-1';
const m = (cents: number) => Money.fromCents(cents);

export const newOrder = (businessId = BUSINESS, cents = 12345) =>
  Order.create({
    businessId,
    sucursalId: businessId === BUSINESS ? 'suc-1' : 'suc-B',
    sucursalName: 'Palermo',
    type: 'takeaway',
    items: [{ productId: 'p', productName: 'Café', quantity: 1, unitPrice: m(cents), totalPrice: m(cents), taxRate: 0, taxAmount: m(0), modifiers: [] }],
  });

/** Mercado Pago orders in memory; `pay`, `expire` and `cancel` play the buyer and Mercado Pago. */
export class FakeMercadoPagoOrders {
  orders = new Map<string, MercadoPagoOrder>();
  private next = 1;

  createQrOrder = jest.fn(async (_token: string, request: CreateMercadoPagoQrOrderRequest): Promise<MercadoPagoOrder> => {
    const id = `ORD0${this.next++}TEST`;
    const order: MercadoPagoOrder = {
      id, status: 'created', statusDetail: 'created', externalReference: request.externalReference,
      totalAmount: request.amount, paymentId: null, qrData: `000201-QR-${id}`,
    };
    this.orders.set(id, order);
    return { ...order };
  });

  getOrder = jest.fn(async (_token: string, id: string): Promise<MercadoPagoOrder> => {
    const order = this.orders.get(id);
    if (!order) throw new Error('Mercado Pago respondió 404 (order_not_found)');
    return { ...order, qrData: null };
  });

  cancelOrder = jest.fn(async (_token: string, id: string): Promise<MercadoPagoOrder> => {
    const order = this.orders.get(id);
    if (!order) throw new Error('Mercado Pago respondió 404 (order_not_found)');
    if (order.status !== 'created') throw new Error(`Mercado Pago respondió 409 (order_already_${order.status})`);
    this.set(id, 'canceled');
    return { ...this.orders.get(id)!, qrData: null };
  });

  set(id: string, status: MercadoPagoOrderStatus, patch: Partial<MercadoPagoOrder> = {}) {
    const order = this.orders.get(id)!;
    this.orders.set(id, { ...order, status, statusDetail: status, ...patch });
  }

  pay(id: string) {
    this.set(id, 'processed', { statusDetail: 'accredited', paymentId: `PAY-${id}` });
  }
}

/** Charges with the tenant rules of the Prisma adapter (findById is scoped to the business). */
export class InMemoryQrCharges implements QrChargeRepositoryPort {
  charges = new Map<string, QrChargeRecord>();

  async findById(businessId: string, id: string) {
    const charge = this.charges.get(id);
    return charge && charge.businessId === businessId ? { ...charge } : null;
  }
  async findByMpOrderId(mpOrderId: string) {
    const charge = [...this.charges.values()].find((c) => c.mpOrderId === mpOrderId);
    return charge ? { ...charge } : null;
  }
  async findPendingByOrder(businessId: string, orderId: string) {
    return [...this.charges.values()].filter((c) => c.businessId === businessId && c.orderId === orderId && c.status === 'pending').map((c) => ({ ...c }));
  }
  async create(charge: QrChargeRecord) {
    if ([...this.charges.values()].some((c) => c.mpOrderId === charge.mpOrderId)) throw Object.assign(new Error('Unique'), { code: 'P2002' });
    this.charges.set(charge.id, { ...charge });
  }
  async update(charge: QrChargeRecord) {
    if (charge.paymentId && [...this.charges.values()].some((c) => c.id !== charge.id && c.paymentId === charge.paymentId)) {
      throw Object.assign(new Error('Unique'), { code: 'P2002' });
    }
    this.charges.set(charge.id, { ...charge });
  }
}

/** Orders, payments and cash session of the world, used only while the (queued) order lock is held. */
export class QrWorld {
  orders = new Map<string, Order>();
  payments: PaymentRecord[] = [];
  /** Open cash session per sucursal; delete an entry to close the caja. */
  openCash = new Map<string, string>([['suc-1', 'cash-1'], ['suc-B', 'cash-B']]);
  charges = new InMemoryQrCharges();
  mercadoPago = new FakeMercadoPagoOrders();
  mpRepository = new InMemoryMercadoPagoRepository();
  readonly cipher = testCipher();
  locks: Array<[string, string]> = [];
  private held = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    const { cipher } = this;
    this.mpRepository.sucursales = [
      sucursal({ mpStoreId: 'store-1', mpPosId: 'pos-1', mpPosExternalId: 'UNNAPsuc1', qrImageUrl: 'q', qrTemplateUrl: 't' }),
      sucursal({ id: 'suc-B', businessId: 'biz-B', name: 'Otro café', mpStoreId: 'store-B', mpPosId: 'pos-B', mpPosExternalId: 'UNNAPsucB' }),
    ];
    for (const businessId of [BUSINESS, 'biz-B']) {
      this.mpRepository.connections.set(businessId, {
        businessId, mpUserId: '987654321', liveMode: true, scope: 'offline_access read write',
        encryptedAccessToken: cipher.encrypt(ACCESS_TOKEN), encryptedRefreshToken: cipher.encrypt('TG-refresh-1'),
        accessTokenExpiresAt: new Date('2027-04-23T12:00:00Z'), connectedAt: NOW,
      });
    }
  }

  addOrder(order: Order) {
    this.orders.set(order.id, order);
    return order;
  }

  gateway(): MercadoPagoGatewayPort {
    const { createQrOrder, getOrder, cancelOrder } = this.mercadoPago;
    return { ...fakeGateway(), createQrOrder, getOrder, cancelOrder };
  }

  unitOfWork(): QrChargeUnitOfWorkPort {
    const guard = () => {
      if (!this.held) throw new Error('repository used outside the order lock');
    };
    const repositories: QrChargeLockedRepositories = {
      orders: fake({
        findByIdAndBusinessId: async (id: string, businessId: string) => {
          guard();
          const order = this.orders.get(id);
          return order && order.businessId === businessId ? order : null;
        },
        save: async (o: Order) => { guard(); this.orders.set(o.id, o); },
      }),
      payments: fake({
        findByOrderId: async (orderId: string) => { guard(); return this.payments.filter((p) => p.orderId === orderId); },
        save: async (p: PaymentRecord) => { guard(); this.payments.push(p); },
      }),
      cashSessions: {
        findOpenBySucursalForPayment: async (_businessId: string, sucursalId: string) => {
          guard();
          const id = this.openCash.get(sucursalId);
          return id ? { id } : null;
        },
      },
      qrCharges: this.charges,
    };
    return {
      withOrderLock: <T>(orderId: string, businessId: string, work: (r: QrChargeLockedRepositories) => Promise<T>) => {
        this.locks.push([orderId, businessId]);
        const run = this.queue.then(async () => {
          this.held = true;
          try {
            return await work(repositories);
          } finally {
            this.held = false;
          }
        });
        this.queue = run.catch(() => undefined);
        return run;
      },
    };
  }

  build() {
    const gateway = this.gateway();
    const tokens = new MercadoPagoAccessTokenProvider(this.mpRepository, gateway, this.cipher);
    const unitOfWork = this.unitOfWork();
    const sync = new QrChargeSync(this.charges, unitOfWork, gateway, tokens);
    const useCase = new QrChargeUseCase(
      fake({ findByIdAndBusinessId: async (id: string, businessId: string) => {
        const order = this.orders.get(id);
        return order && order.businessId === businessId ? order : null;
      } }),
      fake({ findOpenBySucursal: async (_businessId: string, sucursalId: string) => (this.openCash.has(sucursalId) ? { id: this.openCash.get(sucursalId) } : null) }),
      this.mpRepository,
      this.charges,
      unitOfWork,
      gateway,
      tokens,
      sync,
    );
    return { sync, useCase };
  }
}
