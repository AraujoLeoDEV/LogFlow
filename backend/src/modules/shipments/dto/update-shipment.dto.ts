import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { ShipmentPriority } from '../../../../generated/prisma/client';
import { ShipmentItemDto } from './shipment-item.dto';

export class UpdateShipmentDto {
  @ApiPropertyOptional({
    type: [ShipmentItemDto],
    description: 'Nova lista de itens do envio (substitui a lista atual).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um item no envio.' })
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items?: ShipmentItemDto[];

  @ApiPropertyOptional({ description: 'Observações sobre o envio.' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({
    description: 'Id do motorista responsável pelo transporte.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista (transportador) inválido.' })
  transporterId?: string;

  @ApiPropertyOptional({
    enum: ShipmentPriority,
    description: 'Criticidade do envio.',
  })
  @IsOptional()
  @IsEnum(ShipmentPriority, { message: 'Criticidade inválida.' })
  priority?: ShipmentPriority;
}
