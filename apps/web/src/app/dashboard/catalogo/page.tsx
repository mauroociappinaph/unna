'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { CategoriesTab } from '@/components/catalog/CategoriesTab';
import { ErrorBanner } from '@/components/catalog/ErrorBanner';
import { ModifiersTab } from '@/components/catalog/ModifiersTab';
import { ProductsTab } from '@/components/catalog/ProductsTab';
import { StockTab } from '@/components/catalog/StockTab';
import { apiErrorMessage } from '@/lib/api-errors';

const TABS = [
  { id: 'productos', label: 'Productos' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'modificadores', label: 'Modificadores' },
  { id: 'stock', label: 'Stock' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function CatalogoPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('productos');

  const loadBusiness = useCallback(async () => {
    try {
      if (!localStorage.getItem('auth_token')) {
        router.push('/login');
        return;
      }

      const businesses = await api.getBusinesses();
      if (businesses.length === 0) {
        setError('No se encontró ningún negocio asociado');
        return;
      }
      setBusinessId(businesses[0].id);
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
              <svg className="w-8 h-8 text-unna-green" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5L25.5 9 16 13.5 6.5 9 16 4.5zM6 10.5l9 4.5 9-4.5v11L16 28.5 6 24v-13.5z" />
              </svg>
              <span className="text-xl font-bold text-gray-900">UNNA</span>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
            <p className="text-gray-600">Gestioná tus productos, categorías, modificadores y stock</p>
          </div>

          <ErrorBanner message={error} />

          {businessId && (
            <>
              <div role="tablist" aria-label="Secciones del catálogo" className="flex gap-2 mb-6 border-b border-gray-200">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-unna-green text-unna-green'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
                {activeTab === 'productos' && <ProductsTab businessId={businessId} />}
                {activeTab === 'categorias' && <CategoriesTab businessId={businessId} />}
                {activeTab === 'modificadores' && <ModifiersTab businessId={businessId} />}
                {activeTab === 'stock' && <StockTab businessId={businessId} />}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
