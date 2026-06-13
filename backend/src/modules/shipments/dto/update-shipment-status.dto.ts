import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { ShipmentStatus } from '../../../../generated/prisma/client';

export class UpdateShipmentStatusDto {
  @ApiProperty({ enum: ShipmentStatus, description: 'Novo status do envio.' })
  @IsEnum(ShipmentStatus, { message: 'Status inválido.' })
  status: ShipmentStatus;

  @ApiPropertyOptional({
    description:
      'Id do motorista responsável pelo transporte (define/atualiza o transportador).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista (transportador) inválido.' })
  transporterId?: string;

  @ApiPropertyOptional({
    description:
      'Observação sobre a mudança de status, registrada na timeline.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
