'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

const features = [
  {
    icon: 'sales',
    title: 'Ventas',
    items: [
      'Carta QR', 'Ventas por mostrador', 'Asignación de clientes',
      'Confirmación por WhatsApp', 'Arqueo de caja', 'Arqueo ciego',
      'Movimientos de caja', 'Múltiples cajas', 'Descuentos fijos y porcentuales',
      'Descuentos automáticos', 'Cierre parcial de ventas', 'Múltiples medios de pago',
      'Integración Mercado Pago y Fudo Pagos', 'Múltiples turnos', 'Control de propinas',
      'API de propósito general', 'App Móvil de Fudo', 'Ventas múltiples en mesas',
      'Asignación de etiquetas', 'Impresión por comensal', 'Facturas por comensal',
      'Venta por peso (Balanzas)',
    ],
  },
  {
    icon: 'expenses',
    title: 'Gastos',
    items: [
      'Carga de datos', 'Categorías de gastos', 'Actualización automática de costos',
      'Actualización automática de stock', 'Estado de resultados', 'Control de vencimiento',
    ],
  },
  {
    icon: 'products',
    title: 'Productos',
    items: [
      'Categorías y sub-categorías', 'Categorías de ingredientes', 'Subcategorías de ingredientes',
      'Productos favoritos', 'Modificadores y adicionales', 'Vinculación de productos',
      'Carga de recetas', 'Control de stock', 'Registros históricos de stock',
      'Notificaciones por falta de stock', 'Prohibición de vender sin stock',
      'Importación de datos', 'Listas de precios', 'Control de mermas',
      'Conteo de inventario',
    ],
  },
  {
    icon: 'clients',
    title: 'Clientes',
    items: [
      'Base de datos de clientes', 'Cuentas corrientes', 'Importación de datos',
    ],
  },
  {
    icon: 'providers',
    title: 'Proveedores',
    items: [
      'Base de datos de proveedores', 'Categorías de proveedores', 'Cuentas corrientes',
    ],
  },
  {
    icon: 'receipts',
    title: 'Impresión de comandas y precuenta',
    items: [
      'Soporte para impresoras', 'Tickets de comandas', 'Tickets de precuenta',
    ],
  },
  {
    icon: 'users',
    title: 'Usuarios',
    items: [
      'Múltiples usuarios', 'Roles de usuarios', 'Asignación de cajas por usuario', 'PIN de autorización',
    ],
  },
  {
    icon: 'reports',
    title: 'Reportes e indicadores',
    items: [
      'Descarga de registros en Excel', 'Reportes gráficos de ingresos y egresos',
      'Reportes de ventas', 'Reportes de productos', 'Reportes de stock',
      'Reportes de compras', 'Reportes de gastos',
    ],
  },
  {
    icon: 'kds',
    title: 'Monitor de cocina (KDS)',
    items: [
      'Comandas digitales', 'Tiempos de preparación', 'Alertas sonoras', 'Aviso al camarero',
    ],
  },
];

const businessTypes = [
  { id: 1, name: 'Restaurantes', desc: 'Control de mesas, comandas directas a cocina, división de cuentas y propinas.', image: '/images/restaurantes.webp' },
  { id: 2, name: 'Parrillas y Bodegones', desc: 'Caja rápida, comandas digitales y facturación electrónica integrada.', image: '/images/parrillas.webp' },
  { id: 3, name: 'Cafeterías de Especialidad', desc: 'Pedidos rápidos desde mostrador, control de insumos por receta, ticket promedio al instante.', image: '/images/cafeterias.webp' },
  { id: 4, name: 'Bares y Cervecerías', desc: 'Cuentas abiertas por mesa, control de stock por porción, comandas que llegan directo a barra.', image: '/images/bares.webp' },
  { id: 5, name: 'Pizzerías y Delivery', desc: 'Tu tienda online, pedidos por WhatsApp, repartidores a demanda.', image: '/images/pizzerias.webp' },
  { id: 6, name: 'Food Trucks y Ferias', desc: 'Funciona desde tu celular, sin instalaciones fijas. Cobrá con la Terminal UNNA.', image: '/images/foodtrucks.webp' },
  { id: 7, name: 'Cadenas y Multi-sucursal', desc: 'Reportes consolidados, roles de usuario por ubicación, recetas estandarizadas.', image: '/images/cadenas.webp' },
  { id: 8, name: 'Dark Kitchens', desc: 'Múltiples marcas desde una sola cocina. Pedidos online integrados, menú digital por marca.', image: '/images/darkkitchens.webp' },
];

