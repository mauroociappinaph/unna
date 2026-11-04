interface PublicOrderHeaderProps {
  businessName?: string;
  sucursalName?: string;
}

/** Minimal header of the customer pages: the café, not the UNNA marketing site. */
export function PublicOrderHeader({ businessName, sucursalName }: PublicOrderHeaderProps) {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="mx-auto max-w-2xl px-4 py-4">
        {businessName ? <h1 className="text-xl font-bold text-gray-900">{businessName}</h1> : <div className="h-7" aria-hidden="true" />}
        {sucursalName && <p className="text-sm text-gray-600">{sucursalName}</p>}
      </div>
    </header>
  );
}
