import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { TripStatus } from '../../../../generated/prisma/client';

export class TripQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar pelo id do veículo.' })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo id do motorista.' })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo id da rota.' })
  @IsOptional()
  @IsUUID('all', { message: 'Rota inválida.' })
  routeId?: string;

  @ApiPropertyOptional({
    description: 'Data inicial do período (início da viagem a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Data final do período (início da viagem até).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;

  @ApiPropertyOptional({
    enum: TripStatus,
    description: 'Filtrar pelo status da viagem.',
  })
  @IsOptional()
  @IsEnum(TripStatus, { message: 'Status inválido.' })
  status?: TripStatus;
}
