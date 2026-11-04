// A cash register shift (caja y turno, S12): one open session per sucursal, an opening float,
// cash put in or taken out, and a close that compares what the cashier counted against what the
// session should hold for each payment method. Amounts are integer cents.

export const CASH_PAYMENT_METHODS = ['cash', 'card', 'mercado_pago', 'transfer', 'qr'] as const;
export type CashPaymentMethod = (typeof CASH_PAYMENT_METHODS)[number];
/** One amount per payment method, in cents. */
export type CashAmounts = Record<CashPaymentMethod, number>;

export const CASH_MOVEMENT_TYPES = ['in', 'out'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];
export type CashSessionStatus = 'open' | 'closed';

export interface CashMovement {
  id: string;
  sessionId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: Date;
}

/** A payment as the close sees it; only completed payments count. */
export interface CashSessionPayment {
  method: string;
  amount: number;
  status: string;
}

export interface CashSessionProps {
  id: string;
  businessId: string;
  sucursalId: string;
  status: CashSessionStatus;
  openedBy: string;
  openedAt: Date;
  openingAmount: number;
  movements: CashMovement[];
  closedBy?: string;
  closedAt?: Date;
  expected?: CashAmounts;
  declared?: CashAmounts;
  difference?: CashAmounts;
  notes?: string;
}

const isCents = (value: number) => Number.isInteger(value) && value >= 0;

const byMethod = (amount: (method: CashPaymentMethod) => number): CashAmounts =>
  Object.fromEntries(CASH_PAYMENT_METHODS.map((method) => [method, amount(method)])) as CashAmounts;

/** Cash = float + completed cash payments + ins - outs; every other method = its completed payments. */
export function expectedAmounts(
  openingAmount: number,
  movements: ReadonlyArray<Pick<CashMovement, 'type' | 'amount'>>,
  payments: readonly CashSessionPayment[],
): CashAmounts {
  const completed = payments.filter((p) => p.status === 'completed');
  const paidWith = (method: CashPaymentMethod) =>
    completed.filter((p) => p.method === method).reduce((sum, p) => sum + p.amount, 0);
  const net = movements.reduce((sum, m) => sum + (m.type === 'in' ? m.amount : -m.amount), 0);
  return byMethod((method) => paidWith(method) + (method === 'cash' ? openingAmount + net : 0));
}

/** Declared - expected per method; a method the cashier did not declare counts as 0. */
export function differenceAmounts(declared: Partial<CashAmounts>, expected: CashAmounts): CashAmounts {
  return byMethod((method) => (declared[method] ?? 0) - expected[method]);
}

export class CashSession {
  public readonly id: string;
  public readonly businessId: string;
  public readonly sucursalId: string;
  public readonly status: CashSessionStatus;
  public readonly openedBy: string;
  public readonly openedAt: Date;
  public readonly openingAmount: number;
  public readonly movements: readonly CashMovement[];
  public readonly closedBy: string | undefined;
  public readonly closedAt: Date | undefined;
  public readonly expected: CashAmounts | undefined;
  public readonly declared: CashAmounts | undefined;
  public readonly difference: CashAmounts | undefined;
  public readonly notes: string | undefined;

  private constructor(props: CashSessionProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.sucursalId = props.sucursalId;
    this.status = props.status;
    this.openedBy = props.openedBy;
    this.openedAt = props.openedAt;
    this.openingAmount = props.openingAmount;
    this.movements = props.movements;
    this.closedBy = props.closedBy;
    this.closedAt = props.closedAt;
    this.expected = props.expected;
    this.declared = props.declared;
    this.difference = props.difference;
    this.notes = props.notes;
  }

  public static create(props: { businessId: string; sucursalId: string; openedBy: string; openingAmount: number }): CashSession {
    if (!isCents(props.openingAmount)) {
      throw new Error('El fondo inicial debe ser un monto en centavos mayor o igual a 0');
    }
    return new CashSession({
      ...props,
      id: crypto.randomUUID(),
      status: 'open',
      openedAt: new Date(),
      movements: [],
    });
  }

  public static reconstitute(props: CashSessionProps): CashSession {
    return new CashSession(props);
  }

  public get isOpen(): boolean {
    return this.status === 'open';
  }

  public addMovement(input: { type: CashMovementType; amount: number; reason: string; createdBy: string }): CashSession {
    this.ensureOpen();
    if (!(CASH_MOVEMENT_TYPES as readonly string[]).includes(input.type)) throw new Error('Tipo de movimiento inválido');
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new Error('El monto debe ser un entero positivo en centavos');
    }
    const reason = input.reason?.trim();
    if (!reason) throw new Error('El motivo es obligatorio');

    const movement: CashMovement = {
      id: crypto.randomUUID(),
      sessionId: this.id,
      type: input.type,
      amount: input.amount,
      reason,
      createdBy: input.createdBy,
      createdAt: new Date(),
    };
    return new CashSession({ ...this.toProps(), movements: [...this.movements, movement] });
  }

  /** `payments` are the payments taken in this session; the close keeps the completed ones. */
  public close(input: {
    closedBy: string;
    declared: Partial<CashAmounts>;
    payments: readonly CashSessionPayment[];
    notes?: string;
  }): CashSession {
    this.ensureOpen();
    if (CASH_PAYMENT_METHODS.some((method) => input.declared[method] !== undefined && !isCents(input.declared[method]!))) {
      throw new Error('Los montos declarados deben ser enteros en centavos mayores o iguales a 0');
    }
    const expected = expectedAmounts(this.openingAmount, this.movements, input.payments);
    return new CashSession({
      ...this.toProps(),
      status: 'closed',
      closedBy: input.closedBy,
      closedAt: new Date(),
      expected,
      declared: byMethod((method) => input.declared[method] ?? 0),
      difference: differenceAmounts(input.declared, expected),
      notes: input.notes?.trim() || undefined,
    });
  }

  private ensureOpen(): void {
    if (!this.isOpen) throw new Error('La caja ya está cerrada');
  }

  private toProps(): CashSessionProps {
    return {
      id: this.id,
      businessId: this.businessId,
      sucursalId: this.sucursalId,
      status: this.status,
      openedBy: this.openedBy,
      openedAt: this.openedAt,
      openingAmount: this.openingAmount,
      movements: [...this.movements],
      closedBy: this.closedBy,
      closedAt: this.closedAt,
      expected: this.expected,
      declared: this.declared,
      difference: this.difference,
      notes: this.notes,
    };
  }
}
