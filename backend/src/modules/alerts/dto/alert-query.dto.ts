import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { AlertStatus } from '../../../../generated/prisma/client';

export class AlertQueryDto {
  @ApiPropertyOptional({
    enum: AlertStatus,
    description: 'Filtrar pelo status do alerta.',
  })
  @IsOptional()
  @IsEnum(AlertStatus, { message: 'Status de alerta inválido.' })
  status?: AlertStatus;
}
