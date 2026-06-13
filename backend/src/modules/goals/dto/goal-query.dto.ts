import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';

import { GoalStatus, GoalType } from '../../../../generated/prisma/client';

export class GoalQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar pelo id do motorista.' })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo id do veículo.' })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({
    example: '2026-06',
    description: 'Filtrar pelo período de referência (formato AAAA-MM).',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Período inválido. Use o formato AAAA-MM.',
  })
  period?: string;

  @ApiPropertyOptional({
    enum: GoalType,
    description: 'Filtrar pelo tipo de meta.',
  })
  @IsOptional()
  @IsEnum(GoalType, { message: 'Tipo de meta inválido.' })
  type?: GoalType;

  @ApiPropertyOptional({
    enum: GoalStatus,
    description: 'Filtrar pelo status da meta.',
  })
  @IsOptional()
  @IsEnum(GoalStatus, { message: 'Status de meta inválido.' })
  status?: GoalStatus;
}
