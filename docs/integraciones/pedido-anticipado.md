# Pedido anticipado (S20)

The customer opens a public link (or scans the printed QR) of a sucursal, builds a pickup order from the menu, pays online with Mercado Pago in the café's account, and follows the order on a tracking page until it is ready. Decisions: pay online when ordering, tracking page (no WhatsApp), "as soon as possible" (no scheduled pickup).

## Mercado Pago: Checkout Pro through the Orders API

Sources: [create order](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/create-order.md), [reference](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro/create-order/post), [back URLs](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/web-integration/configure-back-urls.md), [notifications](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/notifications.md), [statuses](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/payment-management/status/order-status), [cancel and refund](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/refunds-cancellations.md). Mercado Pago recommends the Orders API over the Preferences API for new integrations.

- `POST /v1/orders` with the seller's OAuth token, `X-Idempotency-Key`, body: `type: "online"`, `processing_mode: "manual"`, `total_amount` ("1234.50"), `external_reference`, `items[{ title, quantity, unit_price }]` (the sum must equal `total_amount`), `expiration_time` (ISO 8601 duration, e.g. `PT15M`), `config.online.success_url` / `failure_url` / `pending_url`, `config.online.auto_return: "approved"`.
- Response: `id` (`ORD…`), `status: "created"`, `checkout_url` (the buyer is redirected there).
- Confirmation: the same webhook as the QR (event "Order (Mercado Pago)", `x-signature`), then `GET /v1/orders/{id}`. Only `processed`/`accredited` counts as paid; the return URL `status` is only a UI hint.
- Statuses: `created`, `processing`, `action_required` → still pending; `processed` → paid; `failed` → payment failed; `canceled` (also used for expired) → cancelled; `refunded`.
- Cancel: `POST /v1/orders/{id}/cancel` (only `created`/`action_required`). Refund: `POST /v1/orders/{id}/refund` (no body = full).
- Not confirmed in the docs: a per-order notification URL (the panel URL is used, routed by `data.id`), the maximum `expiration_time`, the exact partial refund body.

## UNNA design

- **Activation per sucursal.** The owner enables "Pedido anticipado" for a sucursal: UNNA creates a random public slug (not a secret, not guessable: 16+ URL-safe chars) and shows the link `${FRONTEND_URL}/pedido/<slug>` with a printable QR. Disabling invalidates the link (404 "Este local no recibe pedidos anticipados"). Enabling again returns the same slug.
- **Accepting orders** requires: pedido anticipado enabled, the sucursal open now according to its schedule (Argentina time), an open caja in the sucursal, and the business connected to Mercado Pago. Otherwise the menu still loads but `accepting: false` with a Spanish `reason`.
- **Checkout first, order later.** Creating a checkout validates the cart with server prices (products active and of the business, modifiers valid, quantities 1..20, at most 30 lines), stores a cart snapshot with the total in an `OnlineCheckout` row (status `awaiting_payment`), creates the Mercado Pago online order and returns its `checkout_url`. **No UNNA order exists until the payment is approved.** This avoids unpaid orders in the POS and the bar.
- **On payment approved** (webhook, tracking poll or simulator): under a short transaction the order is created from the snapshot (type `pickup`, customer name, same prices as the snapshot) and the payment is registered with method `mercado_pago` and reference = Mercado Pago order id, exactly once per checkout (unique). Because it is fully paid, the order appears in the bar at once (the bar shows paid orders). If the caja was closed in between, the order is still created but the payment is kept as "paid, not registered" with the reason, like the QR (S15); the order is visible to the owner.
- **Never call Mercado Pago with a database lock held** (S18 rule).
- **Tracking.** Each checkout has a random `trackingToken` (secret, 32+ chars). `GET` tracking returns only: short order number, customer first name, sucursal name, status, total, items (name × quantity), estimated minutes. Status: `awaiting_payment`, `payment_failed`, `expired`, `received` (paid, order `pending`/`confirmed`), `preparing`, `ready`, `delivered`, `cancelled`. Estimated minutes = max `preparationTimeMinutes` of the items (default 10) for `received`/`preparing`.
- **Expiration.** Checkouts expire after 15 minutes without payment (`expiration_time: PT15M`); a tracking read after that marks them `expired`.
- **Public endpoints** have no auth, are rate limited per IP (reuse the public-board throttler with its own name and limit `PUBLIC_ORDER_RATE_LIMIT`, default 30 checkout creations and 120 reads per minute), never return other customers' data, and answer generic 404s for unknown slugs or tokens.
- **Simulator** (no `MP_CLIENT_ID`/`MP_CLIENT_SECRET`, never in plain production): `checkout_url` points to `${API}/api/v1/mercadopago/simulator/checkout/<mpOrderId>`, which marks the simulated order paid, runs the same sync and redirects (302) to the success URL.

## API contract (prefix `/api/v1`)

Owner routes: JWT + `BusinessOwnerGuard`; amounts in cents.

| Method and path | Response |
|---|---|
| `GET /businesses/:id/pedido-anticipado` | `{ sucursales: [{ sucursalId, name, enabled: boolean, url: string \| null }] }` |
| `POST /businesses/:id/sucursales/:sucursalId/pedido-anticipado` | Enable (idempotent). `{ sucursalId, enabled: true, slug, url }` |
| `DELETE /businesses/:id/sucursales/:sucursalId/pedido-anticipado` | Disable. 204 |
| `GET /public/pedido/:slug` | `{ businessName, sucursalName, accepting: boolean, reason: string \| null, estimatedMinutes: number, categories: [{ id, name }], products: [{ id, name, description \| null, price, categoryId \| null, imageUrl \| null, modifierGroups: [{ id, name, minSelection, maxSelection, isRequired, options: [{ id, name, priceDelta }] }] }] }` |
| `POST /public/pedido/:slug/checkouts` | Body `{ customerName (1..40 chars), items: [{ productId, quantity, modifiers?: [{ modifierGroupId, optionId }], notes? }] }`. 201 `{ trackingToken, checkoutUrl, total }` |
| `GET /public/pedido/seguimiento/:trackingToken` | `{ status, orderNumber \| null, customerFirstName, sucursalName, total, items: [{ name, quantity }], estimatedMinutes \| null, updatedAt }` (syncs with Mercado Pago while `awaiting_payment`) |
| `GET /mercadopago/simulator/checkout/:mpOrderId` | Simulator only: marks paid, syncs, 302 to the success URL |

Back URLs given to Mercado Pago: `${FRONTEND_URL}/pedido/seguimiento/<trackingToken>` for success, pending and failure.

Errors (Spanish): local not taking orders → 400 with the reason ("El local está cerrado en este momento", "El local no está recibiendo pedidos en este momento" for caja closed or Mercado Pago not connected); product unavailable → 400 "Algún producto ya no está disponible"; unknown slug → 404 "Este local no recibe pedidos anticipados"; unknown tracking token → 404 "Pedido no encontrado"; too many requests → 429.
