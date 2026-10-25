'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import type { CashMovementInput, CashSession, CloseCashSessionInput } from '@/lib/api-types';
import { CashClosingResult } from '@/components/caja/CashClosingResult';
import { CashHistory } from '@/components/caja/CashHistory';
import { CashMovementForm } from '@/components/caja/CashMovementForm';
import { CashSessionSummary } from '@/components/caja/CashSessionSummary';
import { CloseCashForm } from '@/components/caja/CloseCashForm';
import { OpenCashForm } from '@/components/caja/OpenCashForm';
import { ErrorBanner } from '@/components/catalog/ErrorBanner';
import type { PosSucursal } from '@/components/pos/PosSetup';
import { apiErrorMessage } from '@/lib/api-errors';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';

interface Business {
  id: string;
  sucursales: PosSucursal[];
}

const mainSucursalId = (sucursales: PosSucursal[]) => (sucursales.find((s) => s.isMain) ?? sucursales[0])?.id ?? '';

export default function CajaPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [sucursales, setSucursales] = useState<PosSucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // undefined while the current session of the sucursal is loading.
  const [session, setSession] = useState<CashSession | null | undefined>(undefined);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [closing, setClosing] = useState<CashSession | null>(null);

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

  const loadHistory = useCallback(async (id: string, sucursal: string) => {
    setHistory(await api.listCashSessions(id, { sucursalId: sucursal }));
  }, []);

  useEffect(() => {
    if (!businessId || !sucursalId) return;
    let cancelled = false;
    setSession(undefined);
    setClosing(null);
    Promise.all([api.getCurrentCashSession(businessId, sucursalId), api.listCashSessions(businessId, { sucursalId })])
      .then(([current, sessions]) => {
        if (cancelled) return;
        setSession(current);
        setHistory(sessions);
      })
      .catch((err) => {
        if (cancelled) return;
        setSession(null);
        setError(apiErrorMessage(err, 'No se pudo cargar la caja'));
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, sucursalId]);

  const run = async (task: () => Promise<void>, fallback: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = (openingAmount: number) => {
    if (!businessId) return;
    run(async () => {
      setSession(await api.openCashSession(businessId, { sucursalId, openingAmount }));
      setClosing(null);
    }, 'No se pudo abrir la caja');
  };

  const handleMovement = (movement: CashMovementInput) => {
    if (!businessId || !session) return Promise.resolve(false);
    return run(async () => setSession(await api.addCashMovement(businessId, session.id, movement)), 'No se pudo registrar el movimiento');
  };

  const handleClose = (input: CloseCashSessionInput) => {
    if (!businessId || !session) return;
    run(async () => {
      setClosing(await api.closeCashSession(businessId, session.id, input));
      setSession(null);
      await loadHistory(businessId, sucursalId);
    }, 'No se pudo cerrar la caja');
  };

  const handleSelectPast = (past: CashSession) => {
    if (!businessId) return;
    run(async () => setClosing(await api.getCashSession(businessId, past.id)), 'No se pudo cargar la caja');
  };

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
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
              <p className="text-gray-600">Abrí el turno, registrá ingresos y retiros, y cerrá con el arqueo por medio de pago</p>
            </div>
            <div className="w-full sm:w-64">
              <Select
                id="caja-sucursal"
                label="Sucursal"
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                options={sucursales.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          </div>

          <ErrorBanner message={error} />

          {closing && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <CashClosingResult session={closing} />
            </div>
          )}

          {session === undefined && businessId && sucursalId && (
            <p className="text-gray-500">Cargando caja…</p>
          )}

          {session === null && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <OpenCashForm busy={busy} onOpen={handleOpen} onInvalidAmount={setError} />
            </div>
          )}

          {session && (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <CashSessionSummary session={session} />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <CashMovementForm key={session.id} busy={busy} onSubmit={handleMovement} onInvalid={setError} />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <CloseCashForm key={session.id} busy={busy} onClose={handleClose} onInvalid={setError} />
              </div>
            </>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <CashHistory sessions={history} busy={busy} onSelect={handleSelectPast} />
          </div>
        </div>
      </main>
    </div>
  );
}
