# UNNA vs Fudo: comparación de producto y negocio

**Conclusión:** Fudo es un producto maduro (35.000+ locales, sitios para al menos Argentina, México y Colombia, ecosistema de pagos, delivery y facturación) y UNNA es un MVP con una base técnica sólida en ventas y catálogo. Hoy UNNA no compite de igual a igual: le faltan **facturación ARCA, caja/turnos, impresión de comandas, mesas, KDS, reportes y app móvil**, que en Fudo son el piso. Donde UNNA puede diferenciarse es en lo que los usuarios de Fudo más le reclaman (implementación lenta, soporte, módulos que se suman al precio, multi-sucursal "a consultar") y en el posicionamiento de comunidad.

> Relevado el 25/10/2026 desde las páginas públicas de fu.do (home, funcionalidades, precios), reseñas del App Store y artículos de terceros. **No se creó una cuenta en Fudo**: la comparación de la app de Fudo por dentro se basa en lo que publica y en reseñas, no en uso directo. Lo de UNNA es lo que está en `develop` hoy y fue probado contra la API real.

## Resumen en una tabla

| Eje | Fudo | UNNA hoy | Lectura |
|---|---|---|---|
| Alcance funcional | Suite completa: gestión, cobros, delivery, facturación, KDS, mesas | Ventas/POS, catálogo, stock, sucursales, horarios | Brecha grande |
| Facturación ARCA | Módulo pago, con impresoras fiscales | Ticket interno; A/B/C quedan en borrador, sin CAE | Bloqueante para vender en AR |
| Pagos | Terminal Fudo, Fudo Pagos, Mercado Pago | Registro manual de pagos (efectivo, tarjeta, MP, transferencia, QR) | Brecha |
| Delivery | Tienda online, WhatsApp con IA, Rappi/PedidosYa/Uber Eats, repartidores | Tipo de pedido "delivery" sin canales | Brecha grande |
| Multi-sucursal | "Contactar a ventas" | Incluido desde el onboarding (sucursales y horarios por sucursal) | **Ventaja UNNA** |
| Integridad de datos | No observable desde afuera | Precios calculados en el servidor, bloqueo por pedido, sin edición tras cobrar, aislamiento entre negocios | **Ventaja UNNA** (verificada) |
| Onboarding | "Listo en 15 minutos", formulario de 6 campos | Registro + wizard de 4 pasos con CUIT, sucursales y horarios | Fudo más rápido; UNNA captura datos fiscales desde el inicio |
| Precio | Planes de $22.500 a $69.500/mes + módulos | Sin modelo definido | Por definir (ver sección 5) |
| Escala y confianza | 35.000+ locales, 350M+ transacciones/año | Sin clientes | Brecha de mercado |

## 1. Funcionalidades

✅ tiene · 🟡 parcial · ❌ no tiene

| Área | Fudo | UNNA | Nota sobre UNNA |
|---|---|---|---|
| Venta por mostrador / take away | ✅ | ✅ | POS con tipos salón, para llevar, delivery, retiro |
| Modificadores y adicionales | ✅ | ✅ | Mínimo/máximo/obligatorio; opciones con precio negativo ("sin X") |
| Descuentos | ✅ fijos, %, automáticos por cliente | 🟡 | Solo monto fijo por pedido |
| Pagos divididos y parciales | ✅ | ✅ | Con bloqueo contra pagos simultáneos |
| Propinas | ✅ | ❌ | |
| Cierre parcial / venta por comensal | ✅ (módulo) | ❌ | |
| Caja: arqueo, arqueo ciego, múltiples cajas, turnos | ✅ | ❌ | |
| Impresión de comandas y precuentas | ✅ USB/Serie/Ethernet | ❌ | |
| Monitor de cocina (KDS) | ✅ tiempos y alertas | ❌ | Hay estados de pedido (confirmar → preparar → listo → entregar) |
| Gestión de mesas (mapa, traslados, camareros) | ✅ módulo $8.500 | 🟡 | Solo número de mesa en el pedido |
| Catálogo: categorías, productos, combos | ✅ | ✅ | Combos/compuestos soportados en dominio |
| Listas de precios | ✅ (Pro) | 🟡 | Existen en la API, el POS todavía usa el precio base |
| Stock: niveles, movimientos, conteo, mermas | ✅ | ✅ | Ingreso, egreso con tipo, conteo, umbrales |
| Recetas con costeo e ingredientes | ✅ | ❌ | |
| Gastos, estado de resultados | ✅ | ❌ | |
| Clientes y cuentas corrientes | ✅ | ❌ | |
| Proveedores | ✅ | ❌ | |
| Usuarios ilimitados, roles, PIN por mozo | ✅ | 🟡 | Roles en el dominio de auth, sin gestión de equipo en la UI |
| Reportes y exportación a Excel | ✅ | ❌ | |
| Facturación electrónica ARCA | ✅ módulo $13.500 | ❌ | Planificado (T26) |
| Carta QR / pedido desde la mesa | ✅ | ❌ | |
| Tienda online, WhatsApp, IA, repartidores | ✅ | ❌ | Planificado (T25) |
| Integraciones delivery (Rappi, PedidosYa, Uber Eats) | ✅ módulo $19.500 | ❌ | |
| App móvil (mozos) y app para comensales | ✅ | ❌ | Web responsive |
| API pública | ✅ (Pro) | 🟡 | API REST interna documentada con Swagger; sin API pública para terceros |
| Multi-sucursal | 🟡 ventas consultivas | ✅ | Sucursales y horarios desde el día uno |
| Autenticación completa (verificación, recupero) | — | ✅ | Registro, login, verificación de email, recupero de contraseña |

