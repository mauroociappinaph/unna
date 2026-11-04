import { createAuthApi } from './api-client/auth';
import { createBusinessApi } from './api-client/business';
import { createCashApi } from './api-client/cash';
import { createCatalogApi } from './api-client/catalog';
import { createHttpClient } from './api-client/http';
import { createMercadoPagoApi } from './api-client/mercadopago';
import { createPedidoAnticipadoApi } from './api-client/pedido-anticipado';
import { createSalesApi } from './api-client/sales';
import { createStockApi } from './api-client/stock';

export { refreshAccessToken } from './api-client/session';

const client = createHttpClient();

/** API client of the web app, one module per resource under lib/api-client. */
export const api = {
  ...createAuthApi(client),
  ...createBusinessApi(client),
  ...createCatalogApi(client),
  ...createStockApi(client),
  ...createSalesApi(client),
  ...createCashApi(client),
  ...createMercadoPagoApi(client),
  ...createPedidoAnticipadoApi(client),
};
