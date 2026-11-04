import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { StockMovementType } from '@unna/domain';
import { INVALID_DATE } from '../../common/date-query';
import { PageQuery } from '../../common/pagination';

/** Exit movement types; 'in' only goes through the entry endpoint. */
export const STOCK_OUT_TYPES = [
  'out', 'adjustment', 'waste', 'transfer', 'sale', 'return',
] as const satisfies readonly StockMovementType[];

export class InitializeStockDto {
  @IsInt() @Min(0) initialQuantity!: number;
  @IsOptional() @IsInt() @Min(0) minThreshold?: number;
  @IsOptional() @IsInt() @Min(0) reorderPoint?: number;
  @IsOptional() @IsInt() @Min(1) reorderQuantity?: number;
}

export class AddStockDto {
  @IsInt() @Min(1) quantity!: number;
  @IsString() @MaxLength(200) reason!: string;
  @IsOptional() @IsString() @MaxLength(100) referenceId?: string;
  @IsOptional() @IsString() @MaxLength(50) referenceType?: string;
  @IsOptional() @IsInt() @Min(0) unitCost?: number;
  @IsOptional() @IsInt() @Min(0) totalCost?: number;
}

export class RemoveStockDto extends AddStockDto {
  @IsOptional() @IsIn(STOCK_OUT_TYPES) type?: StockMovementType;
}

export class RecordCountDto {
  @IsInt() @Min(0) countedQuantity!: number;
}

export class AdjustThresholdsDto {
  @IsOptional() @IsInt() @Min(0) minThreshold?: number;
  @IsOptional() @IsInt() @Min(0) maxThreshold?: number;
  @IsOptional() @IsInt() @Min(0) reorderPoint?: number;
  @IsOptional() @IsInt() @Min(1) reorderQuantity?: number;
}

/** Filters of the movements list; each one applies on its own or together (S17). */
export class ListStockMovementsQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100) productId?: string;
  @IsOptional() @IsDateString({}, { message: INVALID_DATE }) from?: string;
  @IsOptional() @IsDateString({}, { message: INVALID_DATE }) to?: string;
}
