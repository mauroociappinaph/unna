import type { OrderTracking, PublicMenu } from '@/lib/public-order-api';

export const SLUG = 'AbCdEfGhIjKlMnOp12';
export const TRACKING_TOKEN = 'TrAcKiNgToKeN0123456789abcdefghijklmn';

/** Menu of GET /public/pedido/:slug as the API contract describes it (docs/integraciones/pedido-anticipado.md). */
export const menu: PublicMenu = {
  businessName: 'Café Lunes',
  sucursalName: 'Palermo',
  accepting: true,
  reason: null,
  estimatedMinutes: 10,
  categories: [
    { id: 'cat-1', name: 'Cafés' },
    { id: 'cat-2', name: 'Panadería' },
  ],
  products: [
    {
      id: 'p-1',
      name: 'Latte',
      description: 'Doble shot con leche',
      price: 300000,
      taxRate: 0,
      categoryId: 'cat-1',
      imageUrl: null,
      modifierGroups: [
        {
          id: 'g-milk',
          name: 'Leche',
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          options: [
            { id: 'o-whole', name: 'Entera', priceDelta: 0 },
            { id: 'o-oat', name: 'Avena', priceDelta: 50000 },
          ],
        },
        {
          id: 'g-extras',
          name: 'Extras',
          minSelection: 0,
          maxSelection: 2,
          isRequired: false,
          options: [
            { id: 'o-shot', name: 'Shot extra', priceDelta: 40000 },
            { id: 'o-cinnamon', name: 'Canela', priceDelta: 0 },
            { id: 'o-vanilla', name: 'Vainilla', priceDelta: 30000 },
          ],
        },
      ],
    },
    {
      id: 'p-2',
      name: 'Medialuna',
      description: null,
      price: 80000,
      taxRate: 0,
      categoryId: 'cat-2',
      imageUrl: null,
      modifierGroups: [],
    },
  ],
};

export const closedMenu: PublicMenu = { ...menu, accepting: false, reason: 'El local está cerrado en este momento' };

export function tracking(overrides: Partial<OrderTracking> = {}): OrderTracking {
  return {
    status: 'received',
    orderNumber: '042',
    customerFirstName: 'Martina',
    businessName: 'Café Lunes',
    sucursalName: 'Palermo',
    total: 460000,
    items: [
      { name: 'Latte', quantity: 1 },
      { name: 'Medialuna', quantity: 2 },
    ],
    estimatedMinutes: 10,
    updatedAt: '2026-10-26T12:00:00.000Z',
    ...overrides,
  };
}
