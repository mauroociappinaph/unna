import {
  CashSessionRepositoryPort,
  Category,
  CategoryRepositoryPort,
  CreateMercadoPagoOnlineOrderRequest,
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  MercadoPagoOrderStatus,
  ModifierGroup,
  ModifierGroupRepositoryPort,
  ModifierOption,
  Money,
  OnlineCheckoutLockedRepositories,
  OnlineCheckoutRecord,
  OnlineCheckoutRepositoryPort,
  OnlineCheckoutUnitOfWorkPort,
  Order,
  PaymentRecord,
  PreorderLocal,
  PreorderRepositoryPort,
  PreorderSucursal,
  Product,
  ProductRepositoryPort,
  Schedule,
} from '@unna/domain';
import { fake } from './test-doubles';
import { fakeGateway, InMemoryMercadoPagoRepository, testCipher } from './mercadopago-fakes';
import { MercadoPagoAccessTokenProvider } from '../mercadopago-access-token.provider';
import { OnlineCheckoutSync } from '../online-checkout-sync';
import { OnlineCheckoutUseCase } from '../online-checkout.use-case';
import { OrderTrackingUseCase } from '../order-tracking.use-case';
import { PreorderLocalLookup } from '../preorder-local-lookup';
import { PreorderSettingsUseCase } from '../preorder-settings.use-case';
import { PublicMenuUseCase } from '../public-menu.use-case';

export const BUSINESS = 'biz-A';
export const SLUG = 'Pa_slug-0123456789ab';
/** Monday 12:00 in Argentina. */
export const NOW = new Date('2026-10-26T15:00:00Z');
export const ACCESS_TOKEN = 'APP_USR-access-1';
const CREATED = new Date('2026-01-01T00:00:00Z');

export const CAFE = 'a0000000-0000-4000-8000-000000000001';
export const MEDIALUNA = 'a0000000-0000-4000-8000-000000000002';
export const DRAFT = 'a0000000-0000-4000-8000-000000000003';
export const MILK = 'b0000000-0000-4000-8000-000000000001';
export const OAT = 'c0000000-0000-4000-8000-000000000001';
export const WHOLE = 'c0000000-0000-4000-8000-000000000002';

const product = (id: string, name: string, cents: number, extra: Partial<Parameters<typeof Product.reconstitute>[0]> = {}) =>
  Product.reconstitute({
    id, businessId: BUSINESS, categoryId: 'cat-1', name, type: 'simple', status: 'active', basePrice: Money.fromCents(cents), taxRate: 21,
    displayOrder: 0, isActive: true, images: [], modifierGroupIds: [], createdAt: CREATED, updatedAt: CREATED, ...extra,
  });

const option = (id: string, name: string, priceDelta: number, isActive = true) =>
  ModifierOption.reconstitute({ id, name, priceDelta, isDefault: false, displayOrder: 0, isActive });

