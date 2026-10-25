import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, ParseFilePipe, FileTypeValidator, MaxFileSizeValidator } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../common/guards/business-owner.guard';
import { unwrap } from '../common/use-case-result';
import { ProductUseCase } from './use-cases/product.use-case';
import { CreateProductDto, TopSellersQueryDto, UpdateProductDto } from './dto/product.dto';
import type { AuthenticatedRequest } from './authenticated-request';

const UPLOAD_DIR = './uploads/products';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const IMAGE_MIME = /^image\/(png|jpeg|webp|gif)$/;

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

  // Declared before ':id' so "top-sellers" is not taken as a product id.
  @Get('top-sellers')
  @ApiOperation({ summary: 'Más vendidos de los últimos días (pedidos cobrados)' })
  async topSellers(@Param('businessId') businessId: string, @Query() query: TopSellersQueryDto) {
    return unwrap(this.productUseCase.topSellers(businessId, query));
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
