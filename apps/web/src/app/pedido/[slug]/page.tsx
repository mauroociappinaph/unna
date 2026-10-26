import { PublicOrderPage } from '@/components/pedido/PublicOrderPage';

export default function PublicOrderRoute({ params }: { params: { slug: string } }) {
  return <PublicOrderPage slug={params.slug} />;
}
