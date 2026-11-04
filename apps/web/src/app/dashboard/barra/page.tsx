'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { BarBoard } from '@/components/bar/BarBoard';
import { DisplayScreenPanel } from '@/components/bar/DisplayScreenPanel';
import { ErrorBanner } from '@/components/catalog/ErrorBanner';
import type { PosSucursal } from '@/components/pos/PosSetup';
import { apiErrorMessage } from '@/lib/api-errors';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';

interface Business {
  id: string;
  sucursales: PosSucursal[];
}

const mainSucursalId = (sucursales: PosSucursal[]) => (sucursales.find((s) => s.isMain) ?? sucursales[0])?.id ?? '';

export default function BarPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [sucursales, setSucursales] = useState<PosSucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBusiness = useCallback(async () => {
    try {
      if (!localStorage.getItem('auth_token')) {
        router.push('/login');
        return;
      }

      const businesses: Business[] = await api.getBusinesses();
      if (businesses.length === 0) {
        setError('No se encontró ningún negocio asociado');
        return;
      }
      const active = (businesses[0].sucursales || []).filter((s) => s.isActive !== false);
      setBusinessId(businesses[0].id);
      setSucursales(active);
      setSucursalId(mainSucursalId(active));
    } catch (err) {
      setError(apiErrorMessage(err, 'Error al cargar el negocio'));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadBusiness();
  }, [loadBusiness]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-unna-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <UnnaSymbol className="w-8 h-8 text-unna-green" />
              <span className="text-xl font-bold text-gray-900">UNNA</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard/pos">
                <Button variant="ghost" size="sm">Punto de venta</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">← Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Barra</h1>
              <p className="text-gray-600">Los pedidos cobrados de hoy, del más viejo al más nuevo. Se actualiza solo.</p>
            </div>
            <div className="w-full sm:w-64">
              <Select
                id="barra-sucursal"
                label="Sucursal"
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                options={sucursales.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          </div>

          <ErrorBanner message={error} />

          {businessId && sucursalId && (
            <>
              <BarBoard key={sucursalId} businessId={businessId} sucursalId={sucursalId} />
              <DisplayScreenPanel key={`screen-${sucursalId}`} businessId={businessId} sucursalId={sucursalId} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
