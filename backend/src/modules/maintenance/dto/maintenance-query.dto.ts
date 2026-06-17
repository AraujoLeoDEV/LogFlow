import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  MaintenanceCategory,
  MaintenanceType,
} from '../../../../generated/prisma/client';

export class MaintenanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar pelo id do veículo.' })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({
    enum: MaintenanceType,
    description: 'Filtrar pelo tipo.',
  })
  @IsOptional()
  @IsEnum(MaintenanceType, { message: 'Tipo de manutenção inválido.' })
  type?: MaintenanceType;

  @ApiPropertyOptional({
    enum: MaintenanceCategory,
    description: 'Filtrar pela categoria.',
  })
  @IsOptional()
  @IsEnum(MaintenanceCategory, { message: 'Categoria de manutenção inválida.' })
  category?: MaintenanceCategory;

  @ApiPropertyOptional({
    description: 'Data inicial do período (realizada a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Data final do período (realizada até).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;
}
