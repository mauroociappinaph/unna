import { User } from '../aggregates/user.aggregate';
import { Business } from '../aggregates/business.aggregate';
import { Category } from '../value-objects/category';
import { Product } from '../value-objects/product';
import { ModifierGroup } from '../value-objects/modifier';
import { PriceList } from '../value-objects/price-list';
import { StockLevel, StockMovement } from '../value-objects/stock';
import { Order } from '../value-objects/order';
import { Receipt } from '../value-objects/receipt';

export interface RepositoryPort<T extends { id: string }> {
  save(aggregate: T): Promise<void>;
  findById(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
}

export interface UserRepositoryPort extends RepositoryPort<User> {
  findByEmail(email: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
}

export interface BusinessRepositoryPort extends RepositoryPort<Business> {
  findByOwnerId(ownerId: string): Promise<Business[]>;
  existsByName(name: string): Promise<boolean>;
  existsByCuit(cuit: string): Promise<boolean>;
}

// ============ T23: Catalog ============

export interface CategoryRepositoryPort {
  save(category: Category): Promise<void>;
  findById(id: string): Promise<Category | null>;
  findByBusinessId(businessId: string): Promise<Category[]>;
  findActiveByBusinessId(businessId: string): Promise<Category[]>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<Category | null>;
  delete(id: string): Promise<void>;
}

export interface ProductRepositoryPort {
  save(product: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<Product | null>;
  findByBusinessId(businessId: string): Promise<Product[]>;
  findActiveByBusinessId(businessId: string): Promise<Product[]>;
  findByCategoryId(categoryId: string): Promise<Product[]>;
  findByBusinessIdAndStatus(businessId: string, status: string): Promise<Product[]>;
  delete(id: string): Promise<void>;
}

export interface ModifierGroupRepositoryPort {
  save(group: ModifierGroup): Promise<void>;
  findById(id: string): Promise<ModifierGroup | null>;
  findByBusinessId(businessId: string): Promise<ModifierGroup[]>;
  findActiveByBusinessId(businessId: string): Promise<ModifierGroup[]>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<ModifierGroup | null>;
  delete(id: string): Promise<void>;
}

export interface PriceListRepositoryPort {
  save(list: PriceList): Promise<void>;
  findById(id: string): Promise<PriceList | null>;
  findByBusinessId(businessId: string): Promise<PriceList[]>;
  findActiveByBusinessId(businessId: string): Promise<PriceList[]>;
  findDefaultByBusinessId(businessId: string): Promise<PriceList | null>;
  findValidAt(businessId: string, date: Date, time?: string): Promise<PriceList[]>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<PriceList | null>;
  delete(id: string): Promise<void>;
}

export interface StockLevelRepositoryPort {
  save(level: StockLevel): Promise<void>;
  findByProductId(productId: string): Promise<StockLevel | null>;
  findByBusinessId(businessId: string): Promise<StockLevel[]>;
  findLowStock(businessId: string): Promise<StockLevel[]>;
  delete(productId: string): Promise<void>;
}

export interface StockMovementRepositoryPort {
  save(movement: StockMovement): Promise<void>;
  findByProductId(productId: string): Promise<StockMovement[]>;
  findByBusinessId(businessId: string): Promise<StockMovement[]>;
  findByBusinessIdAndDateRange(businessId: string, from: Date, to: Date): Promise<StockMovement[]>;
}

// ============ T24: Sales / POS ============

export interface OrderListFilters {
  status?: string;
  sucursalId?: string;
  from?: Date;
  to?: Date;
}

export interface OrderRepositoryPort {
  save(order: Order): Promise<void>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<Order | null>;
  findByBusinessId(businessId: string, filters?: OrderListFilters): Promise<Order[]>;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  businessId: string;
  amount: number; // cents
  method: string;
  status: string;
  reference?: string;
  processedAt?: Date;
  createdAt: Date;
}

export interface PaymentRepositoryPort {
  save(payment: PaymentRecord): Promise<void>;
  findByOrderId(orderId: string): Promise<PaymentRecord[]>;
}

export interface ReceiptRepositoryPort {
  save(receipt: Receipt): Promise<void>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<Receipt | null>;
  findByOrderId(orderId: string): Promise<Receipt[]>;
  findByBusinessId(businessId: string): Promise<Receipt[]>;
}
