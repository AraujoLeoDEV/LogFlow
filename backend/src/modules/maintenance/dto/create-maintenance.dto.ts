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
  MaintenanceCategory,
  MaintenanceType,
} from '../../../../generated/prisma/client';

export class CreateMaintenanceDto {
  @ApiProperty({ description: 'Id do veículo.' })
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId: string;

  @ApiProperty({
    enum: MaintenanceType,
    description: 'Tipo da manutenção (preventiva ou corretiva).',
  })
  @IsEnum(MaintenanceType, { message: 'Tipo de manutenção inválido.' })
  type: MaintenanceType;

  @ApiProperty({
    enum: MaintenanceCategory,
    description:
      'Categoria da manutenção. Define qual campo de previsão (next*) do veículo é recalculado ao concluir o registro.',
  })
  @IsEnum(MaintenanceCategory, { message: 'Categoria de manutenção inválida.' })
  category: MaintenanceCategory;

  @ApiProperty({
    example: 50000,
    description: 'KM do veículo no momento da manutenção.',
  })
  @Min(0, { message: 'O KM não pode ser negativo.' })
  km: number;

  @ApiProperty({ example: 350, description: 'Custo da manutenção.' })
  @Min(0, { message: 'O custo não pode ser negativo.' })
  cost: number;

  @ApiProperty({ description: 'Observações técnicas sobre a manutenção.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a descrição/observações da manutenção.' })
  description: string;

  @ApiPropertyOptional({
    description: 'Data prevista para a manutenção (agenda).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data prevista inválida.' })
  scheduledDate?: string;

  @ApiPropertyOptional({
    description: 'KM previsto para a manutenção (agenda).',
  })
  @IsOptional()
  @Min(0, { message: 'O KM previsto não pode ser negativo.' })
  scheduledKm?: number;

  @ApiPropertyOptional({
    description:
      'Data em que a manutenção foi efetivamente realizada. Quando informada, os campos next* do veículo são recalculados.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de realização inválida.' })
  performedDate?: string;
}
