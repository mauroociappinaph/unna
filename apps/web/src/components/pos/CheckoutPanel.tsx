import { Button } from '@/components/ui/Button';
import type { IssueReceiptInput, IvaCondition, Payment, PaymentMethod, Receipt } from '@/lib/api-types';
import { PaymentPanel } from './PaymentPanel';
import { QrChargePanel } from './QrChargePanel';
import { ReceiptIssuer } from './ReceiptIssuer';
import { ReceiptView } from './ReceiptView';

interface CheckoutPanelProps {
  businessId: string | undefined;
  orderId: string;
  payments: Payment[];
  remaining: number;
  receipt: Receipt | null;
  retryReceipt: IssueReceiptInput | null;
  ivaCondition?: IvaCondition;
  busy: boolean;
  cashOpen: boolean;
  onPay: (amount: number, method: PaymentMethod) => void;
  onQrPaid: () => void;
  onIssueReceipt: (input: IssueReceiptInput) => void;
  onInvalid: (message: string) => void;
}

export function CheckoutPanel({
  businessId, orderId, payments, remaining, receipt, retryReceipt, ivaCondition, busy, cashOpen, onPay, onQrPaid, onIssueReceipt,
  onInvalid,
}: CheckoutPanelProps) {
  const canIssueReceipt = payments.length > 0 && remaining === 0 && !receipt;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Cobro</h2>
      <PaymentPanel
        payments={payments}
        remaining={remaining}
        busy={busy || !cashOpen}
        onPay={onPay}
        onInvalidAmount={onInvalid}
      />
      <QrChargePanel
        key={`qr-${orderId}`}
        businessId={businessId}
        orderId={orderId}
        remaining={remaining}
        disabled={busy || !cashOpen}
        onPaid={onQrPaid}
      />
      {canIssueReceipt && (
        <ReceiptIssuer
          key={`receipt-${orderId}`}
          ivaCondition={ivaCondition}
          busy={busy}
          onIssue={onIssueReceipt}
          onInvalid={onInvalid}
        />
      )}
      {canIssueReceipt && retryReceipt && (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-amber-900">ARCA no está disponible; el comprobante quedó en borrador</p>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => onIssueReceipt(retryReceipt)}>
            Reintentar
          </Button>
        </div>
      )}
      {receipt && <ReceiptView receipt={receipt} />}
    </div>
  );
}
