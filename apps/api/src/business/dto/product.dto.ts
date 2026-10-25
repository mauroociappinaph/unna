import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Money, ProductStatus, ProductType } from '@unna/domain';

type Currency = Money['currency'];

export const PRODUCT_TYPES = ['simple', 'composite', 'combo'] as const satisfies readonly ProductType[];
export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const satisfies readonly ProductStatus[];
export const CURRENCIES = [
  'ARS', 'USD', 'EUR', 'BRL', 'MXN', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'PYG', 'VES',
] as const satisfies readonly Currency[];

class ProductComponentDto {
  @IsUUID() productId!: string;
  @IsNumber() @IsPositive() quantity!: number;
}

export class CreateProductDto {
  @IsUUID() categoryId!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsIn(PRODUCT_TYPES) type!: ProductType;
  @IsOptional() @IsIn(PRODUCT_STATUSES) status?: ProductStatus;
  @IsInt() @Min(0) basePrice!: number;
  @IsOptional() @IsIn(CURRENCIES) currency?: Currency;
  @IsOptional() @IsInt() @Min(0) costPrice?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @IsString() @MaxLength(50) sku?: string;
  @IsOptional() @IsString() @MaxLength(100) barcode?: string;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) modifierGroupIds?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductComponentDto) components?: ProductComponentDto[];
  @IsOptional() @IsInt() @Min(0) preparationTimeMinutes?: number;
  @IsOptional() @IsInt() @Min(0) calories?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) allergens?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() isFavorite?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

/** GET products/top-sellers: period in days (1-30, default 7) and how many products (1-20, default 8). */
export class TopSellersQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(30) days?: number;
  @IsOptional() @IsInt() @Min(1) @Max(20) limit?: number;
}
