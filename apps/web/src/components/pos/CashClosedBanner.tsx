import Link from 'next/link';

export function CashClosedBanner() {
  return (
    <div
      role="status"
      aria-label="Caja cerrada"
      className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="font-semibold text-amber-900">Abrí la caja para empezar a vender</p>
      <Link href="/dashboard/caja" className="font-semibold text-unna-green-dark underline">
        Ir a la caja
      </Link>
    </div>
  );
}