## 2. UI/UX

| Aspecto | Fudo | UNNA |
|---|---|---|
| Promesa de entrada | "Listo en 15 minutos", "Sin tarjeta de crédito" | Registro + onboarding guiado |
| Alta | Un formulario: negocio, nombre, teléfono, email, contraseña, términos | Mismos datos + wizard: datos fiscales con CUIT validado, sucursales, horarios, confirmación |
| Plataformas | Web, app móvil iOS/Android, app para comensales | Web (Next.js), sin app nativa |
| POS | Grilla de productos, mesas, comandas | Grilla por categoría con búsqueda, diálogo de modificadores que bloquea si falta una opción obligatoria, totales del servidor, cobro dividido, ticket |
| Accesibilidad | Sin datos públicos | Contraste AA en botones (verificado por test), roles ARIA en pestañas, diálogos y alertas |
| Percepción de usuarios | "muy sencillo de utilizar. Intuitivo y útil" (App Store) | Sin usuarios aún |
| Quejas de usuarios | "Se pone en gris la aplicación muy seguido", "la parte de inventarios esta bien complicada" | — |

**Lectura:** Fudo optimiza el tiempo hasta la primera venta. UNNA pide más datos al principio, lo que agrega fricción pero deja listo el terreno para facturar (CUIT, condición frente al IVA, punto de venta). Vale la pena medir el abandono del wizard y permitir completar los datos fiscales después de la primera venta.

## 3. Comportamiento y reglas de negocio

| Regla | Fudo | UNNA |
|---|---|---|
| Quién calcula precios y totales | No observable | Siempre el servidor; el cliente no puede mandar precios |
| Editar un pedido ya cobrado | No observable | Bloqueado desde el primer pago |
| Cancelar un pedido con pagos | No observable | Rechazado: corresponde reembolso |
| Pagos simultáneos sobre el mismo pedido | No observable | Serializados con bloqueo de fila; probado: 10 pagos a la vez → 1 aceptado |
| Comandas sin caja abierta | Reclamado por un usuario: "dejan q manden comandas sin q el cajero abra caja" | No aplica todavía (no hay caja) |
| Aislamiento entre negocios | No observable | Verificado: un negocio no puede leer ni modificar datos de otro |
| Validación de entrada | Formulario de alta con reglas claras | Validación en API (DTOs) y en web, mensajes en rioplatense |

**Lectura:** las reglas de integridad son una ventaja real de UNNA, pero invisibles para el cliente. Hay que traducirlas a beneficios concretos ("nunca perdés un cobro", "el ticket siempre coincide con lo cobrado").

## 4. Modelo de negocio de Fudo

**Suscripción mensual en pesos, por plan, más módulos que se suman** (Argentina, lista publicada en junio de 2026):

