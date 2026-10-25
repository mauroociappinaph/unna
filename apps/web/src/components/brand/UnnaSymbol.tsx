/**
 * UNNA symbol from the brand manual (docs/brand/assets/unna-symbol.svg): two people whose arms
 * form a shared bowl, the U of UNNA. Uses currentColor, so color it with a text-* class.
 */
export function UnnaSymbol({ className = 'w-8 h-8 text-unna-green' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M16 28 V34 A16 16 0 0 0 48 34 V28" fill="none" stroke="currentColor" strokeWidth={9} strokeLinecap="round" />
      <circle cx="16" cy="14" r="5.5" fill="currentColor" />
      <circle cx="48" cy="14" r="5.5" fill="currentColor" />
    </svg>
  );
}