/** Products, modifiers, categories, the sucursal and its caja, the Mercado Pago account and orders. */
export class PreorderWorld {
  local: PreorderLocal = {
    id: 'suc-1', businessId: BUSINESS, name: 'Palermo', isActive: true, enabled: true, slug: SLUG,
    businessName: 'Café UNNA', businessActive: true, schedule: Schedule.create({}),
  };
  sucursales: PreorderSucursal[] = [
    { id: 'suc-1', businessId: BUSINESS, name: 'Palermo', isActive: true, enabled: false, slug: null },
    { id: 'suc-2', businessId: BUSINESS, name: 'Belgrano', isActive: true, enabled: false, slug: null },
    { id: 'suc-B', businessId: 'biz-B', name: 'Otro café', isActive: true, enabled: true, slug: 'Other_slug-0123456789' },
  ];
  products: Product[] = [
    product(CAFE, 'Café con leche', 100000, { modifierGroupIds: [MILK], preparationTimeMinutes: 4, images: ['https://img/cafe.png'], description: 'Doble' }),
    product(MEDIALUNA, 'Medialuna', 50000, { preparationTimeMinutes: 2 }),
    product(DRAFT, 'Torta', 300000, { status: 'draft' }),
  ];
  groups: ModifierGroup[] = [
    ModifierGroup.reconstitute({
      id: MILK, businessId: BUSINESS, name: 'Leche', minSelection: 1, maxSelection: 1, isRequired: true, displayOrder: 0, isActive: true,
      options: [option(OAT, 'Avena', 20000), option(WHOLE, 'Entera', 0), option('c-off', 'Almendras', 30000, false)], createdAt: CREATED, updatedAt: CREATED,
    }),
  ];
  categories = [
    Category.reconstitute({ id: 'cat-1', businessId: BUSINESS, name: 'Cafetería', type: 'bebida', displayOrder: 0, isActive: true, createdAt: CREATED, updatedAt: CREATED }),
    Category.reconstitute({ id: 'cat-empty', businessId: BUSINESS, name: 'Vacía', type: 'plato', displayOrder: 1, isActive: true, createdAt: CREATED, updatedAt: CREATED }),
  ];
  openCash = new Map<string, string>([['suc-1', 'cash-1']]);
  orders = new Map<string, Order>();
  payments: PaymentRecord[] = [];
  checkouts = new InMemoryCheckouts();
  mercadoPago = new FakeOnlineOrders(this);
  mpRepository = new InMemoryMercadoPagoRepository();
  readonly cipher = testCipher();
  /** Set while work runs under the (fake) checkout lock: Mercado Pago must never be called then. */
  lockHeld = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    this.connect();
    this.checkouts.orderLookup = (id) => this.orders.get(id);
  }

  connect() {
    this.mpRepository.connections.set(BUSINESS, {
      businessId: BUSINESS, mpUserId: '987654321', liveMode: true, scope: 'offline_access read write',
      encryptedAccessToken: this.cipher.encrypt(ACCESS_TOKEN), encryptedRefreshToken: this.cipher.encrypt('TG-refresh-1'),
      accessTokenExpiresAt: new Date('2027-04-23T12:00:00Z'), connectedAt: NOW,
    });
  }

  preorders(): PreorderRepositoryPort {
    return {
      listSucursales: async (businessId) => this.sucursales.filter((s) => s.businessId === businessId).map((s) => ({ ...s })),
      findSucursal: async (businessId, id) => {
        const found = this.sucursales.find((s) => s.businessId === businessId && s.id === id);
        return found ? { ...found } : null;
      },
      findEnabledBySlug: async (slug) => (this.local.enabled && this.local.slug === slug ? { ...this.local } : null),
      enable: async (businessId, id, candidate) => {
        const found = this.sucursales.find((s) => s.businessId === businessId && s.id === id);
        if (!found) return null;
        found.slug = found.slug ?? candidate;
        found.enabled = true;
        return found.slug;
      },
      disable: async (businessId, id) => {
        const found = this.sucursales.find((s) => s.businessId === businessId && s.id === id);
        if (found) found.enabled = false;
      },
    };
  }

  unitOfWork(): OnlineCheckoutUnitOfWorkPort {
    const guard = () => {
      if (!this.lockHeld) throw new Error('repository used outside the checkout lock');
    };
    const repositories: OnlineCheckoutLockedRepositories = {
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
      checkouts: this.checkouts,
    };
    return {
      withCheckoutLock: <T>(_checkoutId: string, work: (r: OnlineCheckoutLockedRepositories) => Promise<T>) => {
        const run = this.queue.then(async () => {
          this.lockHeld = true;
          try {
            return await work(repositories);
          } finally {
            this.lockHeld = false;
          }
        });
        this.queue = run.catch(() => undefined);
        return run;
      },
    };
  }

  gateway(): MercadoPagoGatewayPort {
    const { createOnlineOrder, getOrder } = this.mercadoPago;
    return { ...fakeGateway(), createOnlineOrder, getOrder };
  }

  build() {
    const gateway = this.gateway();
    const tokens = new MercadoPagoAccessTokenProvider(this.mpRepository, gateway, this.cipher);
    const preorders = this.preorders();
    const cashSessions = fake<CashSessionRepositoryPort>({ findOpenBySucursal: async (_b: string, sucursalId: string) => (this.openCash.has(sucursalId) ? { id: this.openCash.get(sucursalId) } : null) });
    const lookup = new PreorderLocalLookup(preorders, cashSessions, this.mpRepository);
    const productRepository = fake<ProductRepositoryPort>({
      findByIdAndBusinessId: async (id: string, businessId: string) => this.products.find((p) => p.id === id && p.businessId === businessId) ?? null,
      findActiveByBusinessId: async () => this.products.filter((p) => p.isActive && p.status === 'active'),
    });
    const groupRepository = fake<ModifierGroupRepositoryPort>({
      findByIdAndBusinessId: async (id: string, businessId: string) => this.groups.find((g) => g.id === id && g.businessId === businessId) ?? null,
      findActiveByBusinessId: async () => this.groups.filter((g) => g.isActive),
    });
    const categoryRepository = fake<CategoryRepositoryPort>({ findActiveByBusinessId: async () => this.categories.filter((c) => c.isActive) });
    const sync = new OnlineCheckoutSync(this.checkouts, this.unitOfWork(), gateway, tokens);
    return {
      sync,
      settings: new PreorderSettingsUseCase(preorders),
      menu: new PublicMenuUseCase(lookup, categoryRepository, productRepository, groupRepository),
      checkout: new OnlineCheckoutUseCase(lookup, productRepository, groupRepository, this.checkouts, gateway, tokens),
      tracking: new OrderTrackingUseCase(this.checkouts, sync),
    };
  }
}

