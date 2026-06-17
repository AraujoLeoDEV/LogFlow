import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { ShipmentItemUnit } from '../../../../generated/prisma/client';

export class ShipmentItemDto {
  @ApiProperty({ description: 'Descrição do item enviado.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a descrição do item.' })
  description: string;

  @ApiPropertyOptional({ description: 'Categoria do item.' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Quantidade do item.', example: 1 })
  @IsNumber({}, { message: 'A quantidade deve ser um número.' })
  @Min(0.01, { message: 'A quantidade deve ser maior que zero.' })
  quantity: number;

  @ApiProperty({
    enum: ShipmentItemUnit,
    description: 'Unidade de medida do item.',
    default: ShipmentItemUnit.UND,
  })
  @IsEnum(ShipmentItemUnit, { message: 'Unidade de medida inválida.' })
  unit: ShipmentItemUnit;

  @ApiPropertyOptional({ description: 'Observação sobre o item.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
