import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class ModifierOptionDto {
  @IsString() @MaxLength(80) name!: string;
  // Negative deltas are discounts (e.g. "sin queso"), as the domain allows.
  @IsOptional() @IsInt() priceDelta?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateModifierOptionDto extends PartialType(OmitType(ModifierOptionDto, ['displayOrder'] as const)) {}

export class CreateModifierGroupDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(0) minSelection?: number;
  @IsOptional() @IsInt() @Min(0) maxSelection?: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ModifierOptionDto) options?: ModifierOptionDto[];
}

export class UpdateModifierGroupDto extends PartialType(OmitType(CreateModifierGroupDto, ['displayOrder', 'options'] as const)) {}
