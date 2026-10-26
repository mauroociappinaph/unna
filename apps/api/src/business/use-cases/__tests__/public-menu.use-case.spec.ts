import { NotFoundError, Schedule } from '@unna/domain';
import { CAFE, MEDIALUNA, MILK, NOW, OAT, PreorderWorld, SLUG, WHOLE } from './preorder-fakes';

describe('PublicMenuUseCase: menu of the public link (S20)', () => {
  let world: PreorderWorld;

  beforeEach(() => {
    world = new PreorderWorld();
  });

  it('lists the categories with products for sale and their active modifiers, with server prices', async () => {
    const { menu } = world.build();

    const result = await menu.menu(SLUG, NOW);

    expect(result.value).toEqual({
      businessName: 'Café UNNA',
      sucursalName: 'Palermo',
      accepting: true,
      reason: null,
      estimatedMinutes: 10,
      categories: [{ id: 'cat-1', name: 'Cafetería' }],
      products: [
        {
          id: CAFE, name: 'Café con leche', description: 'Doble', price: 100000, categoryId: 'cat-1', imageUrl: 'https://img/cafe.png',
          modifierGroups: [{
            id: MILK, name: 'Leche', minSelection: 1, maxSelection: 1, isRequired: true,
            options: [{ id: OAT, name: 'Avena', priceDelta: 20000 }, { id: WHOLE, name: 'Entera', priceDelta: 0 }],
          }],
        },
        { id: MEDIALUNA, name: 'Medialuna', description: null, price: 50000, categoryId: 'cat-1', imageUrl: null, modifierGroups: [] },
      ],
    });
  });

  describe('accepting: false with the reason, while the menu still loads', () => {
    const reasonFor = async (setup: (w: PreorderWorld) => void, now = NOW) => {
      setup(world);
      const result = await world.build().menu.menu(SLUG, now);
      expect(result.ok).toBe(true);
      expect(result.value!.products).toHaveLength(2);
      return { accepting: result.value!.accepting, reason: result.value!.reason };
    };

    it('outside the schedule (Argentina time)', async () => {
      // Sunday is closed by default; 2026-10-25 15:00 UTC is Sunday 12:00 in Argentina.
      expect(await reasonFor(() => undefined, new Date('2026-10-25T15:00:00Z'))).toEqual({ accepting: false, reason: 'El local está cerrado en este momento' });
      // Monday 08:30 in Argentina, before the 09:00 opening.
      expect(await reasonFor(() => undefined, new Date('2026-10-26T11:30:00Z'))).toEqual({ accepting: false, reason: 'El local está cerrado en este momento' });
    });

    it('with a schedule closed all day', async () => {
      expect(await reasonFor((w) => { w.local.schedule = Schedule.createClosed(); })).toEqual({ accepting: false, reason: 'El local está cerrado en este momento' });
    });

    it('with the caja closed', async () => {
      expect(await reasonFor((w) => w.openCash.clear())).toEqual({ accepting: false, reason: 'El local no está recibiendo pedidos en este momento' });
    });

    it('without Mercado Pago connected', async () => {
      expect(await reasonFor((w) => w.mpRepository.connections.clear())).toEqual({ accepting: false, reason: 'El local no está recibiendo pedidos en este momento' });
    });

    it('with the sucursal or the business deactivated', async () => {
      expect(await reasonFor((w) => { w.local.isActive = false; })).toEqual({ accepting: false, reason: 'El local no está recibiendo pedidos en este momento' });
      world = new PreorderWorld();
      expect(await reasonFor((w) => { w.local.businessActive = false; })).toEqual({ accepting: false, reason: 'El local no está recibiendo pedidos en este momento' });
    });
  });

  it.each([
    ['an unknown slug', 'Unknown_slug-0123456789'],
    ['a malformed slug', 'short'],
  ])('answers the generic 404 for %s', async (_case, slug) => {
    const result = await world.build().menu.menu(slug, NOW);

    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(result.error!.message).toBe('Este local no recibe pedidos anticipados');
  });
});
