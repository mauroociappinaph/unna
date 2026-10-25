import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateCategoryDto, UpdateCategoryDto } from '../category.dto';
import { CreateProductDto, UpdateProductDto } from '../product.dto';
import { CreateModifierGroupDto, ModifierOptionDto, UpdateModifierGroupDto, UpdateModifierOptionDto } from '../modifier-group.dto';
import { CreatePriceListDto, PriceListEntryDto, UpdatePriceListDto, UpdatePriceListEntryDto } from '../price-list.dto';
import { AddStockDto, AdjustThresholdsDto, InitializeStockDto, RecordCountDto, RemoveStockDto } from '../stock.dto';
import { CategoryController, ModifierGroupController, PriceListController, ProductController, StockController } from '../../catalog.controller';

const UUID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';

/** Same transform + validation options as the global ValidationPipe in main.ts. */
async function validateBody(cls: new () => object, body: unknown): Promise<ValidationError[]> {
  const instance = plainToInstance(cls, body, { enableImplicitConversion: true });
  return validate(instance as object, { whitelist: true, forbidNonWhitelisted: true });
}

/** Flattens nested errors into "path: message" lines, like the pipe's response messages. */
function messages(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((m) => `${path}: ${m}`);
    return [...own, ...messages(e.children ?? [], path)];
  });
}

