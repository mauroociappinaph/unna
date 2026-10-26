import Link from 'next/link';

const availableFeatures = [
  {
    title: 'Venta en mostrador',
    desc: 'Pedidos para llevar, retiro, delivery y salón desde la misma pantalla.',
  },
  {
    title: 'Opciones de cada café',
    desc: 'Tamaño, leche, shot extra: cada opción con su precio, que suma o resta, obligatoria o no.',
  },
  {
    title: 'Totales calculados por el sistema',
    desc: 'El total sale de la carta y de las opciones elegidas, no de una cuenta a mano.',
  },
  {
    title: 'Pagos divididos',
    desc: 'Efectivo, tarjeta, Mercado Pago, transferencia o QR, registrados por medio de pago.',
  },
  {
    title: 'Ticket',
    desc: 'Cuando el pedido queda pagado, sale el ticket con lo que se cobró.',
  },
  {
    title: 'Pedidos abiertos con estados',
    desc: 'Confirmado, en preparación, listo y entregado: siempre sabés en qué está cada pedido.',
  },
  {
    title: 'Catálogo',
    desc: 'Categorías, productos y modificadores para armar tu carta en minutos.',
  },
  {
    title: 'Control de stock',
    desc: 'Entradas y salidas registradas como movimientos, con el saldo de cada producto.',
  },
  {
    title: 'Varias sucursales',
    desc: 'Cada local con sus datos y sus horarios de atención.',
  },
  {
    title: 'Facturación electrónica ARCA',
    desc: 'Factura A, B o C desde el mismo cobro, con numeración correlativa y el QR fiscal.',
  },
  {
    title: 'Caja y turnos',
    desc: 'Apertura, movimientos y cierre con lo esperado contra lo declarado, por medio de pago.',
  },
  {
    title: 'Cobro con QR de Mercado Pago',
    desc: 'Conectás tu cuenta, el cliente escanea el QR de la caja o de la pantalla y el pago queda registrado solo.',
  },
  {
    title: 'Modo hora pico',
    desc: 'Favoritos, repetir el último pedido y atajos de teclado para vender en pocos toques.',
  },
  {
    title: 'Pantalla de pedidos',
    desc: 'La barra ve qué preparar y una pantalla para tus clientes muestra qué pedidos están listos.',
  },
];

const upcomingFeatures = [
  {
    title: 'Pedido anticipado',
    desc: 'El cliente pide y paga desde el celular, y sigue su pedido hasta que está listo.',
  },
  {
    title: 'Tarjeta de sellos',
    desc: 'Fidelizá a quienes vuelven todos los días.',
  },
  {
    title: 'Costo por taza',
    desc: 'Recetas e insumos para conocer el margen de cada café.',
  },
];

const cafeTypes = [
  { name: 'Cafés take away', desc: 'Mucho volumen y poco tiempo por venta en el mostrador.', icon: '☕' },
  { name: 'Cafés de especialidad', desc: 'Métodos, orígenes y opciones con su precio, sin errores al cobrar.', icon: '🫘' },
  { name: 'Cafeterías con pocas mesas', desc: 'Para llevar y salón en el mismo sistema.', icon: '🪑' },
  { name: 'Panaderías y pastelerías con café', desc: 'El café y lo de la vitrina en el mismo pedido.', icon: '🥐' },
  { name: 'Carritos y kioscos de café', desc: 'Una carta corta y un cobro ágil.', icon: '🛒' },
  { name: 'Cadenas de cafés', desc: 'Varias sucursales, cada una con sus horarios.', icon: '🏪' },
];

