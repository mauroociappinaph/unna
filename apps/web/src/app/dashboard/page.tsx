'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

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
              <span className="text-sm text-gray-600">Dashboard</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-unna-green/10 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">¡Bienvenido a UNNA!</h1>
            <p className="mt-4 text-lg text-gray-600">
              Tu cuenta ha sido creada exitosamente. Aquí podrás gestionar tu restaurante.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg">Configurar mi negocio</Button>
              <Button variant="secondary" size="lg">Ver tutorial</Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-4 gap-6 mt-12">
            {[
              { label: 'Ventas hoy', value: '$0', icon: 'sales' },
              { label: 'Pedidos', value: '0', icon: 'orders' },
              { label: 'Productos', value: '0', icon: 'products' },
              { label: 'Clientes', value: '0', icon: 'clients' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Getting Started */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Primeros pasos</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Configurar mi negocio',
                  desc: 'Agregá el nombre, dirección, logo y datos fiscales de tu restaurante.',
                  action: 'Configurar',
                  href: '/dashboard/sucursales',
                },
                {
                  title: 'Gestionar sucursales',
                  desc: 'Creá, editá y eliminá ubicaciones de tu negocio.',
                  action: 'Gestionar',
                  href: '/dashboard/sucursales',
                },
                {
                  title: 'Configurar horarios',
                  desc: 'Definí horarios de atención por sucursal.',
                  action: 'Configurar',
                  href: '/dashboard/horarios',
                },
              ].map((step, i) => (
                <Link key={i} href={step.href} className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-unna-green/30 transition-colors hover:shadow-lg">
                  <div className="w-12 h-12 bg-unna-green/10 rounded-xl flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-gray-600">{step.desc}</p>
                  <Button className="mt-4 w-full" variant="secondary" size="sm">{step.action}</Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}