import { Button } from '@/components/ui/Button';

interface PosToolbarProps {
  canRepeat: boolean;
  repeatDisabled: boolean;
  onToggleOpenOrders: () => void;
  onRepeatLastOrder: () => void;
  onNewOrder: () => void;
}

export function PosToolbar({ canRepeat, repeatDisabled, onToggleOpenOrders, onRepeatLastOrder, onNewOrder }: PosToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Punto de venta</h1>
        <p className="text-gray-600">Cargá pedidos, cobralos y emití el comprobante</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onToggleOpenOrders}>Pedidos abiertos</Button>
        {canRepeat && (
          <Button variant="secondary" disabled={repeatDisabled} onClick={onRepeatLastOrder}>
            Repetir último pedido
          </Button>
        )}
        <Button onClick={onNewOrder}>Nuevo pedido</Button>
      </div>
    </div>
  );
}
