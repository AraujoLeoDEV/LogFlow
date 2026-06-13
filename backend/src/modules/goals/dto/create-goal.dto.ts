import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Matches, Min } from 'class-validator';

import { GoalType } from '../../../../generated/prisma/client';

export class CreateGoalDto {
  @ApiPropertyOptional({
    description:
      'Id do motorista da meta. Informar motorista ou veículo (não ambos).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional({
    description:
      'Id do veículo da meta. Informar motorista ou veículo (não ambos).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiProperty({ enum: GoalType, description: 'Tipo da meta.' })
  @IsEnum(GoalType, { message: 'Tipo de meta inválido.' })
  type: GoalType;

  @ApiProperty({
    example: '2026-06',
    description: 'Período de referência da meta (formato AAAA-MM).',
  })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Período inválido. Use o formato AAAA-MM.',
  })
  period: string;

  @ApiProperty({
    example: 10,
    description:
      'Meta de consumo médio (km/L) a ser atingida ou superada no período.',
  })
  @Min(0.001, { message: 'A meta de consumo deve ser maior que zero.' })
  targetValue: number;
}
