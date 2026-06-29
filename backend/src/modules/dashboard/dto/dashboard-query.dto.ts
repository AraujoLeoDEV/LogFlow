import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Data inicial do período (a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Data final do período (até).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;

  @ApiPropertyOptional({
    description: 'Filtrar pelo id do veículo (default: todos).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar pelo id do motorista (default: todos).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;
}
