import Link from 'next/link';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';

export function Footer() {
  const currentYear = new Date().getFullYear();

  // Only pages and landing sections that exist (S19).
  const productLinks = [
    { label: 'Funcionalidades', href: '/#funcionalidades' },
    { label: 'Para qué cafés', href: '/#negocios' },
    { label: 'Crear cuenta', href: '/crear-cuenta' },
    { label: 'Ingresar', href: '/login' },
  ];

  return (
    <footer className="bg-gray-50 border-t border-gray-100" role="contentinfo">
      <div className="container-custom py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4" aria-label="UNNA - Inicio">
              <UnnaSymbol className="w-8 h-8 text-unna-green" />
              <span className="text-xl font-bold text-gray-900">UNNA</span>
            </Link>
            <p className="text-sm text-gray-600 mb-2">El sistema para cafés take away.</p>
            <p className="text-xs text-gray-500 font-medium">A Community of Sharing</p>
          </div>

          <nav aria-label="Producto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Producto</h3>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-unna-green-dark transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">© {currentYear} UNNA. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
