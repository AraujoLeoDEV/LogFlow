import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import {
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
} from '../../../../generated/prisma/client';

export class IncidentQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar pelo id do veículo.' })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo id do motorista.' })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional({
    enum: IncidentCategory,
    description: 'Filtrar pela categoria.',
  })
  @IsOptional()
  @IsEnum(IncidentCategory, { message: 'Categoria de ocorrência inválida.' })
  category?: IncidentCategory;

  @ApiPropertyOptional({
    enum: IncidentType,
    description: 'Filtrar pelo tipo.',
  })
  @IsOptional()
  @IsEnum(IncidentType, { message: 'Tipo de ocorrência inválido.' })
  type?: IncidentType;

  @ApiPropertyOptional({
    enum: IncidentSeverity,
    description: 'Filtrar pela gravidade.',
  })
  @IsOptional()
  @IsEnum(IncidentSeverity, { message: 'Gravidade inválida.' })
  severity?: IncidentSeverity;

  @ApiPropertyOptional({
    description: 'Data inicial do período (ocorrida a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Data final do período (ocorrida até).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;
}
