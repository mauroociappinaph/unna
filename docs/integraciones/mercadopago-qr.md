# Mercado Pago QR (S15)

Reference for the S15 integration: each café connects its own Mercado Pago account with OAuth and charges orders with a hybrid QR (printed per cash register + shown on screen). Facts below come from the official Argentina docs (Orders API), checked 2026-10-25.

## Mercado Pago API facts

### OAuth (authorization code + PKCE)
Sources: [creation](https://www.mercadopago.com.ar/developers/en/docs/security/oauth/creation), [token](https://www.mercadopago.com.ar/developers/en/reference/authentication/oauth/_oauth_token/post.md), [renewal](https://www.mercadopago.com.ar/developers/en/docs/security/oauth/renewal.md)

- Authorization URL: `https://auth.mercadopago.com/authorization?client_id=APP_ID&response_type=code&platform_id=mp&state=STATE&redirect_uri=URI&code_challenge=C&code_challenge_method=S256`.
  - `state`: unique per attempt, no sensitive data. `redirect_uri`: static, must exactly match a Redirect URL registered in the application.
  - PKCE is enabled in the application settings; then `code_challenge` (S256) is mandatory and `code_verifier` (43–128 chars) goes in the token exchange.
  - The returned `code` is valid for 10 minutes.
- Token: `POST https://api.mercadopago.com/oauth/token` (JSON).
  - Code: `client_id`, `client_secret`, `grant_type: "authorization_code"`, `code`, `redirect_uri`, `code_verifier`.
  - Refresh: `client_id`, `client_secret`, `grant_type: "refresh_token"`, `refresh_token`.
  - Response: `access_token`, `token_type`, `expires_in` (15552000 s = 180 days), `scope` (needs `offline_access` to refresh), `user_id` (number), `refresh_token`, `public_key`, `live_mode`.
  - A refresh token works once; every refresh returns a new one that must be stored. Refresh before expiry.
  - Errors: `invalid_grant`, `invalid_client`, `unauthorized_client`, 429 `local_rate_limited`.

### Store and cash register (POS) per sucursal
Source: [create store and POS](https://www.mercadopago.com.ar/developers/en/docs/qr-code/create-store-and-pos.md)

- Store: `POST /users/{user_id}/stores` with the seller token. Required `name`, `external_id` (alphanumeric, ≤60), `location` {`street_number`, `street_name`, `city_name`, `state_name`, `latitude`, `longitude`, `reference`}. Returns `id`.
- POS: `POST /v2/pos` with `X-Idempotency-Key`. `name`, `store_id` or `external_store_id`, `external_id` (≤40, unique; required for QR orders), `config.qr.operating_mode` (`pdv`), `config.qr.category` (MCC).
- POS response `qr_response`: `uuid`, `image` (PNG URL), `template_document` (PDF URL), `template_image`, `qr_code`. This is the printed static QR.
- Not confirmed: Argentina-mandatory `location` fields and MCC values. Validate against a test account before production.

### Orders
Sources: [payment processing](https://www.mercadopago.com.ar/developers/en/docs/qr-code/payment-processing.md), [create order](https://www.mercadopago.com.ar/developers/en/reference/in-person-payments/qr-code/orders/create-order/post), [statuses](https://www.mercadopago.com.ar/developers/en/docs/qr-code/resources/status-order-transaction.md), [cancel](https://www.mercadopago.com.ar/developers/en/reference/in-person-payments/qr-code/orders/cancel-order/post.md)

- Create: `POST /v1/orders`, headers `Authorization: Bearer <seller token>`, `X-Idempotency-Key` (UUID v4, required).
  - Body: `type: "qr"`, `external_reference` (≤64, `[A-Za-z0-9_-]`, no personal data), `total_amount` ("50.00"), `description` (≤150), `expiration_time` (ISO 8601 duration, default 15 min), `config.qr.external_pos_id` (= POS `external_id`), `config.qr.mode: "hybrid"`, `transactions.payments: [{ amount: "50.00" }]`, optional `items`.
  - Response 201: `id` ("ORD…"), `status`, `status_detail`, `transactions.payments[].id` ("PAY…"), `type_response.qr_data` (EMVCo string for the on-screen QR).
- Statuses: `created` (unpaid), `processed`/`processed` (paid), `processed`/`partially_refunded`, `refunded`, `expired`, `canceled`.
- Get: `GET /v1/orders/{id}` (orders from the last 3 months).
- Cancel: `POST /v1/orders/{id}/cancel` with `X-Idempotency-Key`, only when `status=created`. 409 `order_already_canceled`, `instore_order_locked_error` (payment in progress).
- Refund: `POST /v1/orders/{id}/refund` with `X-Idempotency-Key`; no body = full refund. Within 180 days.

### Webhooks
Source: [notifications](https://www.mercadopago.com.ar/developers/en/docs/qr-code/notifications.md)

- Configured once in the UNNA application (event "Order (Mercado Pago)"); saving generates the signing secret.
- Delivery: `POST <url>?data.id=ORD…&type=order`, body with `action` (`order.processed`, `order.canceled`, `order.refunded`, `order.expired`, `order.action_required`), `user_id` (seller), `data.id`, `data.external_reference`, `data.status`.
- Signature: header `x-signature: ts=<ms>,v1=<hex>`. Manifest `id:<data.id lowercased>;request-id:<x-request-id>;ts:<ts>;` (omit missing segments). HMAC-SHA256 hex with the webhook secret, constant-time compare with `v1`.
- Reply 200 within 22 s; Mercado Pago retries otherwise. Never trust the body: read the order with `GET /v1/orders/{id}`.

### Testing
- Test credentials and test users from Your integrations → Test credentials. There is no API to mark an order paid: pay by scanning with the buyer test user in the Mercado Pago app. Webhooks → "Simulate notification" only tests the endpoint.

## UNNA design

- Tokens (access and refresh) and the PKCE verifier are stored encrypted with AES-256-GCM (`MP_TOKEN_ENCRYPTION_KEY`, 32 bytes base64). They are never returned by the API nor logged.
- OAuth attempts are stored server-side: `state` is random, single use, valid 10 minutes, bound to the business.
- The payment is registered only from an order read from Mercado Pago (`GET /v1/orders/{id}`), never from the webhook body, and only once per Mercado Pago order (unique reference). It uses method `mercado_pago`, reference = Mercado Pago order id, and the open cash session of the sucursal.
- Without `MP_CLIENT_ID` and `MP_CLIENT_SECRET`, a simulator replaces Mercado Pago; it throws in production (`NODE_ENV=production`). The simulator authorizes instantly and exposes a development-only endpoint to mark a QR order paid.

### QR charges (T33b)
- Creating a charge requires an order of the business that is not cancelled or paid, the Mercado Pago connection, the sucursal POS and an open caja. It runs in three short steps so Mercado Pago is never called with the order lock held (S18): (1) under the order lock, check the order and reserve a charge with status `creating` (no `mpOrderId`/`qrData` yet), or return the pending one; (2) call Mercado Pago without locks, with the charge id as idempotency key; (3) under the order lock, store `mpOrderId` and `qrData` and move it to `pending`. Concurrent requests wait for the reservation and get the same charge. If Mercado Pago fails the reservation is cancelled ("No se pudo crear el cobro QR. Probá de nuevo"); a `creating` charge older than 2 minutes is abandoned; a request that keeps waiting gets "Ya se está creando el cobro QR de este pedido. Probá de nuevo en unos segundos". GET and DELETE may return a `creating` charge with `qrData: null`.
- The Mercado Pago order: `type: "qr"`, `mode: "hybrid"`, `external_pos_id` = the sucursal POS, `total_amount` = pending balance, `expiration_time: "PT15M"`, `X-Idempotency-Key` = charge id, `external_reference` = `<order id>-<charge id>` without dashes, cut to 64 chars.
- A pending charge whose 15 minutes passed is synced with Mercado Pago before a new one is created.
- Sync (GET, DELETE, webhook, simulator): the order is read from Mercado Pago with the connection of the charge's business. `processed` → `paid`, `expired` → `expired`, `canceled`/`refunded` → `cancelled`; other statuses keep it `pending`. Mercado Pago is read outside the lock; the result is applied under the order lock and only to a pending charge (a `creating` charge is returned unchanged), so a payment is registered once per Mercado Pago order (also guarded by the unique `mpOrderId` and `paymentId` of the charge).
- The payment goes through the same rules as `POST /orders/:orderId/payments` (open caja read `FOR SHARE`, pending balance).
- **Paid but not registered.** If the caja was closed meanwhile, the amount no longer fits the balance, the order was cancelled or paid, or Mercado Pago charged a different amount, the money is already in the café's account. The charge stays `paid` with `paymentRegistered: false` and `paymentError` (the reason, e.g. "Abrí la caja para cobrar"). The owner registers it by hand (method `mercado_pago`, reference = the Mercado Pago order id) or refunds it.
- Cancel calls Mercado Pago only while the order is `created`. If the customer paid meanwhile, the payment is registered and the charge comes back `paid`.
- Webhook: the signature is checked before reading any data; missing or invalid → 401. The body is never read; the order comes from the signed `data.id` of the query. Valid notifications get 200, including unknown orders; a failed sync of a known order gets 503 (logged) so Mercado Pago retries it, since the POS may be closed. There is no `ts` tolerance: a replay only re-reads the order, which is idempotent. It is not rate limited: rejecting costs one HMAC and no query.
- Provisioning the store + POS of a sucursal takes a claim on the sucursal (`mpProvisioningAt`, a single conditional update). Only one request calls Mercado Pago, so only one store is created. A concurrent request gets the QR if it is ready, or the in-progress error. Claims older than 2 minutes count as abandoned.
- The simulator routes are registered only when the simulator is used outside production. It also answers 404 if it runs with the real gateway or with `NODE_ENV=production`.

### Environment
| Variable | Purpose |
|---|---|
| `MP_CLIENT_ID`, `MP_CLIENT_SECRET` | UNNA application credentials (empty = simulator) |
| `MP_REDIRECT_URI` | OAuth callback registered in the application, e.g. `https://api.example.com/api/v1/mercadopago/oauth/callback` |
| `MP_WEBHOOK_SECRET` | Signing secret of the webhook |
| `MP_TOKEN_ENCRYPTION_KEY` | 32-byte base64 key for tokens at rest (required in production) |
| `FRONTEND_URL` (existing) | Where the OAuth callback redirects the owner back |

### API contract (prefix `/api/v1`)
Owner routes require the JWT and `BusinessOwnerGuard`; amounts in cents.

| Method and path | Response |
|---|---|
| `GET /businesses/:id/mercadopago` | `{ connected: boolean, mpUserId: string \| null, liveMode: boolean \| null, connectedAt: string \| null, sucursales: [{ sucursalId, name, ready: boolean, qrImageUrl: string \| null, qrTemplateUrl: string \| null }] }` |
| `POST /businesses/:id/mercadopago/connect` | `{ authorizationUrl: string }` |
| `DELETE /businesses/:id/mercadopago` | 204; removes tokens and cash registers links |
| `POST /businesses/:id/sucursales/:sucursalId/mercadopago/pos` | Creates store + POS if missing (idempotent). `{ sucursalId, ready: true, qrImageUrl, qrTemplateUrl }` |
| `POST /businesses/:id/orders/:orderId/qr-charge` | Charges the pending balance. `{ id, orderId, amount, status: "pending", qrData, expiresAt, paidAt: null, paymentRegistered: false, paymentError: null }` |
| `GET /businesses/:id/qr-charges/:chargeId` | Syncs with Mercado Pago. `{ id, orderId, amount, status: "pending" \| "paid" \| "expired" \| "cancelled", qrData, expiresAt, paidAt: string \| null, paymentRegistered: boolean, paymentError: string \| null }` |
| `DELETE /businesses/:id/qr-charges/:chargeId` | Cancels a pending charge (200). Returns the charge with `status: "cancelled"`, or `"paid"` if it was paid meanwhile. Finished charges come back unchanged |
| `GET /mercadopago/oauth/callback?code&state` | Public. 302 to `${FRONTEND_URL}/dashboard/mercadopago?status=connected` or `?status=error` |
| `POST /public/mercadopago/webhook` | Public, signature validated, 200 (401 when missing or invalid) |
| `POST /mercadopago/simulator/orders/:mpOrderId/pay` | Simulator only, never in production. Marks the simulated order paid, runs the webhook sync and returns the charge (404 if unknown or not pending) |
| `POST /mercadopago/simulator/businesses/:id/qr-charges/:chargeId/pay` | Simulator only, owner route (JWT + BusinessOwnerGuard): the POS "Simular pago" button. Same sync by charge id, scoped to the business; returns the charge with `simulated: true` |

Errors (Spanish messages): not connected → 400 "Conectá tu cuenta de Mercado Pago"; sucursal without POS → 400 "Activá el cobro QR en esta sucursal"; no open caja → 400 "Abrí la caja para cobrar"; order already paid → 400 "El pedido ya está pagado"; a pending charge already exists for the order → returns that charge.

More errors: order of another business or missing → 404 "Pedido no encontrado"; charge of another business or missing → 404 "Cobro QR no encontrado"; cancelled order → 400 "No se puede cobrar un pedido cancelado o reembolsado"; cancel rejected while the customer is paying → 400 "No se pudo cancelar el cobro QR: hay un pago en curso. Probá de nuevo en unos segundos"; concurrent POS provisioning → 400 "Ya se está activando el cobro QR en esta sucursal. Probá de nuevo en unos segundos"; webhook signature → 401 "Firma de Mercado Pago inválida".

While the simulator is wired, `POST /orders/:orderId/qr-charge` and `GET /qr-charges/:chargeId` add `simulated: true` (otherwise `false`), so the POS shows "Simular pago" only in that mode.
