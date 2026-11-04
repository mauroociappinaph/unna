import { OrderTrackingView } from '@/components/pedido/OrderTrackingView';

export default function OrderTrackingRoute({ params }: { params: { token: string } }) {
  return <OrderTrackingView token={params.token} />;
}