| Plan | Precio final/mes | Qué agrega |
|---|---|---|
| Inicial | $22.500 | Mostrador, caja, comandas, descuentos, carta QR |
| Avanzado (recomendado) | $43.900 | + inventario, recetas, clientes y proveedores, reportes, pedido desde la mesa |
| Pro | $69.500 | + múltiples cajas y turnos, estado de resultados, listas de precios, inventario valorizado, API |

| Módulo | Precio final/mes |
|---|---|
| Gestión de Mesas | $8.500 |
| Facturación Electrónica | $13.500 |
| Delivery Apps | $19.500 |
| Recepcionista IA | $55.000 |

- **Incluido en todos:** usuarios ilimitados, capacitaciones, app móvil, cobro con Terminal Fudo.
- **Sin contrato ni costo de instalación**, prueba gratis sin tarjeta.
- **Multi-sucursal:** a consultar con ventas.
- **Otros ingresos probables:** Terminal Fudo / Fudo Pagos (comisiones no publicadas), logística (Rapiboy).
- **Ejemplo:** un restaurante con salón que factura y toma delivery en plan Avanzado paga $43.900 + $8.500 + $13.500 + $19.500 = **$85.400/mes**.
- **Mensaje comercial:** "Sin comisiones del 30%" (contra las apps de delivery).

## 5. Oportunidades para UNNA

Ordenadas por impacto para poder vender en Argentina.

| Prioridad | Qué | Por qué |
|---|---|---|
| 1 | Facturación ARCA (CAE, numeración secuencial) | Sin esto no se puede operar legalmente; hoy el ticket tiene numeración aleatoria |
| 2 | Caja y turnos (apertura, arqueo, cierre) | Es la rutina diaria de cualquier local; además evita el problema que reportan en Fudo |
| 3 | Impresión de comandas y KDS | La cocina necesita ver el pedido; los estados ya existen en UNNA |
| 4 | Mesas (mapa y traslados) | Salones y bares lo esperan de entrada |
| 5 | Reportes básicos | Ventas por día, producto y medio de pago |
| 6 | Integración de cobro (Mercado Pago QR/Point) | Cobro sin cargar el pago a mano |

**Diferenciadores a sostener:**

- **Multi-sucursal incluido**, sin "contactar a ventas".
- **Precio todo incluido** (o con menos módulos): el ejemplo de Fudo suma $85.400/mes con los módulos que usa un restaurante típico.
- **Implementación acompañada y rápida**: es la queja más fuerte en reseñas ("Tarde 2 meses para dejar el sistema al 100", "nadie te da una solución").
- **Confiabilidad visible**: estabilidad y reglas de cobro como argumento de venta.
- **Comunidad ("A Community of Sharing")**: algo que Fudo no ofrece. Ideas: benchmarks anónimos entre locales parecidos, compras colectivas a proveedores, referidos con beneficio para los dos.

**Modelos de precio posibles (para decidir, no decididos):**

| Modelo | A favor | En contra |
|---|---|---|
| Plan único todo incluido por sucursal | Simple, contrasta con los módulos de Fudo | Menos margen en locales chicos |
| Freemium (POS gratis, pago por facturación, reportes y multi-sucursal) | Baja la barrera de entrada | Requiere escala para monetizar |
| Comisión por pagos procesados | Alinea precio con uso | Depende de integrar pagos; Fudo usa "sin comisiones" como mensaje |

## Fuentes

- fu.do: [home](https://fu.do/es-ar/), [funcionalidades](https://fu.do/es-ar/funcionalidades/), [precios](https://fu.do/es-ar/precios/), [preguntas frecuentes](https://fu.do/es-ar/preguntas-frecuentes/), [crear cuenta](https://fu.do/es-ar/crear-cuenta/), [lista de precios AR junio 2026 (PDF)](https://fu.do/assets/files/AR_FUDO_Planes-y-precios_JUN-26.pdf).
- [Reseñas App Store México](https://apps.apple.com/mx/app/fudo-software-gastron%C3%B3mico/id1137158486?see-all=reviews): 3,3/5 con 32 calificaciones.
- [Viteunetable: cuánto cuesta un software para restaurante en Argentina](https://viteunetable.com/es/cuanto-cuesta-software-restaurante-argentina) (confirma la lista de junio 2026).
- UNNA: `odd/tasks/unna-platform.md` (S1–S10, L1–L27) y el código de `develop`.
