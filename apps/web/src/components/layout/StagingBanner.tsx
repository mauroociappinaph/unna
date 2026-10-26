/**
 * "Ambiente de prueba" (S16): shown only in the staging deployment (NEXT_PUBLIC_UNNA_ENV=staging,
 * exact value), where the API runs the ARCA and Mercado Pago simulators. A small badge in a corner
 * that never takes clicks, so it does not get in the way of the page.
 */
export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_UNNA_ENV !== 'staging') return null;
  return (
    <p
      role="note"
      className="pointer-events-none fixed bottom-3 left-3 z-[60] rounded-full bg-unna-green-dark px-3 py-1 text-xs font-semibold text-white shadow-md"
    >
      Ambiente de prueba
    </p>
  );
}
