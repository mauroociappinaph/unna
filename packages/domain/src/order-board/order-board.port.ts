import type { OrderStatus, OrderType } from '../value-objects/order';

// Read side of the bar queue and the public order board (S13), plus the sucursal display token.

export interface BoardOrderItem {
  productName: string;
  quantity: number;
  /** Names of the chosen modifier options. */
  modifiers: string[];
  notes?: string;
}

export interface BoardOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  type: OrderType;
  customerName?: string;
  tableNumber?: string;
  items: BoardOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardSucursal {
  id: string;
  businessId: string;
  name: string;
}

export interface OrderBoardRepositoryPort {
  /** Null when the sucursal does not exist or belongs to another business. */
  findSucursal(businessId: string, sucursalId: string): Promise<BoardSucursal | null>;
  /** Sucursal whose current display token has this SHA-256 hash (unique lookup); null when none. */
  findSucursalByDisplayTokenHash(tokenHash: string): Promise<BoardSucursal | null>;
  /** Replaces the sucursal's display token hash; null disables the public board. */
  setDisplayTokenHash(businessId: string, sucursalId: string, tokenHash: string | null, createdAt: Date | null): Promise<void>;
  /**
   * Fully paid orders (paymentStatus completed) of the sucursal created in [from, to) whose status
   * is one of `statuses`, oldest first.
   */
  findPaidOrders(
    businessId: string,
    sucursalId: string,
    window: { from: Date; to: Date },
    statuses: readonly OrderStatus[],
  ): Promise<BoardOrder[]>;
}
