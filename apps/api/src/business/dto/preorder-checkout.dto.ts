import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PREORDER_CUSTOMER_NAME_MAX, PREORDER_MAX_LINES, PREORDER_MAX_QUANTITY } from '@unna/domain';

// Body of POST /public/pedido/:slug/checkouts (S20). Prices never come from the client: unknown
// fields are rejected by the global ValidationPipe (forbidNonWhitelisted).

class PreorderModifierDto {
  @IsUUID() modifierGroupId!: string;
  @IsUUID() optionId!: string;
}

class PreorderLineDto {
  @IsUUID() productId!: string;
  @IsInt({ message: `La cantidad de cada producto debe ser de 1 a ${PREORDER_MAX_QUANTITY}` })
  @Min(1, { message: `La cantidad de cada producto debe ser de 1 a ${PREORDER_MAX_QUANTITY}` })
  @Max(PREORDER_MAX_QUANTITY, { message: `La cantidad de cada producto debe ser de 1 a ${PREORDER_MAX_QUANTITY}` })
  quantity!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PreorderModifierDto) modifiers?: PreorderModifierDto[];
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

export class CreatePreorderCheckoutDto {
  @IsString({ message: `Ingresá tu nombre (hasta ${PREORDER_CUSTOMER_NAME_MAX} caracteres)` })
  @Length(1, PREORDER_CUSTOMER_NAME_MAX, { message: `Ingresá tu nombre (hasta ${PREORDER_CUSTOMER_NAME_MAX} caracteres)` })
  customerName!: string;

  @IsArray({ message: `El pedido debe tener de 1 a ${PREORDER_MAX_LINES} productos` })
  @ArrayMinSize(1, { message: `El pedido debe tener de 1 a ${PREORDER_MAX_LINES} productos` })
  @ArrayMaxSize(PREORDER_MAX_LINES, { message: `El pedido debe tener de 1 a ${PREORDER_MAX_LINES} productos` })
  @ValidateNested({ each: true })
  @Type(() => PreorderLineDto)
  items!: PreorderLineDto[];
}
