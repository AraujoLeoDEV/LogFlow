import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FuelQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar pelo id do veículo.' })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo id do motorista.' })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional({
    description: 'Data inicial do período (abastecimento a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Data final do período (abastecimento até).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;
}
