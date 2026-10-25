# UNNA vs Fudo y los especialistas en cafés

**Conclusión:** UNNA apunta a **cafés take away**, no a restaurantes. En ese segmento Fudo es un rival generalista: sirve, pero le cobra a un café una suite pensada para salón (piso real: **$36.000/mes** con facturación). El problema es que ir por cafés **no diferencia por sí solo**: ya hay sistemas especializados que se venden como "alternativa a Fudo para cafés" (Frambuesa, Nikao, GestResto, Payper, Madi Digital, bcnsoft), varios con ARCA incluido y precios más bajos. La diferencia de UNNA tiene que estar en **cómo resuelve la hora pico**: venta en segundos, pedido anticipado con aviso de "listo", fidelización incluida y facturación en el mismo cobro.

> Relevado el 25/10/2026 desde páginas públicas (fu.do, frambuesa.app, nikao.com.ar, gestresto.com y otros), reseñas del App Store y artículos de terceros. No se creó cuenta en ningún producto: lo de los competidores sale de lo que publican. Lo de UNNA es lo que está en `develop` hoy, probado contra la API real. Los precios están en pesos y cambian seguido.

## 1. Qué necesita un café take away

| Necesidad | Por qué importa |
|---|---|
| Venta en segundos en el mostrador | Ticket chico, mucho volumen, cola en hora pico (8–11 h) |
| Opciones de cada café | Tamaño, tipo de leche, shot extra, sin azúcar: cada una puede sumar o restar precio |
| Pedido con nombre y aviso de "listo" | El cliente espera parado; llamar por nombre o avisar por el celular |
| Pedido anticipado para retirar | El cliente pide en el camino y pasa a buscar |
| Cobro con QR (Mercado Pago) y tarjeta | Pocos pagan en efectivo; el cobro tiene que conciliarse solo |
| Facturación ARCA en el mismo cobro | Obligatoria; no puede agregar pasos al mostrador |
| Caja y turnos | Turnos cortos, cierre rápido y sin diferencias |
| Fidelización (tarjeta de sellos, puntos) | Clientes que vuelven todos los días |
| Stock de insumos y costo por taza | Café, leches, vasos: el margen está en el costo por taza |
| Varias sucursales | Las cadenas de café crecen por locales chicos |

Lo que **pesa poco** en este segmento: mapa de mesas, traslados entre mesas, venta por comensal, reservas, integraciones con apps de delivery.

## 2. Cómo cubre cada uno el segmento

✅ tiene · 🟡 parcial · ❌ no tiene · — no publicado

| Necesidad | Fudo | Frambuesa | Nikao | GestResto | **UNNA hoy** |
|---|---|---|---|---|---|
| Venta rápida en mostrador | ✅ "Pedidos rápidos desde mostrador" | ✅ varias ventas a la vez con nombre | ✅ "Abrís el pedido en un toque" | ✅ por teclado, sin mouse | 🟡 grilla con búsqueda; sin modo rápido ni favoritos |
| Opciones del café (tamaño, leche) con precio | ✅ modificadores | — | — | — | ✅ mínimo/máximo/obligatorio, deltas positivos y negativos |
| Pedido con nombre / aviso de "listo" | 🟡 estados de pedido; aviso por WhatsApp en tienda online | 🟡 nombre o referencia | — | — | 🟡 estados (confirmar → preparar → listo → entregar), sin nombre ni aviso |
| Pedido anticipado para retirar | ✅ tienda online / WhatsApp | ✅ pedidos online sin comisión | ❌ | ❌ | ❌ (existe el tipo "retiro") |
| Cobro QR Mercado Pago | ✅ | — | ✅ QR en la caja | ✅ registrado en el turno | 🟡 se registra el medio a mano |
| ARCA | 🟡 módulo $13.500 | ✅ incluido en Pro / plan con facturación | ✅ en el mismo flujo del ticket | — | ❌ (planificado, T26) |
| Caja y turnos | ✅ arqueo, turnos en Pro | ✅ apertura, arqueo, historial | ✅ cierre con MP, efectivo y tarjeta | ✅ esperado vs declarado | ❌ |
| Fidelización | ❌ | ✅ puntos, sellos, cashback (Pro) | ❌ | ❌ "Todavía no" | ❌ |
| Stock de insumos / recetas | ✅ recetas con costeo (Avanzado) | ✅ descuento de insumos (Pro) | ❌ | 🟡 en el plan superior | 🟡 stock por producto; sin recetas ni insumos |
| Multi-sucursal | 🟡 "Contactar a ventas" | ✅ precio por sucursal | — | 🟡 plan superior | ✅ incluido desde el onboarding |
| Integridad de cobros | — | — | — | — | ✅ precios del servidor, bloqueo contra pagos simultáneos, sin edición tras cobrar |

## 3. Precios para un café (por mes, una sucursal)

| Producto | Lo mínimo para operar y facturar | Con stock/recetas | Prueba |
|---|---|---|---|
| Fudo | Inicial $22.500 + Facturación $13.500 = **$36.000** | Avanzado $43.900 + Facturación = **$57.400** | Gratis, sin tarjeta (sin plazo publicado) |
| Frambuesa | Inicial + Facturación Fiscal **$29.900** | Pro **$49.900** (incluye ARCA y fidelización) | 7 días de Pro, desde el primer turno |
| Nikao | Básico **$29.500** (ARCA en el flujo; plan no especificado) | Pro $69.900 | 30 días, sin tarjeta |
| GestResto | Básico **$19.990** IVA incluido (ARCA no publicado) | Plan superior (sin precio en la página) | 14 días, sin tarjeta |
| bcnsoft | Desde **$54.900 + IVA** | — | — |
| **UNNA** | Sin precio definido | — | — |

