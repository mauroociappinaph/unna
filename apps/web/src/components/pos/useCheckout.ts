import { useState } from 'react';
import { api } from '@/lib/api';
import type { IssueReceiptInput, Order, Payment, PaymentMethod, Receipt } from '@/lib/api-types';
import { apiErrorMessage } from '@/lib/api-errors';
import type { PosTask } from './usePosTask';

const isUnavailable = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 503;

interface Options {
  businessId: string | undefined;
  order: Order | null;
  setOrder: (order: Order) => void;
  onReceiptIssued: (order: Order) => void;
  task: PosTask;
}

/** Payments of the current order and the receipt issued once it is paid. */
export function useCheckout({ businessId, order, setOrder, onReceiptIssued, task }: Options) {
  const [payments, setPayments] = useState<Payment[]>([]);
  // Balance reported by the server after a payment; null while nothing was paid.
  const [paidRemaining, setPaidRemaining] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // Receipt request to retry after ARCA answered 503 (the draft stays on the server).
  const [retryReceipt, setRetryReceipt] = useState<IssueReceiptInput | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const pay = (amount: number, method: PaymentMethod) => {
    if (!businessId || !order) return;
    task.run(async () => {
      const result = await api.registerPayment(businessId, order.id, { amount, method });
      setOrder(result.order);
      setPayments(result.payments);
      setPaidRemaining(result.remaining);
    }, 'No se pudo registrar el pago');
  };

  /** Reloads the order and its payments after a payment registered by the server, e.g. a paid QR charge. */
  const syncPayments = () => {
    if (!businessId || !order) return;
    task.run(async () => {
      const [fresh, orderPayments] = await Promise.all([
        api.getOrder(businessId, order.id),
        api.listPayments(businessId, order.id),
      ]);
      const completed = orderPayments.filter((p) => p.status === 'completed');
      const paid = completed.reduce((sum, p) => sum + p.amount, 0);
      setOrder(fresh);
      setPayments(completed);
      setPaidRemaining(Math.max(0, fresh.totalAmount.amount - paid));
    }, 'No se pudieron actualizar los pagos');
  };

  const issueReceipt = async (input: IssueReceiptInput) => {
    if (!businessId || !order) return;
    task.setBusy(true);
    task.setError(null);
    setRetryReceipt(null);
    try {
      setReceipt(await api.issueReceipt(businessId, order.id, input));
      onReceiptIssued(order);
    } catch (err) {
      if (isUnavailable(err)) setRetryReceipt(input);
      else task.setError(apiErrorMessage(err, 'No se pudo emitir el comprobante'));
    } finally {
      task.setBusy(false);
    }
  };

  /** Restores the completed payments of a resumed order. */
  const restore = (completed: Payment[], remaining: number | null) => {
    setPayments(completed);
    setPaidRemaining(remaining);
    setReceipt(null);
    setRetryReceipt(null);
    setShowPayment(completed.length > 0);
  };

  const reset = () => {
    setPayments([]);
    setPaidRemaining(null);
    setReceipt(null);
    setRetryReceipt(null);
    setShowPayment(false);
  };

  const remaining = order ? paidRemaining ?? order.totalAmount.amount : 0;

  return {
    payments, remaining, receipt, retryReceipt, showPayment,
    openPayment: () => setShowPayment(true),
    pay, syncPayments, issueReceipt, restore, reset,
  };
}
