import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogoPage from '@/app/dashboard/catalogo/page';
import { api } from '@/lib/api';
import type { Category, ModifierGroup, Product, StockLevel, StockMovement } from '@/lib/api-types';
import shapes from '../fixtures/api-shapes.json';

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/lib/api', () => ({
  api: {
    getBusinesses: jest.fn(),
    listCategories: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    listProducts: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
    listModifierGroups: jest.fn(),
    createModifierGroup: jest.fn(),
    addModifierOption: jest.fn(),
    removeModifierOption: jest.fn(),
    deleteModifierGroup: jest.fn(),
    listStockLevels: jest.fn(),
    listStockMovements: jest.fn(),
    initializeStock: jest.fn(),
    addStock: jest.fn(),
    removeStock: jest.fn(),
  },
}));

const mocked = api as jest.Mocked<typeof api>;

const category = shapes['GET categories'].body[0] as Category;
const drinks: Category = { ...category, id: 'cat-drinks', name: 'Bebidas', type: 'bebida' };
const group = shapes['GET modifier-groups'].body[0] as ModifierGroup;
const milanesa = shapes['GET products'].body[0] as Product;
const soda: Product = {
  ...milanesa,
  id: 'prod-soda',
  name: 'Gaseosa',
  categoryId: drinks.id,
  status: 'draft',
  basePrice: { amount: 80000, currency: 'ARS' },
  modifierGroupIds: [],
};
const level = shapes['GET stock/levels'].body[0] as StockLevel;
const movements = shapes['GET stock/movements'].body as StockMovement[];
const businessId = milanesa.businessId;
const business = {
  id: businessId,
  businessName: 'Resto',
  sucursales: [{ id: 'suc-1', name: 'Central', isMain: true, isActive: true }],
};

const validationError = (message: string | string[]) => ({ response: { status: 400, data: { message } } });

const openTab = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('tab', { name }));
};

