import { OrderBoard } from '@/components/board/OrderBoard';

export default function OrderBoardPage({ params }: { params: { token: string } }) {
  return <OrderBoard token={params.token} />;
}
