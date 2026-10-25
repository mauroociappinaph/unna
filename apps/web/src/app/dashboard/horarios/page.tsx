'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { HorarioEditor, type ScheduleFormData } from '@/components/business/HorarioEditor';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';

interface Schedule {
  monday: { open: string; close: string; isClosed: boolean };
  tuesday: { open: string; close: string; isClosed: boolean };
  wednesday: { open: string; close: string; isClosed: boolean };
  thursday: { open: string; close: string; isClosed: boolean };
  friday: { open: string; close: string; isClosed: boolean };
  saturday: { open: string; close: string; isClosed: boolean };
  sunday: { open: string; close: string; isClosed: boolean };
}

interface Sucursal {
  id: string;
  name: string;
  isMain: boolean;
  schedule: Schedule;
}

interface Business {
  id: string;
  businessName: string;
  schedule: Schedule;
  sucursales: Sucursal[];
}

function HorariosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [selectedSucursal, setSelectedSucursal] = useState<'main' | string>('main');
  const [schedule, setSchedule] = useState<{
    monday: { open: string; close: string; isClosed: boolean };
    tuesday: { open: string; close: string; isClosed: boolean };
    wednesday: { open: string; close: string; isClosed: boolean };
    thursday: { open: string; close: string; isClosed: boolean };
    friday: { open: string; close: string; isClosed: boolean };
    saturday: { open: string; close: string; isClosed: boolean };
    sunday: { open: string; close: string; isClosed: boolean };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Bumped on every loaded schedule so the editor re-initializes with the fetched data.
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loads for an explicit sucursal so it never reads a stale selection from state.
  const loadBusiness = useCallback(async (sucursalId: 'main' | string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const businesses: Business[] = await api.getBusinesses();
      if (businesses.length === 0) {
        setError('No se encontró ningún negocio');
        return;
      }

      const mainBusiness = businesses[0];
      setBusiness(mainBusiness);
      setScheduleVersion((v) => v + 1);

      if (sucursalId === 'main') {
        setSchedule(mainBusiness.schedule);
      } else {
        const sucursal = mainBusiness.sucursales?.find((s) => s.id === sucursalId);
        if (sucursal) {
          setSchedule(sucursal.schedule);
        } else {
          setSchedule(null);
        }
      }
    } catch (err) {
      setError('Error al cargar el negocio');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const sucursalId = searchParams.get('sucursal') ?? 'main';
    setSelectedSucursal(sucursalId);
    loadBusiness(sucursalId);
  }, [searchParams, loadBusiness]);

  const handleSubmit = async (data: ScheduleFormData) => {
    if (!business) return;

    setSaving(true);
    try {
      if (selectedSucursal === 'main') {
        await api.updateBusinessSchedule(business.id, data);
      } else {
        await api.updateSucursalSchedule(business.id, selectedSucursal, data);
      }
      alert('Horarios guardados correctamente');
      loadBusiness(selectedSucursal);
    } catch (err) {
      console.error(err);
      alert('Error al guardar los horarios');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-unna-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentTargetName = selectedSucursal === 'main'
    ? `${business?.businessName} (Negocio principal)`
    : business?.sucursales?.find(s => s.id === selectedSucursal)?.name;

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
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">← Dashboard</Button>
              </Link>
              <Link href="/dashboard/sucursales">
                <Button variant="ghost" size="sm">Sucursales</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Horarios de atención</h1>
            <p className="text-gray-600">Configurá los horarios de apertura y cierre para cada día</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <div className="flex flex-wrap gap-3 mb-6">
              {business?.sucursales?.map((sucursal) => (
                <Link
                  key={sucursal.id}
                  href={`/dashboard/horarios?sucursal=${sucursal.id}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedSucursal === sucursal.id
                      ? 'bg-unna-green text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {sucursal.isMain ? '🏠' : sucursal.name.charAt(0).toUpperCase()} {sucursal.name}
                </Link>
              ))}
              <Link
                href="/dashboard/horarios?sucursal=main"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedSucursal === 'main'
                    ? 'bg-unna-green text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🏠 Negocio principal
              </Link>
            </div>
          </div>

          {schedule && (
            <HorarioEditor
              key={scheduleVersion}
              initialData={schedule}
              onSubmit={handleSubmit}
              onCancel={() => {}}
              isLoading={saving}
              title="Configurar horarios"
              targetName={currentTargetName}
            />
          )}

          {!schedule && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin horarios configurados</h3>
              <p className="text-gray-600">Esta sucursal no tiene horarios definidos.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
// useSearchParams needs a Suspense boundary so the page can be prerendered.
export default function HorariosPage() {
  return (
    <Suspense fallback={null}>
      <HorariosContent />
    </Suspense>
  );
}
