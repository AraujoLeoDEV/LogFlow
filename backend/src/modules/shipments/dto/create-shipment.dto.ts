import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { ShipmentItemDto } from './shipment-item.dto';

export class CreateShipmentDto {
  @ApiProperty({ description: 'Id da unidade de destino do envio.' })
  @IsUUID('all', { message: 'Unidade de destino inválida.' })
  destinationUnitId: string;

  @ApiProperty({
    type: [ShipmentItemDto],
    description: 'Itens enviados (descrição e quantidade).',
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
}
