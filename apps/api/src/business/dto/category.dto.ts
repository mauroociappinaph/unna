import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export const CATEGORY_TYPES = ['plato', 'bebida', 'postre', 'extra', 'combo'] as const;

export class CreateCategoryDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsIn(CATEGORY_TYPES) type!: (typeof CATEGORY_TYPES)[number];
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsString() imageUrl?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
