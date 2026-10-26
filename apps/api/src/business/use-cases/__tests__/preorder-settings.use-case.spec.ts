import { NotFoundError, isWellFormedPreorderSlug } from '@unna/domain';
import { BUSINESS, NOW, PreorderWorld } from './preorder-fakes';

describe('PreorderSettingsUseCase: pedido anticipado per sucursal (S20)', () => {
  const OLD_FRONTEND = process.env.FRONTEND_URL;
  let world: PreorderWorld;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://unna.example.com';
    world = new PreorderWorld();
  });
  afterAll(() => {
    if (OLD_FRONTEND === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = OLD_FRONTEND;
  });

  it('enables a sucursal with a random, URL-safe slug of 16+ chars and returns its public link', async () => {
    const { settings } = world.build();

    const result = await settings.enable(BUSINESS, 'suc-1');

    expect(result.ok).toBe(true);
    const { slug, url, enabled, sucursalId } = result.value!;
    expect(isWellFormedPreorderSlug(slug)).toBe(true);
    expect(slug.length).toBeGreaterThanOrEqual(16);
    expect({ sucursalId, enabled, url }).toEqual({ sucursalId: 'suc-1', enabled: true, url: `https://unna.example.com/pedido/${slug}` });
  });

  it('is idempotent: enabling twice, or again after disabling, returns the same slug', async () => {
    const { settings } = world.build();

    const first = (await settings.enable(BUSINESS, 'suc-1')).value!.slug;
    const second = (await settings.enable(BUSINESS, 'suc-1')).value!.slug;
    await settings.disable(BUSINESS, 'suc-1');
    const third = (await settings.enable(BUSINESS, 'suc-1')).value!.slug;

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('gives each sucursal its own slug', async () => {
    const { settings } = world.build();

    const a = (await settings.enable(BUSINESS, 'suc-1')).value!.slug;
    const b = (await settings.enable(BUSINESS, 'suc-2')).value!.slug;

    expect(a).not.toBe(b);
  });

  it('lists the sucursales of the business with their link while enabled', async () => {
    const { settings } = world.build();
    const slug = (await settings.enable(BUSINESS, 'suc-1')).value!.slug;
    await settings.enable(BUSINESS, 'suc-2');
    await settings.disable(BUSINESS, 'suc-2');

    const result = await settings.list(BUSINESS);

    expect(result.value).toEqual({
      sucursales: [
        { sucursalId: 'suc-1', name: 'Palermo', enabled: true, url: `https://unna.example.com/pedido/${slug}` },
        { sucursalId: 'suc-2', name: 'Belgrano', enabled: false, url: null },
      ],
    });
  });

  it.each(['enable', 'disable'] as const)('%s answers 404 for a sucursal of another business, without touching it', async (action) => {
    const { settings } = world.build();

    const result = await settings[action](BUSINESS, 'suc-B');

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(result.error!.message).toBe('Sucursal no encontrada');
    expect(world.sucursales.find((s) => s.id === 'suc-B')).toMatchObject({ enabled: true, slug: 'Other_slug-0123456789' });
  });

  it('the link of a disabled sucursal answers 404 "Este local no recibe pedidos anticipados"', async () => {
    const { menu } = world.build();
    world.local.enabled = false;

    const result = await menu.menu(world.local.slug!, NOW);

    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(result.error!.message).toBe('Este local no recibe pedidos anticipados');
  });
});
