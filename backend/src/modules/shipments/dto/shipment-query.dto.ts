import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { ShipmentStatus } from '../../../../generated/prisma/client';

export class ShipmentQueryDto {
  @ApiPropertyOptional({
    enum: ShipmentStatus,
    description: 'Filtrar pelo status.',
  })
  @IsOptional()
  @IsEnum(ShipmentStatus, { message: 'Status inválido.' })
  status?: ShipmentStatus;

  @ApiPropertyOptional({ description: 'Filtrar pela unidade de destino.' })
  @IsOptional()
  @IsUUID('all', { message: 'Unidade de destino inválida.' })
  destinationUnitId?: string;

  @ApiPropertyOptional({
    description: 'Data inicial do período (criado a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({ description: 'Data final do período (criado até).' })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;
}
