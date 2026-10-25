'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { SucursalForm, type SucursalFormData } from '@/components/business/SucursalForm';

interface Sucursal {
  id: string;
  name: string;
  address: {
    street: string;
    number: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  phone: string;
  email: string;
  schedule?: {
    monday: { open: string; close: string; isClosed: boolean };
    tuesday: { open: string; close: string; isClosed: boolean };
    wednesday: { open: string; close: string; isClosed: boolean };
    thursday: { open: string; close: string; isClosed: boolean };
    friday: { open: string; close: string; isClosed: boolean };
    saturday: { open: string; close: string; isClosed: boolean };
    sunday: { open: string; close: string; isClosed: boolean };
  };
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Business {
  id: string;
  businessName: string;
  sucursales: Sucursal[];
}

export default function SucursalesPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const loadBusiness = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Obtener el negocio del usuario (asumimos el primero por ahora)
      const businesses = await api.getBusinesses();
      if (businesses.length === 0) {
        setError('No se encontró ningún negocio asociado');
        return;
      }

      const mainBusiness = businesses[0];
      setBusiness(mainBusiness);
      setSucursales(mainBusiness.sucursales || []);
    } catch (err) {
      setError('Error al cargar el negocio');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadBusiness();
  }, [loadBusiness]);

  const handleSubmitSucursal = async (data: SucursalFormData) => {
    if (!business) return;

    setFormLoading(true);
    try {
      if (editingSucursal) {
        await api.updateSucursal(business.id, editingSucursal.id, data);
      } else {
        await api.createSucursal(business.id, data);
      }
      setShowForm(false);
      setEditingSucursal(null);
      loadBusiness();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la sucursal');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (sucursal: Sucursal) => {
    if (!business || !confirm(`¿Eliminar "${sucursal.name}"?`)) return;

    try {
      await api.deleteSucursal(business.id, sucursal.id);
      loadBusiness();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la sucursal');
    }
  };

  const handleEdit = (sucursal: Sucursal) => {
    setEditingSucursal(sucursal);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingSucursal(null);
    setShowForm(true);
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
              <svg className="w-8 h-8 text-unna-green" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5L25.5 9 16 13.5 6.5 9 16 4.5zM6 10.5l9 4.5 9-4.5v11L16 28.5 6 24v-13.5z" />
              </svg>
              <span className="text-xl font-bold text-gray-900">UNNA</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">← Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
              <p className="text-gray-600">Gestioná las ubicaciones de tu negocio</p>
            </div>
            <Button onClick={handleNew}>
              Nueva sucursal
            </Button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              {error}
            </div>
          )}

          {showForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <SucursalForm
                  initialData={editingSucursal || undefined}
                  onSubmit={handleSubmitSucursal}
                  onCancel={() => { setShowForm(false); setEditingSucursal(null); }}
                  isLoading={formLoading}
                  title={editingSucursal ? `Editar: ${editingSucursal.name}` : 'Nueva sucursal'}
                />
              </div>
            </div>
          )}

          {sucursales.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay sucursales</h3>
              <p className="text-gray-600 mb-6">Creá tu primera sucursal para empezar a gestionar ubicaciones.</p>
              <Button onClick={handleNew}>Crear primera sucursal</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sucursales.map((sucursal) => (
                <div key={sucursal.id} className="bg-white rounded-xl border border-gray-100 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                      sucursal.isMain ? 'bg-unna-green text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {sucursal.isMain ? '🏠' : sucursal.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{sucursal.name}</h3>
                      <p className="text-sm text-gray-500">
                        {sucursal.address.street} {sucursal.address.number}, {sucursal.address.city}, {sucursal.address.province}
                      </p>
                      <p className="text-sm text-gray-500">{sucursal.phone} · {sucursal.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sucursal.isMain && (
                      <span className="px-2 py-1 text-xs font-medium bg-unna-green/10 text-unna-green rounded-full">
                        Principal
                      </span>
                    )}
                    {sucursal.isActive ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Activa
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        Inactiva
                      </span>
                    )}
                    <Link href={`/dashboard/horarios?sucursal=${sucursal.id}`}>
                      <Button variant="ghost" size="sm">Horarios</Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(sucursal)}>
                      Editar
                    </Button>
                    {!sucursal.isMain && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(sucursal)}>
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {business && (
            <Link href={`/dashboard/horarios?sucursal=main`} className="mt-6 block text-center">
              <Button variant="secondary">Configurar horarios del negocio principal</Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}