const values = [
  {
    title: 'Pensado para el mostrador',
    desc: 'Un café take away vive de vender rápido. UNNA se enfoca en eso, no en mesas ni salones grandes.',
  },
  {
    title: 'Cobros que cierran',
    desc: 'Los totales los calcula el sistema y cada pago queda registrado con su medio.',
  },
  {
    title: 'Claros con lo que viene',
    desc: 'Te mostramos qué está disponible hoy y qué está en camino, sin vueltas.',
  },
];

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-unna-green flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-gradient-to-b from-green-50 via-white to-white">
        <div className="container-custom pt-20 pb-12 lg:pt-28 lg:pb-16">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-unna-green-dark">Tu café, sin filas.</p>
            <h1 id="hero-title" className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              El sistema para cafés take away.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
              Vendé rápido en el mostrador, cobrá fácil y controlá tus cobros y tu stock.
            </p>
            <p className="mt-4 text-base text-gray-600 max-w-2xl mx-auto">
              Cada café con sus opciones —tamaño, leche, shot extra— y su precio, sumado por el sistema.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/crear-cuenta" className="btn-primary w-full sm:w-auto">
                Probar gratis
              </Link>
              <Link href="#funcionalidades" className="btn-secondary w-full sm:w-auto">
                Ver funcionalidades
              </Link>
            </div>
            <p className="mt-8 text-sm text-gray-600">Sin tarjeta de crédito. Cancelá cuando quieras.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" aria-labelledby="funcionalidades-title" className="py-20 lg:py-28 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 id="funcionalidades-title" className="section-title">Funcionalidades</h2>
            <p className="section-subtitle">Lo que podés usar hoy en tu café, y lo que estamos construyendo.</p>
          </div>

          <section aria-labelledby="disponible-title" className="mb-16">
            <h3 id="disponible-title" className="text-2xl font-semibold text-gray-900 mb-8">Disponible hoy</h3>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
              {availableFeatures.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                  <CheckIcon />
                  <div>
                    <p className="font-semibold text-gray-900">{feature.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{feature.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="proximamente-title">
            <h3 id="proximamente-title" className="text-2xl font-semibold text-gray-900 mb-8">Próximamente</h3>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
              {upcomingFeatures.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3 p-5 bg-white rounded-2xl border border-dashed border-gray-300">
                  <ClockIcon />
                  <div>
                    <span className="inline-block text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                      Próximamente
                    </span>
                    <p className="mt-2 font-semibold text-gray-900">{feature.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{feature.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      {/* Café types */}
      <section id="negocios" aria-labelledby="negocios-title" className="py-20 lg:py-28 bg-gray-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 id="negocios-title" className="section-title">¿Qué tipo de café tenés?</h2>
            <p className="section-subtitle">UNNA está pensado para negocios donde el café se vende en el mostrador.</p>
          </div>

          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
            {cafeTypes.map((type) => (
              <li key={type.name} className="p-6 bg-white rounded-2xl border border-gray-100">
                <span className="text-3xl" aria-hidden="true">{type.icon}</span>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{type.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{type.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why UNNA */}
      <section aria-labelledby="por-que-title" className="py-20 lg:py-28 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 id="por-que-title" className="section-title">¿Por qué UNNA?</h2>
            <p className="section-subtitle">
              A Community of Sharing: compartir conocimiento, recursos y crecimiento hace que todos ganemos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {values.map((value) => (
              <article key={value.title} className="p-8 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900">{value.title}</h3>
                <p className="mt-3 text-gray-600">{value.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section aria-labelledby="cta-title" className="py-20 lg:py-28 bg-primary-900">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 id="cta-title" className="text-3xl md:text-4xl font-bold">
              Probá UNNA en tu café
            </h2>
            <p className="mt-6 text-lg text-green-100">
              Creá tu cuenta, cargá tu carta y empezá a vender en el mostrador.
            </p>
            <div className="mt-10">
              <Link
                href="/crear-cuenta"
                className="inline-flex items-center justify-center px-7 py-3.5 text-lg font-semibold text-unna-green-dark bg-white rounded-lg hover:bg-green-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-900"
              >
                Probar gratis
              </Link>
            </div>
            <p className="mt-6 text-sm text-green-100">Sin tarjeta de crédito. Cancelá cuando quieras.</p>
          </div>
        </div>
      </section>
    </>
  );
}
