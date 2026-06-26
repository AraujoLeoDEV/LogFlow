import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { ShipmentPriority } from '../../../../generated/prisma/client';
import { ShipmentItemDto } from './shipment-item.dto';

export class CreateShipmentDto {
  @ApiPropertyOptional({ description: 'Id da unidade de origem do envio.' })
  @IsOptional()
  @IsUUID('all', { message: 'Unidade de origem inválida.' })
  originUnitId?: string;

  @ApiProperty({ description: 'Id da unidade de destino do envio.' })
  @IsUUID('all', { message: 'Unidade de destino inválida.' })
  destinationUnitId: string;

  @ApiPropertyOptional({
    description: 'Data/hora do envio (default: agora).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data do envio inválida.' })
  shippedAt?: string;

  @ApiProperty({
    type: [ShipmentItemDto],
    description: 'Itens enviados (descrição, categoria, quantidade e unidade).',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um item no envio.' })
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items: ShipmentItemDto[];

  @ApiPropertyOptional({
    description: 'Id do motorista responsável pelo transporte, se já definido.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista (transportador) inválido.' })
  transporterId?: string;

  @ApiPropertyOptional({ description: 'Observações sobre o envio.' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({
    enum: ShipmentPriority,
    description: 'Criticidade do envio (default: MODERADO).',
  })
  @IsOptional()
  @IsEnum(ShipmentPriority, { message: 'Criticidade inválida.' })
  priority?: ShipmentPriority;
}
