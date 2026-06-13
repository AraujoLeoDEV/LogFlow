import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import {
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
} from '../../../../generated/prisma/client';

export class CreateIncidentDto {
  @ApiProperty({ description: 'Id do veículo envolvido na ocorrência.' })
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId: string;

  @ApiPropertyOptional({
    description:
      'Id do motorista envolvido. Obrigatório para ADMIN/COORDENACAO; motoristas usam o próprio registro automaticamente.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiProperty({
    enum: IncidentCategory,
    description: 'Categoria da ocorrência.',
  })
  @IsEnum(IncidentCategory, { message: 'Categoria de ocorrência inválida.' })
  category: IncidentCategory;

  @ApiProperty({ enum: IncidentType, description: 'Tipo da ocorrência.' })
  @IsEnum(IncidentType, { message: 'Tipo de ocorrência inválido.' })
  type: IncidentType;

  @ApiProperty({
    enum: IncidentSeverity,
    description: 'Gravidade da ocorrência.',
  })
  @IsEnum(IncidentSeverity, { message: 'Gravidade inválida.' })
  severity: IncidentSeverity;

  @ApiProperty({ description: 'Responsável pela ocorrência.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o responsável.' })
  responsible: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Custo associado à ocorrência, se houver (ex: multa).',
  })
  @IsOptional()
  @Min(0, { message: 'O custo não pode ser negativo.' })
  cost?: number;

  @ApiProperty({ description: 'Observações sobre a ocorrência.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe as observações da ocorrência.' })
  observations: string;

  @ApiProperty({ description: 'Data/hora em que a ocorrência aconteceu.' })
  @IsDateString({}, { message: 'Data da ocorrência inválida.' })
  date: string;
}