Fudo además usa como mensaje "Sin comisiones del 30%" (contra las apps de delivery) y vende un módulo Recepcionista IA a $55.000/mes.

## 4. Dónde puede diferenciarse UNNA

| Idea | Qué es | Quién lo tiene hoy |
|---|---|---|
| **Modo hora pico** | Venta en 2–3 toques: favoritos, repetir el último pedido, teclado, opciones del café en un solo panel. Medible: segundos por venta | GestResto (teclado), Nikao ("un toque") |
| **Pedido anticipado + "tu café está listo"** | El cliente pide por link/QR, paga y recibe aviso (WhatsApp o web) cuando está listo; en el mostrador el pedido entra con su nombre | Nadie lo resuelve completo |
| **Fidelización incluida** | Tarjeta de sellos digital ("el 10.º café gratis") sin plan superior | Solo Frambuesa Pro |
| **ARCA y QR en el mismo cobro, incluidos** | Un solo toque cobra, concilia y factura | Nikao, Frambuesa (con condiciones) |
| **Costo por taza** | Recetas simples (café, leche, vaso) y margen por producto | Fudo Avanzado, Frambuesa Pro |
| **Cadenas de cafés** | Multi-sucursal incluido y precio por sucursal claro | Frambuesa |
| **Confiabilidad del cobro** | Lo que UNNA ya garantiza: el ticket siempre coincide con lo cobrado, nunca se pierde un pago | Nadie lo comunica |

## 5. Prioridades de producto para el segmento

| Orden | Qué | Por qué primero |
|---|---|---|
| 1 | Facturación ARCA en el cobro + numeración secuencial | Sin esto no se puede vender en Argentina |
| 2 | Caja y turnos | Rutina diaria del café, y todos los rivales lo tienen |
| 3 | Modo hora pico (favoritos, repetir, teclado) | Es el diferencial más visible en el mostrador |
| 4 | Cobro QR de Mercado Pago integrado | Medio de pago dominante en el segmento |
| 5 | Pedido con nombre + pantalla de barra + aviso de "listo" | Base del pedido anticipado; los estados ya existen |
| 6 | Pedido anticipado por link/QR | Diferencial que nadie resuelve completo |
| 7 | Tarjeta de sellos | Retención diaria; solo un rival la ofrece, y en Pro |
| 8 | Recetas e insumos (costo por taza) | Margen; puede venir después de vender |

Se postergan: mapa de mesas, venta por comensal, integraciones con apps de delivery, KDS completo de cocina.

## 6. Modelo de negocio (para decidir)

| Opción | A favor | En contra |
|---|---|---|
| Plan único por sucursal con ARCA y sellos incluidos, por debajo del piso de Fudo ($36.000) | Mensaje simple contra los módulos de Fudo y los planes Pro | Compite en precio con Frambuesa y Nikao (~$29.500–29.900) |
| Freemium: POS gratis; pago por ARCA, pedido anticipado, sellos y multi-sucursal | Entrada sin fricción para cafés chicos | Necesita escala para monetizar |
| Suscripción + comisión baja sobre pedidos anticipados | Cobra cuando el café vende más | Choca con el "sin comisión" de Fudo y Frambuesa |

## 7. Contexto: Fudo como suite completa

Para referencia, lo que Fudo cubre más allá del café (y que UNNA no necesita priorizar): gestión de mesas ($8.500/mes), venta por comensal, KDS con tiempos y alertas, integraciones con Rappi, PedidosYa y Uber Eats ($19.500/mes), app para comensales, impresoras fiscales, API pública (Pro), recepcionista IA ($55.000/mes). Planes generales: Inicial $22.500, Avanzado $43.900, Pro $69.500 por mes (lista de junio de 2026).

**Percepción de usuarios de Fudo** (App Store México, 3,3/5 con 32 calificaciones): elogian la facilidad ("muy sencillo de utilizar. Intuitivo y útil") y se quejan del soporte e implementación ("Tarde 2 meses para dejar el sistema al 100", "nadie te da una solución") y de la estabilidad ("Se pone en gris la aplicación muy seguido").

## Fuentes

- Fudo: [home AR](https://fu.do/es-ar/), [home general (cafeterías)](https://fu.do/es/), [funcionalidades](https://fu.do/es-ar/funcionalidades/), [precios](https://fu.do/es-ar/precios/), [lista AR junio 2026 (PDF)](https://fu.do/assets/files/AR_FUDO_Planes-y-precios_JUN-26.pdf), [caso Hábito Café](https://fu.do/es-ar/historias-de-exito/habito-cafe/), [reseñas App Store MX](https://apps.apple.com/mx/app/fudo-software-gastron%C3%B3mico/id1137158486?see-all=reviews).
- Especialistas: [Frambuesa vs Fudo](https://www.frambuesa.app/comparison), [Nikao para cafeterías](https://nikao.com.ar/sistema-para-cafeterias), [GestResto para cafés](https://gestresto.com/para/cafes/), [bcnsoft para cafeterías](https://bcnsoft.com.ar/sistema-para-cafeterias-bcnsoft/), [Payper](https://payperapp.io/sistema-gestion-cafeterias-argentina), [Madi Digital](https://app.madi-digital.com/software-para-cafeteria).
- UNNA: `odd/tasks/unna-platform.md` (S1–S11) y el código de `develop`.
