import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  NotFoundError,
  argentinaDayWindow,
  BAR_QUEUE_STATUSES,
  BarQueueColumn,
  BoardOrder,
  bucketBarQueue,
  isWellFormedDisplayToken,
  OrderBoardRepositoryPort,
  OrderStatus,
  OrderType,
  PublicBoardColumn,
  publicBoardColumn,
  publicCustomerName,
  shortOrderNumber,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

export interface BarQueueItem {
  id: string;
  orderNumber: string;
  shortNumber: string;
  status: OrderStatus;
  customerName: string | null;
  type: OrderType;
  tableNumber: string | null;
  items: Array<{ productName: string; quantity: number; modifiers: string[]; notes?: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export type BarQueue = Record<BarQueueColumn, BarQueueItem[]>;

export interface PublicBoardEntry {
  shortNumber: string;
  name: string | null;
  status: PublicBoardColumn;
}

export interface PublicOrderBoard {
  sucursalName: string;
  preparing: PublicBoardEntry[];
  ready: PublicBoardEntry[];
  updatedAt: string;
}

const SUCURSAL_NOT_FOUND = 'Sucursal no encontrada';
// Same answer for malformed, unknown and disabled tokens, so the public route reveals nothing.
const BOARD_NOT_FOUND = 'Pantalla no encontrada';

/** Only the SHA-256 of a display token is stored; lookups hash the presented token. */
export const hashDisplayToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Bar queue, sucursal display token and the public order board (S13). */
@Injectable()
export class OrderBoardUseCase {
  constructor(
    @Inject('OrderBoardRepositoryPort')
    private readonly board: OrderBoardRepositoryPort,
  ) {}

  /** Today's (Argentina) fully paid, still open orders of the sucursal, by column, oldest first. */
  async barQueue(businessId: string, sucursalId: string, now = new Date()): Promise<UseCaseResult<BarQueue>> {
    if (!(await this.board.findSucursal(businessId, sucursalId))) return { ok: false, error: new NotFoundError(SUCURSAL_NOT_FOUND) };
    const orders = await this.board.findPaidOrders(businessId, sucursalId, argentinaDayWindow(now), BAR_QUEUE_STATUSES);
    const buckets = bucketBarQueue(orders);
    return {
      ok: true,
      value: { new: buckets.new.map(toBarQueueItem), preparing: buckets.preparing.map(toBarQueueItem), ready: buckets.ready.map(toBarQueueItem) },
    };
  }

  /** New token for the sucursal's public board, returned only here; it replaces any previous one. */
  async generateDisplayToken(businessId: string, sucursalId: string, now = new Date()): Promise<UseCaseResult<{ token: string; path: string }>> {
    if (!(await this.board.findSucursal(businessId, sucursalId))) return { ok: false, error: new NotFoundError(SUCURSAL_NOT_FOUND) };
    const token = randomBytes(32).toString('base64url');
    await this.board.setDisplayTokenHash(businessId, sucursalId, hashDisplayToken(token), now);
    return { ok: true, value: { token, path: `/pantalla/${token}` } };
  }

  async disableDisplayToken(businessId: string, sucursalId: string): Promise<UseCaseResult<{ ok: true }>> {
    if (!(await this.board.findSucursal(businessId, sucursalId))) return { ok: false, error: new NotFoundError(SUCURSAL_NOT_FOUND) };
    await this.board.setDisplayTokenHash(businessId, sucursalId, null, null);
    return { ok: true, value: { ok: true } };
  }

  /** Public board: short number, first name and status only. Malformed tokens never reach the database. */
  async publicBoard(token: string, now = new Date()): Promise<UseCaseResult<PublicOrderBoard>> {
    if (!isWellFormedDisplayToken(token)) return { ok: false, error: new NotFoundError(BOARD_NOT_FOUND) };
    const sucursal = await this.board.findSucursalByDisplayTokenHash(hashDisplayToken(token));
    if (!sucursal) return { ok: false, error: new NotFoundError(BOARD_NOT_FOUND) };

    const orders = await this.board.findPaidOrders(sucursal.businessId, sucursal.id, argentinaDayWindow(now), BAR_QUEUE_STATUSES);
    const board: PublicOrderBoard = { sucursalName: sucursal.name, preparing: [], ready: [], updatedAt: now.toISOString() };
    for (const order of [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      const status = publicBoardColumn(order.status);
      if (status) board[status].push({ shortNumber: shortOrderNumber(order.orderNumber), name: publicCustomerName(order.customerName), status });
    }
    return { ok: true, value: board };
  }
}

function toBarQueueItem(order: BoardOrder): BarQueueItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    shortNumber: shortOrderNumber(order.orderNumber),
    status: order.status,
    customerName: order.customerName ?? null,
    type: order.type,
    tableNumber: order.tableNumber ?? null,
    items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity, modifiers: i.modifiers, notes: i.notes })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