describe('catalog DTOs', () => {
  describe('valid bodies pass', () => {
    it.each<[string, new () => object, unknown]>([
      ['create category', CreateCategoryDto, { name: 'Pizzas', description: 'Al horno', type: 'plato', displayOrder: 1, isActive: true, parentId: UUID, imageUrl: '/uploads/x.png' }],
      ['create category (required only)', CreateCategoryDto, { name: 'Pizzas', type: 'bebida' }],
      ['update category', UpdateCategoryDto, { name: 'Pastas' }],
      ['update category (empty)', UpdateCategoryDto, {}],
      ['create product', CreateProductDto, {
        categoryId: UUID, name: 'Muzza', description: 'Clásica', type: 'combo', status: 'active', basePrice: 150000,
        currency: 'ARS', costPrice: 50000, taxRate: 10.5, sku: 'MUZ-1', barcode: '779', displayOrder: 0, isActive: true,
        images: ['/uploads/products/a.png'], modifierGroupIds: [UUID], components: [{ productId: UUID, quantity: 2 }],
        preparationTimeMinutes: 15, calories: 800, allergens: ['gluten'], tags: ['veggie'],
      }],
      ['create product (required only)', CreateProductDto, { categoryId: UUID, name: 'Muzza', type: 'simple', basePrice: 0 }],
      ['update product', UpdateProductDto, { basePrice: 1000, tags: [] }],
      ['create modifier group', CreateModifierGroupDto, {
        name: 'Extras', description: 'x', minSelection: 0, maxSelection: 2, isRequired: false, displayOrder: 1, isActive: true,
        options: [{ name: 'Queso', priceDelta: 500, isDefault: false, displayOrder: 0, isActive: true }, { name: 'Sin sal' }],
      }],
      ['update modifier group', UpdateModifierGroupDto, { name: 'Salsas', minSelection: 1, maxSelection: 1, isRequired: true, isActive: false }],
      ['add option', ModifierOptionDto, { name: 'Bacon', priceDelta: 800 }],
      ['discount option', ModifierOptionDto, { name: 'Sin queso', priceDelta: -500 }],
      ['update option', UpdateModifierOptionDto, { priceDelta: 0, isDefault: true }],
      ['create price list', CreatePriceListDto, {
        name: 'Delivery', description: 'x', type: 'happy-hour', isDefault: false, isActive: true,
        validFrom: '2026-01-01', validTo: '2026-12-31T23:59:59.000Z', validDays: [0, 6], validFromTime: '18:00', validToTime: '20:30',
        entries: [{ productId: UUID, price: 120000, costPrice: 40000, isActive: true }],
      }],
      ['create price list (required only)', CreatePriceListDto, { name: 'Base', type: 'standard' }],
      ['update price list', UpdatePriceListDto, { validDays: [1, 2, 3], validFromTime: '09:00' }],
      ['add entry', PriceListEntryDto, { productId: UUID, price: 100 }],
      ['update entry', UpdatePriceListEntryDto, { price: 200, isActive: false }],
      ['initialize stock', InitializeStockDto, { initialQuantity: 0, minThreshold: 5, reorderPoint: 10, reorderQuantity: 20 }],
      ['stock in', AddStockDto, { quantity: 10, reason: 'Compra', referenceId: 'F-1', referenceType: 'invoice', unitCost: 100, totalCost: 1000 }],
      ['stock out without type', RemoveStockDto, { quantity: 1, reason: 'Rotura' }],
      ['stock out with type', RemoveStockDto, { quantity: 1, reason: 'Merma', type: 'waste' }],
      ['count', RecordCountDto, { countedQuantity: 0 }],
      ['thresholds', AdjustThresholdsDto, { minThreshold: 1, maxThreshold: 100, reorderPoint: 5, reorderQuantity: 10 }],
    ])('%s', async (_name, cls, body) => {
      expect(messages(await validateBody(cls, body))).toEqual([]);
    });
  });

  it('rejects a modifier group whose options is not an array with a validation message', async () => {
    const result = messages(await validateBody(CreateModifierGroupDto, { name: 'Extras', options: 'x' }));
    expect(result).toContain('options: options must be an array');
    expect(result.join('\n')).not.toContain('is not a function');
  });

  it('validates nested modifier options', async () => {
    const result = messages(await validateBody(CreateModifierGroupDto, { name: 'Extras', options: [{ priceDelta: 10 }] }));
    expect(result).toContain('options.0.name: name must be a string');
  });

  it.each<[string, new () => object, unknown, string]>([
    ['category', CreateCategoryDto, { name: 'Pizzas', type: 'plato', hacker: true }, 'hacker'],
    ['product update', UpdateProductDto, { ownerId: UUID }, 'ownerId'],
    ['nested price list entry', CreatePriceListDto, { name: 'B', type: 'standard', entries: [{ productId: UUID, price: 1, listId: UUID }] }, 'entries.0.listId'],
    ['modifier group update (no options)', UpdateModifierGroupDto, { options: [] }, 'options'],
    ['stock count', RecordCountDto, { countedQuantity: 1, businessId: UUID }, 'businessId'],
  ])('rejects a non-whitelisted field (%s)', async (_name, cls, body, path) => {
    const result = messages(await validateBody(cls, body));
    expect(result).toContain(`${path}: property ${path.split('.').pop()} should not exist`);
  });

  it.each<[string, new () => object, unknown, string]>([
    ['negative product price', CreateProductDto, { categoryId: UUID, name: 'M', type: 'simple', basePrice: -1 }, 'basePrice: basePrice must not be less than 0'],
    ['float product price', CreateProductDto, { categoryId: UUID, name: 'M', type: 'simple', basePrice: 10.5 }, 'basePrice: basePrice must be an integer number'],
    ['float price update', UpdateProductDto, { costPrice: 0.99 }, 'costPrice: costPrice must be an integer number'],
    ['negative entry price', PriceListEntryDto, { productId: UUID, price: -100 }, 'price: price must not be less than 0'],
    ['float nested entry price', CreatePriceListDto, { name: 'B', type: 'standard', entries: [{ productId: UUID, price: 1.5 }] }, 'entries.0.price: price must be an integer number'],
    ['float option delta', ModifierOptionDto, { name: 'Queso', priceDelta: -5.5 }, 'priceDelta: priceDelta must be an integer number'],
    ['float unit cost', AddStockDto, { quantity: 1, reason: 'Compra', unitCost: 1.2 }, 'unitCost: unitCost must be an integer number'],
  ])('rejects a %s', async (_name, cls, body, expected) => {
    expect(messages(await validateBody(cls, body))).toContain(expected);
  });

  it.each<[string, new () => object, unknown, string]>([
    ['category type', CreateCategoryDto, { name: 'P', type: 'sushi' }, 'type'],
    ['product status', UpdateProductDto, { status: 'deleted' }, 'status'],
    ['currency', UpdateProductDto, { currency: 'XXX' }, 'currency'],
    ['price list type', CreatePriceListDto, { name: 'B', type: 'vip' }, 'type'],
    ['stock out type', RemoveStockDto, { quantity: 1, reason: 'x', type: 'in' }, 'type'],
  ])('rejects an unknown %s', async (_name, cls, body, property) => {
    const result = messages(await validateBody(cls, body));
    expect(result.some((m) => m.startsWith(`${property}: ${property} must be one of the following values`))).toBe(true);
  });

  it.each<[string, new () => object, unknown, string]>([
    ['missing category name', CreateCategoryDto, { type: 'plato' }, 'name: name must be a string'],
    ['non-positive stock in quantity', AddStockDto, { quantity: 0, reason: 'x' }, 'quantity: quantity must not be less than 1'],
    ['missing stock reason', RemoveStockDto, { quantity: 1 }, 'reason: reason must be a string'],
    ['day out of range', UpdatePriceListDto, { validDays: [7] }, 'validDays: each value in validDays must not be greater than 6'],
    ['malformed time', UpdatePriceListDto, { validFromTime: '25:00' }, 'validFromTime: validFromTime must be a time in HH:mm format'],
    ['non-uuid category id', CreateProductDto, { categoryId: 'abc', name: 'M', type: 'simple', basePrice: 1 }, 'categoryId: categoryId must be a UUID'],
  ])('rejects a %s', async (_name, cls, body, expected) => {
    expect(messages(await validateBody(cls, body))).toContain(expected);
  });

  describe('global ValidationPipe (main.ts options)', () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    });

    it('answers the malformed modifier group with a validation message instead of an internal error', async () => {
      const result = pipe.transform({ name: 'Extras', options: 'x' }, { type: 'body', metatype: CreateModifierGroupDto });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toMatchObject({ response: { message: expect.arrayContaining(['options must be an array']) } });
    });

    it('rejects a non-whitelisted field', async () => {
      await expect(
        pipe.transform({ countedQuantity: 1, extra: 1 }, { type: 'body', metatype: RecordCountDto }),
      ).rejects.toMatchObject({ response: { message: ['property extra should not exist'] } });
    });
  });

  it.each<[string, object, string, new () => object]>([
    ['category create', CategoryController.prototype, 'create', CreateCategoryDto],
    ['category update', CategoryController.prototype, 'update', UpdateCategoryDto],
    ['product create', ProductController.prototype, 'create', CreateProductDto],
    ['product update', ProductController.prototype, 'update', UpdateProductDto],
    ['modifier group create', ModifierGroupController.prototype, 'create', CreateModifierGroupDto],
    ['modifier group update', ModifierGroupController.prototype, 'update', UpdateModifierGroupDto],
    ['option add', ModifierGroupController.prototype, 'addOption', ModifierOptionDto],
    ['option update', ModifierGroupController.prototype, 'updateOption', UpdateModifierOptionDto],
    ['price list create', PriceListController.prototype, 'create', CreatePriceListDto],
    ['price list update', PriceListController.prototype, 'update', UpdatePriceListDto],
    ['entry add', PriceListController.prototype, 'addEntry', PriceListEntryDto],
    ['entry update', PriceListController.prototype, 'updateEntry', UpdatePriceListEntryDto],
    ['stock initialize', StockController.prototype, 'initialize', InitializeStockDto],
    ['stock in', StockController.prototype, 'addStock', AddStockDto],
    ['stock out', StockController.prototype, 'removeStock', RemoveStockDto],
    ['stock count', StockController.prototype, 'recordCount', RecordCountDto],
    ['stock thresholds', StockController.prototype, 'adjustThresholds', AdjustThresholdsDto],
  ])('the %s body is typed with its DTO so the pipe validates it', (_name, prototype, method, dto) => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', prototype, method) as unknown[];
    expect(paramTypes).toContain(dto);
  });
});
