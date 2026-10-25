'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <nav className="container-custom" aria-label="Navegación principal">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2" aria-label="UNNA - Inicio">
              <svg className="w-8 h-8 text-unna-green" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5L25.5 9 16 13.5 6.5 9 16 4.5zM6 10.5l9 4.5 9-4.5v11L16 28.5 6 24v-13.5z" />
              </svg>
              <div className="hidden sm:block flex flex-col">
                <span className="text-xl font-bold text-gray-900">UNNA</span>
                <span className="text-xs text-gray-500 font-normal">A Community of Sharing</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <Link href="/#funcionalidades" className="text-sm font-medium text-gray-700 hover:text-unna-green transition-colors">
                Funcionalidades
              </Link>
              <Link href="/#negocios" className="text-sm font-medium text-gray-700 hover:text-unna-green transition-colors">
                Tipos de negocio
              </Link>
              <Link href="/#precios" className="text-sm font-medium text-gray-700 hover:text-unna-green transition-colors">
                Precios
              </Link>
              <Link href="/#soporte" className="text-sm font-medium text-gray-700 hover:text-unna-green transition-colors">
                Soporte
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-gray-700 hover:text-unna-green transition-colors">
              Ingresar
            </Link>
            <Link href="/crear-cuenta" className="btn-primary hidden sm:block">
              Probar gratis
            </Link>
            <button className="md:hidden p-2 text-gray-600 hover:text-gray-900" aria-label="Menú">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}