describe('Catalogo page', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('auth_token', 'token');
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mocked.getBusinesses.mockResolvedValue([business]);
    mocked.listCategories.mockResolvedValue([category, drinks]);
    mocked.listProducts.mockResolvedValue([milanesa, soda]);
    mocked.listModifierGroups.mockResolvedValue([group]);
    mocked.listStockLevels.mockResolvedValue([level]);
    mocked.listStockMovements.mockResolvedValue(movements);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('redirects to /login without a token', async () => {
    localStorage.removeItem('auth_token');
    render(<CatalogoPage />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'));
    expect(mocked.getBusinesses).not.toHaveBeenCalled();
  });

  describe('Productos', () => {
    it('lists products with category, price, status and active flag', async () => {
      render(<CatalogoPage />);

      const row = await screen.findByRole('row', { name: /Milanesa/ });
      expect(within(row).getByText('Platos')).toBeInTheDocument();
      expect(within(row).getByText(/1\.500,00/)).toBeInTheDocument();
      expect(within(row).getByText('Activo')).toBeInTheDocument();
      expect(within(row).getByText('Sí')).toBeInTheDocument();
      const sodaRow = screen.getByRole('row', { name: /Gaseosa/ });
      expect(within(sodaRow).getByText('Bebidas')).toBeInTheDocument();
      expect(within(sodaRow).getByText('Borrador')).toBeInTheDocument();
      expect(mocked.listProducts).toHaveBeenCalledWith(businessId);
    });

    it('filters products by category', async () => {
      const user = userEvent.setup();
      render(<CatalogoPage />);
      await screen.findByRole('row', { name: /Milanesa/ });

      await user.selectOptions(screen.getByLabelText('Filtrar por categoría'), 'Bebidas');

      expect(screen.queryByRole('row', { name: /Milanesa/ })).not.toBeInTheDocument();
      expect(screen.getByRole('row', { name: /Gaseosa/ })).toBeInTheDocument();
    });

    it('creates a product sending the price in cents and the selected modifier groups', async () => {
      const user = userEvent.setup();
      mocked.createProduct.mockResolvedValue({ ...milanesa, id: 'prod-new', name: 'Napolitana' });
      render(<CatalogoPage />);
      await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(screen.getByRole('button', { name: 'Nuevo producto' }));
      await user.type(screen.getByLabelText('Nombre'), 'Napolitana');
      await user.selectOptions(screen.getByLabelText('Categoría'), 'Platos');
      await user.type(screen.getByLabelText('Precio ($)'), '1500');
      await user.click(screen.getByLabelText('Guarnición'));
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(mocked.createProduct).toHaveBeenCalledTimes(1));
      expect(mocked.createProduct).toHaveBeenCalledWith(businessId, {
        name: 'Napolitana',
        categoryId: category.id,
        type: 'simple',
        basePrice: 150000,
        taxRate: 21,
        status: 'active',
        modifierGroupIds: [group.id],
      });
      await waitFor(() => expect(mocked.listProducts).toHaveBeenCalledTimes(2));
    });

    it('shows the API validation errors when creating a product fails', async () => {
      const user = userEvent.setup();
      mocked.createProduct.mockRejectedValue(
        validationError(['name must be longer than or equal to 2 characters', 'basePrice must not be less than 0']),
      );
      render(<CatalogoPage />);
      await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(screen.getByRole('button', { name: 'Nuevo producto' }));
      await user.type(screen.getByLabelText('Nombre'), 'N');
      await user.selectOptions(screen.getByLabelText('Categoría'), 'Platos');
      await user.type(screen.getByLabelText('Precio ($)'), '10');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText(/name must be longer than or equal to 2 characters/)).toBeInTheDocument();
      expect(screen.getByText(/basePrice must not be less than 0/)).toBeInTheDocument();
    });

    it('edits a product prefilling the price in pesos', async () => {
      const user = userEvent.setup();
      mocked.updateProduct.mockResolvedValue(milanesa);
      render(<CatalogoPage />);
      const row = await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(within(row).getByRole('button', { name: 'Editar' }));
      const price = screen.getByLabelText('Precio ($)');
      expect(price).toHaveValue('1500');
      await user.clear(price);
      await user.type(price, '1750,50');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(mocked.updateProduct).toHaveBeenCalledTimes(1));
      expect(mocked.updateProduct).toHaveBeenCalledWith(businessId, milanesa.id, {
        name: 'Milanesa',
        categoryId: category.id,
        basePrice: 175050,
        taxRate: 21,
        status: 'active',
        modifierGroupIds: [group.id],
      });
    });

    it('archives and deletes a product after confirmation', async () => {
      const user = userEvent.setup();
      mocked.updateProduct.mockResolvedValue({ ...milanesa, status: 'archived' });
      mocked.deleteProduct.mockResolvedValue(undefined);
      render(<CatalogoPage />);
      const row = await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(within(row).getByRole('button', { name: 'Archivar' }));
      await waitFor(() => expect(mocked.updateProduct).toHaveBeenCalledWith(businessId, milanesa.id, { status: 'archived' }));

      await user.click(within(screen.getByRole('row', { name: /Gaseosa/ })).getByRole('button', { name: 'Eliminar' }));
      await waitFor(() => expect(mocked.deleteProduct).toHaveBeenCalledWith(businessId, soda.id));
      expect(confirmSpy).toHaveBeenCalledTimes(2);
    });

    it('does not delete a product when the confirmation is cancelled', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(false);
      render(<CatalogoPage />);
      const row = await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(within(row).getByRole('button', { name: 'Eliminar' }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(mocked.deleteProduct).not.toHaveBeenCalled();
    });
  });

  describe('Categorías', () => {
    it('lists categories with their Spanish type label', async () => {
      const user = userEvent.setup();
      render(<CatalogoPage />);
      await openTab(user, 'Categorías');

      const row = await screen.findByRole('row', { name: /Platos/ });
      expect(within(row).getByText('Plato')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /Bebidas/ })).getByText('Bebida')).toBeInTheDocument();
    });

    it('creates a category with the chosen type', async () => {
      const user = userEvent.setup();
      mocked.createCategory.mockResolvedValue({ ...category, id: 'cat-new', name: 'Postres', type: 'postre' });
      render(<CatalogoPage />);
      await openTab(user, 'Categorías');
      await screen.findByRole('row', { name: /Platos/ });

      await user.click(screen.getByRole('button', { name: 'Nueva categoría' }));
      await user.type(screen.getByLabelText('Nombre'), 'Postres');
      await user.selectOptions(screen.getByLabelText('Tipo'), 'Postre');
      await user.type(screen.getByLabelText('Descripción'), 'Dulces de la casa');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() =>
        expect(mocked.createCategory).toHaveBeenCalledWith(businessId, {
          name: 'Postres',
          type: 'postre',
          description: 'Dulces de la casa',
        }),
      );
    });

    it('shows the API error message when deleting a category fails', async () => {
      const user = userEvent.setup();
      mocked.deleteCategory.mockRejectedValue(validationError('La categoría tiene productos'));
      render(<CatalogoPage />);
      await openTab(user, 'Categorías');
      const row = await screen.findByRole('row', { name: /Platos/ });

      await user.click(within(row).getByRole('button', { name: 'Eliminar' }));

      expect(mocked.deleteCategory).toHaveBeenCalledWith(businessId, category.id);
      expect(await screen.findByText('La categoría tiene productos')).toBeInTheDocument();
    });
  });

  describe('Modificadores', () => {
    it('lists groups with their options and price deltas', async () => {
      const user = userEvent.setup();
      render(<CatalogoPage />);
      await openTab(user, 'Modificadores');

      const card = await screen.findByRole('article', { name: 'Guarnición' });
      expect(within(card).getByText('Papas')).toBeInTheDocument();
      expect(within(card).getByText(/200,00/)).toBeInTheDocument();
      expect(within(card).getByText('Ensalada')).toBeInTheDocument();
      expect(within(card).getByText(/Obligatorio/)).toBeInTheDocument();
    });

    it('creates a group whose negative option is sent as negative cents', async () => {
      const user = userEvent.setup();
      mocked.createModifierGroup.mockResolvedValue(group);
      render(<CatalogoPage />);
      await openTab(user, 'Modificadores');
      await screen.findByRole('article', { name: 'Guarnición' });

      await user.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
      await user.type(screen.getByLabelText('Nombre del grupo'), 'Sal');
      await user.clear(screen.getByLabelText('Mínimo'));
      await user.type(screen.getByLabelText('Mínimo'), '0');
      await user.clear(screen.getByLabelText('Máximo'));
      await user.type(screen.getByLabelText('Máximo'), '2');
      await user.type(screen.getByLabelText('Opción 1'), 'Sin sal');
      await user.type(screen.getByLabelText('Precio opción 1 ($)'), '-150');
      await user.click(screen.getByRole('button', { name: 'Agregar opción' }));
      await user.type(screen.getByLabelText('Opción 2'), 'Extra sal');
      await user.type(screen.getByLabelText('Precio opción 2 ($)'), '50');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() =>
        expect(mocked.createModifierGroup).toHaveBeenCalledWith(businessId, {
          name: 'Sal',
          minSelection: 0,
          maxSelection: 2,
          isRequired: false,
          options: [
            { name: 'Sin sal', priceDelta: -15000 },
            { name: 'Extra sal', priceDelta: 5000 },
          ],
        }),
      );
    });

    it('adds an option with a negative price to an existing group', async () => {
      const user = userEvent.setup();
      mocked.addModifierOption.mockResolvedValue(group);
      render(<CatalogoPage />);
      await openTab(user, 'Modificadores');
      const card = await screen.findByRole('article', { name: 'Guarnición' });

      await user.type(within(card).getByLabelText('Nueva opción'), 'Sin papas');
      await user.type(within(card).getByLabelText('Precio ($)'), '-100');
      await user.click(within(card).getByRole('button', { name: 'Agregar' }));

      await waitFor(() =>
        expect(mocked.addModifierOption).toHaveBeenCalledWith(businessId, group.id, { name: 'Sin papas', priceDelta: -10000 }),
      );
    });

    it('removes an option and deletes a group', async () => {
      const user = userEvent.setup();
      mocked.removeModifierOption.mockResolvedValue(undefined);
      mocked.deleteModifierGroup.mockResolvedValue(undefined);
      render(<CatalogoPage />);
      await openTab(user, 'Modificadores');
      const card = await screen.findByRole('article', { name: 'Guarnición' });

      await user.click(within(card).getByRole('button', { name: 'Quitar Papas' }));
      await waitFor(() =>
        expect(mocked.removeModifierOption).toHaveBeenCalledWith(businessId, group.id, group.options[0].id),
      );

      await user.click(within(card).getByRole('button', { name: 'Eliminar grupo' }));
      await waitFor(() => expect(mocked.deleteModifierGroup).toHaveBeenCalledWith(businessId, group.id));
    });
  });

  describe('Stock', () => {
    it('lists stock levels with product names', async () => {
      const user = userEvent.setup();
      render(<CatalogoPage />);
      await openTab(user, 'Stock');

      const row = await screen.findByRole('row', { name: /Milanesa/ });
      expect(within(row).getByText('55')).toBeInTheDocument();
      expect(screen.queryByRole('row', { name: /Gaseosa/ })).not.toBeInTheDocument();
    });

    it('removes stock with the chosen type', async () => {
      const user = userEvent.setup();
      mocked.removeStock.mockResolvedValue({ level, movement: movements[0] });
      render(<CatalogoPage />);
      await openTab(user, 'Stock');
      const row = await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(within(row).getByRole('button', { name: 'Egresar' }));
      await user.type(screen.getByLabelText('Cantidad'), '3');
      await user.type(screen.getByLabelText('Motivo'), 'Vencido');
      await user.selectOptions(screen.getByLabelText('Tipo de egreso'), 'Merma');
      await user.click(screen.getByRole('button', { name: 'Confirmar' }));

      await waitFor(() =>
        expect(mocked.removeStock).toHaveBeenCalledWith(businessId, milanesa.id, { quantity: 3, reason: 'Vencido', type: 'waste' }),
      );
    });

    it('adds stock to a product', async () => {
      const user = userEvent.setup();
      mocked.addStock.mockResolvedValue({ level, movement: movements[0] });
      render(<CatalogoPage />);
      await openTab(user, 'Stock');
      const row = await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(within(row).getByRole('button', { name: 'Ingresar' }));
      await user.type(screen.getByLabelText('Cantidad'), '5');
      await user.type(screen.getByLabelText('Motivo'), 'Compra');
      await user.click(screen.getByRole('button', { name: 'Confirmar' }));

      await waitFor(() =>
        expect(mocked.addStock).toHaveBeenCalledWith(businessId, milanesa.id, { quantity: 5, reason: 'Compra' }),
      );
    });

    it('initializes stock for a product without a level', async () => {
      const user = userEvent.setup();
      mocked.initializeStock.mockResolvedValue({ ...level, productId: soda.id });
      render(<CatalogoPage />);
      await openTab(user, 'Stock');
      await screen.findByRole('row', { name: /Milanesa/ });

      const product = screen.getByLabelText('Producto sin stock');
      expect(within(product).queryByRole('option', { name: 'Milanesa' })).not.toBeInTheDocument();
      await user.selectOptions(product, 'Gaseosa');
      await user.type(screen.getByLabelText('Cantidad inicial'), '24');
      await user.type(screen.getByLabelText('Stock mínimo'), '6');
      await user.click(screen.getByRole('button', { name: 'Inicializar' }));

      await waitFor(() =>
        expect(mocked.initializeStock).toHaveBeenCalledWith(businessId, soda.id, { initialQuantity: 24, minThreshold: 6 }),
      );
    });

    it('shows recent movements of a product', async () => {
      const user = userEvent.setup();
      render(<CatalogoPage />);
      await openTab(user, 'Stock');
      const row = await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(within(row).getByRole('button', { name: 'Movimientos' }));

      expect(await screen.findByText('Stock inicial')).toBeInTheDocument();
      expect(screen.getByText('Compra')).toBeInTheDocument();
      expect(mocked.listStockMovements).toHaveBeenCalledWith(businessId, milanesa.id);
    });

    it('shows the API error message when removing stock fails', async () => {
      const user = userEvent.setup();
      mocked.removeStock.mockRejectedValue(validationError('Stock insuficiente'));
      render(<CatalogoPage />);
      await openTab(user, 'Stock');
      const row = await screen.findByRole('row', { name: /Milanesa/ });

      await user.click(within(row).getByRole('button', { name: 'Egresar' }));
      await user.type(screen.getByLabelText('Cantidad'), '999');
      await user.type(screen.getByLabelText('Motivo'), 'Error');
      await user.click(screen.getByRole('button', { name: 'Confirmar' }));

      expect(await screen.findByText('Stock insuficiente')).toBeInTheDocument();
    });
  });
});