/** Online orders of Mercado Pago in memory; they fail loudly if called while the checkout lock is held. */
export class FakeOnlineOrders {
  orders = new Map<string, MercadoPagoOrder>();
  requests: CreateMercadoPagoOnlineOrderRequest[] = [];
  failNextCreate = false;
  private next = 1;

  constructor(private readonly world: { lockHeld: boolean }) {}

  createOnlineOrder = jest.fn(async (_token: string, request: CreateMercadoPagoOnlineOrderRequest) => {
    if (this.world.lockHeld) throw new Error('Mercado Pago called inside a transaction');
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error('Mercado Pago respondió 500');
    }
    this.requests.push(request);
    const id = `ORD0${this.next++}ONLINE`;
    this.orders.set(id, { id, status: 'created', statusDetail: 'created', externalReference: request.externalReference, totalAmount: request.amount, paymentId: null, qrData: null });
    return { id, status: 'created' as const, checkoutUrl: `https://mp.example/checkout/${id}` };
  });

  getOrder = jest.fn(async (_token: string, id: string): Promise<MercadoPagoOrder> => {
    if (this.world.lockHeld) throw new Error('Mercado Pago called inside a transaction');
    const order = this.orders.get(id);
    if (!order) throw new Error('Mercado Pago respondió 404 (order_not_found)');
    return { ...order };
  });

  set(id: string, status: MercadoPagoOrderStatus, patch: Partial<MercadoPagoOrder> = {}) {
    this.orders.set(id, { ...this.orders.get(id)!, status, statusDetail: status, ...patch });
  }

  pay(id: string) {
    this.set(id, 'processed', { statusDetail: 'accredited', paymentId: `PAY-${id}` });
  }
}

/** Checkouts with the unique rules of the Prisma adapter (mpOrderId, orderId, paymentId). */
export class InMemoryCheckouts implements OnlineCheckoutRepositoryPort {
  rows = new Map<string, OnlineCheckoutRecord>();
  orderLookup: (orderId: string) => Order | undefined = () => undefined;

  async create(checkout: OnlineCheckoutRecord) {
    this.rows.set(checkout.id, structuredClone(checkout));
  }
  async findById(id: string) {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }
  async findByMpOrderId(mpOrderId: string) {
    const row = [...this.rows.values()].find((c) => c.mpOrderId === mpOrderId);
    return row ? structuredClone(row) : null;
  }
  async findTrackingByTokenHash(hash: string) {
    const row = [...this.rows.values()].find((c) => c.trackingTokenHash === hash);
    if (!row) return null;
    const order = row.orderId ? this.orderLookup(row.orderId) : undefined;
    return { checkout: structuredClone(row), businessName: 'Café UNNA', order: order ? { orderNumber: order.orderNumber, status: order.status, updatedAt: order.updatedAt } : null };
  }
  async attachMercadoPagoOrder(id: string, mpOrderId: string, checkoutUrl: string) {
    const row = this.rows.get(id)!;
    if (!row.mpOrderId) this.rows.set(id, { ...row, mpOrderId, checkoutUrl });
  }
  async update(checkout: OnlineCheckoutRecord) {
    for (const key of ['orderId', 'paymentId'] as const) {
      const value = checkout[key];
      if (value && [...this.rows.values()].some((c) => c.id !== checkout.id && c[key] === value)) throw Object.assign(new Error('Unique'), { code: 'P2002' });
    }
    this.rows.set(checkout.id, structuredClone(checkout));
  }
}
