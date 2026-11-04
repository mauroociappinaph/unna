import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { PriceListType } from '@unna/domain';

export const PRICE_LIST_TYPES = [
  'standard', 'delivery', 'takeaway', 'happy-hour', 'event', 'custom',
] as const satisfies readonly PriceListType[];

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HH_MM_MESSAGE = '$property must be a time in HH:mm format';

export class PriceListEntryDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(0) price!: number;
  @IsOptional() @IsInt() @Min(0) costPrice?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePriceListEntryDto extends PartialType(OmitType(PriceListEntryDto, ['productId'] as const)) {}

export class CreatePriceListDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsIn(PRICE_LIST_TYPES) type!: PriceListType;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
  /** 0 = Sunday … 6 = Saturday. */
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) validDays?: number[];
  @IsOptional() @Matches(HH_MM, { message: HH_MM_MESSAGE }) validFromTime?: string;
  @IsOptional() @Matches(HH_MM, { message: HH_MM_MESSAGE }) validToTime?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PriceListEntryDto) entries?: PriceListEntryDto[];
}

export class UpdatePriceListDto extends PartialType(OmitType(CreatePriceListDto, ['type', 'entries'] as const)) {}