const testimonials = [
  { name: 'Rodrigo B.', business: 'Hábito Café', text: 'Excelente app y lo mejor que siempre van mejorando cosas', rating: 5 },
  { name: 'Sebastián', business: 'Tres Monos', text: 'Nos encanta poder acceder a estadísticas para controlar nuestros números mes a mes', rating: 5 },
  { name: 'Cecilia', business: 'Roll me up!', text: '¡Fudo es una herramienta 360! Es muy fácil de usar y tiene todo lo necesario para llevar un negocio bien administrado', rating: 5 },
  { name: 'Álvaro A.', business: '35 años gestionando negocios', text: 'Lejos... pero muy lejos el mejor sistema de gestión gastronómica. He probado infinidad de sistemas. Fudo se come la cancha!!', rating: 5 },
  { name: 'Jora', business: 'Amores Tintos', text: '¡INCREÍBLE! Lo mejor de todo es su soporte y atención al cliente, respuestas rápidas y mucha amabilidad.', rating: 5 },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-green-50 via-white to-white">
        <div className="container-custom py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Todo tu restaurante.<br />
              <span className="text-unna-green">Una sola plataforma.</span>
              <br />
              <span className="text-gray-600 text-lg md:text-xl mt-4 block font-normal">A Community of Sharing</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              Gestión, cobros y delivery en un solo lugar. Una comunidad donde compartir conocimiento,
              recursos y crecimiento hace que todos ganemos.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/crear-cuenta">
                <Button size="lg" className="w-full sm:w-auto">
                  Probar gratis 15 minutos
                </Button>
              </Link>
              <Link href="/#funcionalidades">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Ver funcionalidades
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <svg className="w-5 h-5 text-unna-green" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Sin tarjeta de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-5 h-5 text-unna-green" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Listo en 15 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-5 h-5 text-unna-green" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Asesoría personalizada
              </span>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-transparent to-transparent" aria-hidden="true" />
      </section>

      {/* 3 Pillars Section */}
      <section id="pilares" className="py-20 lg:py-28 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title">Los 3 pilares de UNNA</h2>
            <p className="section-subtitle">Tu Gestión, Tus Cobros, Tu Delivery — unidos por una comunidad que comparte y crece junta.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Tu Gestión */}
            <article className="relative p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:border-unna-green/30 transition-all">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-unna-green text-white text-xs font-semibold px-3 py-1 rounded-full">01</span>
              </div>
              <div className="mt-6">
                <h3 className="text-2xl font-bold text-gray-900">Tu Gestión</h3>
                <p className="mt-3 text-gray-600">Comandas, stock, caja y reportes en tiempo real, desde donde estés.</p>
                <ul className="mt-6 space-y-3" role="list">
                  {[
                    'Comandas digitales o impresas',
                    'Control de stock e insumos',
                    'Reportes de ventas y costos',
                    'Recetas con costeo automático',
                    'Caja y cierre en minutos',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <svg className="w-5 h-5 text-unna-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/crear-cuenta" className="mt-8 block">
                <Button className="w-full" variant="primary">Probar Gratis</Button>
              </Link>
            </article>

            {/* Tus Cobros */}
            <article className="relative p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:border-unna-green/30 transition-all">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-unna-green text-white text-xs font-semibold px-3 py-1 rounded-full">02</span>
              </div>
              <div className="mt-6">
                <h3 className="text-2xl font-bold text-gray-900">Tus Cobros</h3>
                <p className="mt-3 text-gray-600">Una terminal propia que conecta pedidos, mesas, cobros y facturación.</p>
                <ul className="mt-6 space-y-3" role="list">
                  {[
                    'Terminal de pagos integrada',
                    'División de cuentas y propinas',
                    'Factura electrónica (ARCA)',
                    'Conciliación automática',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <svg className="w-5 h-5 text-unna-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/crear-cuenta?promotional_code=TERMINALUNNA" className="mt-8 block">
                <Button className="w-full" variant="primary">Probar Gratis</Button>
              </Link>
            </article>

            {/* Tu Delivery */}
            <article className="relative p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:border-unna-green/30 transition-all">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-unna-green text-white text-xs font-semibold px-3 py-1 rounded-full">03</span>
              </div>
              <div className="mt-6">
                <h3 className="text-2xl font-bold text-gray-900">Tu Delivery</h3>
                <p className="mt-3 text-gray-600">Tienda online, pedidos por WhatsApp, repartidores e integraciones.</p>
                <ul className="mt-6 space-y-3" role="list">
                  {[
                    'Tienda online propia',
                    'Agente de ventas de IA',
                    'Repartidores a demanda',
                    'Menú digital personalizable',
                    'Sin comisiones del 30%',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <svg className="w-5 h-5 text-unna-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/crear-cuenta" className="mt-8 block">
                <Button className="w-full" variant="primary">Probar Gratis</Button>
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title">Con la confianza de miles</h2>
            <p className="section-subtitle">Restaurantes de toda Latinoamérica forman parte de una comunidad que comparte y crece.</p>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              { number: '35.000+', label: 'Restaurantes activos en Latinoamérica' },
              { number: '#1', label: 'Plataforma gastronómica más grande de Latinoamérica' },
              { number: '350M+', label: 'Transacciones procesadas al año' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-2xl border border-gray-100">
                <div className="text-4xl md:text-5xl font-bold text-unna-green">{stat.number}</div>
                <p className="mt-2 text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Testimonials Carousel */}
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6" role="list" aria-label="Testimonios">
              {testimonials.map((testimonial, i) => (
                <article key={i} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow" role="listitem">
                  <div className="flex gap-1 mb-4" aria-label={`${testimonial.rating} de 5 estrellas`}>
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.business}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 lg:py-28 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title">Funcionalidades</h2>
            <p className="section-subtitle">Herramientas poderosas diseñadas para una comunidad que comparte mejores prácticas.</p>
          </div>

          <div className="space-y-16">
            {features.map((category, catIndex) => (
              <section key={catIndex} className="border-t border-gray-100 pt-12 first:border-0 first:pt-0" aria-labelledby={`feature-${catIndex}`}>
                <header className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-unna-green/10 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 id={`feature-${catIndex}`} className="text-2xl font-bold text-gray-900">{category.title}</h3>
                </header>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-unna-green/5 transition-colors">
                      <svg className="w-5 h-5 text-unna-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      {/* Business Types Section */}
      <section id="negocios" className="py-20 lg:py-28 bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title">¿Para qué tipo de negocio?</h2>
            <p className="section-subtitle">Cada modelo gastronómico encuentra su lugar en una comunidad que comparte y aprende.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {businessTypes.map((business) => (
              <article key={business.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-unna-green/30 transition-all">
                <div className="aspect-video bg-gradient-to-br from-unna-green/10 to-unna-green/20 flex items-center justify-center">
                  <svg className="w-16 h-16 text-unna-green/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900">{business.name}</h3>
                  <p className="mt-2 text-gray-600 text-sm">{business.desc}</p>
                  <Link href="/crear-cuenta" className="mt-4 block">
                    <Button variant="secondary" className="w-full" size="sm">
                    Probar Gratis
                    </Button>
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center">
            <p className="text-gray-600 mb-4">¿Tu tipo de negocio no está aquí?</p>
            <p className="text-gray-600 mb-6">Cada modelo gastronómico encuentra su lugar en una comunidad que comparte y aprende.</p>
            <Link href="/funcionalidades">
              <Button variant="secondary">Ver Funcionalidades</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-unna-green via-unna-green-dark to-unna-green" aria-hidden="true" />
        <div className="absolute inset-0 bg-[url('/assets/patterns/dots.svg')] opacity-10" aria-hidden="true" />
        <div className="container-custom relative">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Probá todo lo que UNNA puede hacer por tu negocio
            </h2>
            <p className="mt-6 text-lg md:text-xl text-green-100">
              Activá tu cuenta gratis y en 15 minutos ya estás operando.
              <br />
              <span className="text-green-200 font-medium">A Community of Sharing</span>
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/crear-cuenta">
                <Button size="lg" className="w-full sm:w-auto bg-white text-unna-green hover:bg-green-50">
                  Empezá gratis
                </Button>
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-green-100" role="list">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Prueba gratuita de todas las funcionalidades
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Soporte en vivo incluido, sin costo extra
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Te acompañamos paso a paso en la implementación
              </li>
            </ul>
            <p className="mt-8 text-green-200 text-sm italic">
              "Una comunidad donde compartir conocimiento, recursos y crecimiento hace que todos ganemos."
            </p>
          </div>
        </div>
      </section>
    </>
  );
}