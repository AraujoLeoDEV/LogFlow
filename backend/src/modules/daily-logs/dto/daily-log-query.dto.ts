import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { DailyLogStatus } from '../../../../generated/prisma/client';

export class DailyLogQueryDto {
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
    description: 'Data inicial do período (saída a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Data final do período (saída até).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;

  @ApiPropertyOptional({
    enum: DailyLogStatus,
    description: 'Filtrar pelo status do registro.',
  })
  @IsOptional()
  @IsEnum(DailyLogStatus, { message: 'Status inválido.' })
  status?: DailyLogStatus;
}
