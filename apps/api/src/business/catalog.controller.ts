import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, ParseFilePipe, FileTypeValidator, MaxFileSizeValidator } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

const UPLOAD_DIR = './uploads/products';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const IMAGE_MIME = /^image\/(png|jpeg|webp|gif)$/;
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { CategoryUseCase } from './use-cases/product-catalog.use-case';
import { ProductUseCase } from './use-cases/product-catalog.use-case';
import { ModifierGroupUseCase } from './use-cases/product-catalog.use-case';
import { PriceListUseCase } from './use-cases/product-catalog.use-case';
import { StockUseCase } from './use-cases/product-catalog.use-case';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreateModifierGroupDto, ModifierOptionDto, UpdateModifierGroupDto, UpdateModifierOptionDto } from './dto/modifier-group.dto';
import { CreatePriceListDto, PriceListEntryDto, UpdatePriceListDto, UpdatePriceListEntryDto } from './dto/price-list.dto';
import { AddStockDto, AdjustThresholdsDto, InitializeStockDto, RecordCountDto, RemoveStockDto } from './dto/stock.dto';
import type { AuthenticatedRequest } from './authenticated-request';

@ApiTags('Categorías')
@Controller('businesses/:businessId/categories')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryUseCase: CategoryUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva categoría' })
  async create(
    @Param('businessId') businessId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ) {
    return unwrap(this.categoryUseCase.create({ ...dto, businessId, ownerId: req.user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías' })
  async list(
    @Param('businessId') businessId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return unwrap(this.categoryUseCase.list(businessId, activeOnly === 'true'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  async getById(@Param('businessId') businessId: string, @Param('id') id: string) {
    return unwrap(this.categoryUseCase.getById(id, businessId));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar categoría' })
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateCategoryDto,
  ) {
    return unwrap(this.categoryUseCase.update({ ...dto, id, businessId, ownerId: req.user.sub }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  async delete(@Param('businessId') businessId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await unwrap(this.categoryUseCase.delete({ id, businessId, ownerId: req.user.sub }));
    return { ok: true };
  }
}

@ApiTags('Productos')
@Controller('businesses/:businessId/products')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class ProductController {
  constructor(private readonly productUseCase: ProductUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo producto' })
  async create(
    @Param('businessId') businessId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateProductDto,
  ) {
    return unwrap(this.productUseCase.create({ ...dto, businessId, ownerId: req.user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos' })
  async list(
    @Param('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return unwrap(this.productUseCase.list(businessId, {
      status,
      categoryId,
      activeOnly: activeOnly === 'true',
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  async getById(@Param('businessId') businessId: string, @Param('id') id: string) {
    return unwrap(this.productUseCase.getById(id, businessId));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar producto' })
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateProductDto,
  ) {
    return unwrap(this.productUseCase.update({ ...dto, id, businessId, ownerId: req.user.sub }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar producto' })
  async delete(@Param('businessId') businessId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await unwrap(this.productUseCase.delete({ id, businessId, ownerId: req.user.sub }));
    return { ok: true };
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Subir imagen de producto' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    // Kept in memory so FileTypeValidator can check magic numbers; written only once accepted.
    storage: memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES },
    fileFilter: (req, file, cb) => cb(null, IMAGE_MIME.test(file.mimetype)),
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  async uploadImage(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
          new FileTypeValidator({ fileType: IMAGE_MIME }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await unwrap(this.productUseCase.getById(id, businessId));
    // This would typically upload to S3/Cloudinary and return URL
    // For now, store locally and return its path
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${IMAGE_EXTENSIONS[file.mimetype]}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    return { url: `/uploads/products/${filename}` };
  }
}

@ApiTags('Grupos de Modificadores')
@Controller('businesses/:businessId/modifier-groups')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class ModifierGroupController {
  constructor(private readonly groupUseCase: ModifierGroupUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear grupo de modificadores' })
  async create(
    @Param('businessId') businessId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateModifierGroupDto,
  ) {
    return unwrap(this.groupUseCase.create({ ...dto, businessId, ownerId: req.user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar grupos de modificadores' })
  async list(
    @Param('businessId') businessId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return unwrap(this.groupUseCase.list(businessId, activeOnly === 'true'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener grupo por ID' })
  async getById(@Param('businessId') businessId: string, @Param('id') id: string) {
    return unwrap(this.groupUseCase.getById(id, businessId));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar grupo de modificadores' })
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateModifierGroupDto,
  ) {
    return unwrap(this.groupUseCase.update({ ...dto, id, businessId, ownerId: req.user.sub }));
  }

  @Post(':id/options')
  @ApiOperation({ summary: 'Agregar opción a grupo' })
  async addOption(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ModifierOptionDto,
  ) {
    return unwrap(this.groupUseCase.addOption({ groupId: id, businessId, ownerId: req.user.sub, option: dto }));
  }

  @Put(':id/options/:optionId')
  @ApiOperation({ summary: 'Actualizar opción' })
  async updateOption(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateModifierOptionDto,
  ) {
    return unwrap(this.groupUseCase.updateOption({ groupId: id, businessId, ownerId: req.user.sub, optionId, updates: dto }));
  }

  @Delete(':id/options/:optionId')
  @ApiOperation({ summary: 'Eliminar opción' })
  async deleteOption(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await unwrap(this.groupUseCase.deleteOption({ groupId: id, businessId, ownerId: req.user.sub, optionId }));
    return { ok: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar grupo de modificadores' })
  async delete(@Param('businessId') businessId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await unwrap(this.groupUseCase.delete({ id, businessId, ownerId: req.user.sub }));
    return { ok: true };
  }
}

@ApiTags('Listas de Precios')
@Controller('businesses/:businessId/price-lists')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class PriceListController {
  constructor(private readonly listUseCase: PriceListUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Crear lista de precios' })
  async create(
    @Param('businessId') businessId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePriceListDto,
  ) {
    return unwrap(this.listUseCase.create({ ...dto, businessId, ownerId: req.user.sub }));
  }

  @Get()
  @ApiOperation({ summary: 'Listar listas de precios' })
  async list(
    @Param('businessId') businessId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return unwrap(this.listUseCase.list(businessId, activeOnly === 'true'));
  }

  @Get('default')
  @ApiOperation({ summary: 'Obtener lista de precios por defecto' })
  async getDefault(@Param('businessId') businessId: string) {
    return unwrap(this.listUseCase.getDefault(businessId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener lista por ID' })
  async getById(@Param('businessId') businessId: string, @Param('id') id: string) {
    return unwrap(this.listUseCase.getById(id, businessId));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar lista de precios' })
  async update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdatePriceListDto,
  ) {
    return unwrap(this.listUseCase.update({ ...dto, id, businessId, ownerId: req.user.sub }));
  }

  @Post(':id/entries')
  @ApiOperation({ summary: 'Agregar producto a lista de precios' })
  async addEntry(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: PriceListEntryDto,
  ) {
    return unwrap(this.listUseCase.addEntry({ listId: id, businessId, ownerId: req.user.sub, ...dto }));
  }

  @Put(':id/entries/:productId')
  @ApiOperation({ summary: 'Actualizar entrada de lista de precios' })
  async updateEntry(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdatePriceListEntryDto,
  ) {
    return unwrap(this.listUseCase.updateEntry({ listId: id, businessId, ownerId: req.user.sub, productId, ...dto }));
  }

  @Delete(':id/entries/:productId')
  @ApiOperation({ summary: 'Eliminar producto de lista de precios' })
  async removeEntry(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await unwrap(this.listUseCase.removeEntry({ listId: id, businessId, ownerId: req.user.sub, productId }));
    return { ok: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar lista de precios' })
  async delete(@Param('businessId') businessId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await unwrap(this.listUseCase.delete({ id, businessId, ownerId: req.user.sub }));
    return { ok: true };
  }
}

@ApiTags('Stock / Inventario')
@Controller('businesses/:businessId/stock')
@UseGuards(JwtAuthGuard, BusinessOwnerGuard)
@ApiBearerAuth()
export class StockController {
  constructor(private readonly stockUseCase: StockUseCase) {}

  @Post('initialize/:productId')
  @ApiOperation({ summary: 'Inicializar stock de un producto' })
  async initialize(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: InitializeStockDto,
  ) {
    return unwrap(this.stockUseCase.initializeStock({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Get('levels')
  @ApiOperation({ summary: 'Listar niveles de stock' })
  async listLevels(@Param('businessId') businessId: string) {
    return unwrap(this.stockUseCase.listByBusiness(businessId));
  }

  @Get('low')
  @ApiOperation({ summary: 'Obtener productos con stock bajo' })
  async getLowStock(@Param('businessId') businessId: string) {
    return unwrap(this.stockUseCase.getLowStock(businessId));
  }

  @Get('movements')
  @ApiOperation({ summary: 'Listar movimientos de stock' })
  async listMovements(
    @Param('businessId') businessId: string,
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return unwrap(this.stockUseCase.listMovements(businessId, {
      productId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    }));
  }

  @Get('level/:productId')
  @ApiOperation({ summary: 'Obtener nivel de stock de un producto' })
  async getLevel(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return unwrap(this.stockUseCase.getLevel(productId, businessId));
  }

  @Post('in/:productId')
  @ApiOperation({ summary: 'Registrar entrada de stock' })
  async addStock(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddStockDto,
  ) {
    return unwrap(this.stockUseCase.addStock({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Post('out/:productId')
  @ApiOperation({ summary: 'Registrar salida de stock' })
  async removeStock(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: RemoveStockDto,
  ) {
    return unwrap(this.stockUseCase.removeStock({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Post('count/:productId')
  @ApiOperation({ summary: 'Registrar conteo físico' })
  async recordCount(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: RecordCountDto,
  ) {
    return unwrap(this.stockUseCase.recordCount({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }

  @Put('thresholds/:productId')
  @ApiOperation({ summary: 'Ajustar umbrales de stock' })
  async adjustThresholds(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AdjustThresholdsDto,
  ) {
    return unwrap(this.stockUseCase.adjustThresholds({ ...dto, productId, businessId, ownerId: req.user.sub }));
  }
}