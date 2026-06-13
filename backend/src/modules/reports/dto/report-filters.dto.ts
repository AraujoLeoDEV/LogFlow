import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

// Filtros aceitos pelos relatórios exportáveis - seção 4.14. Cada tipo de
// relatório usa o subconjunto de filtros que fizer sentido (ex: período
// AAAA-MM para o ranking, intervalo de datas para os demais).
export class ReportFiltersDto {
  @ApiPropertyOptional({
    description: 'Data inicial do período (a partir de).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial inválida.' })
  from?: string;

  @ApiPropertyOptional({ description: 'Data final do período (até).' })
  @IsOptional()
  @IsDateString({}, { message: 'Data final inválida.' })
  to?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo id do veículo.' })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo id do motorista.' })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional({
    example: '2026-06',
    description: 'Período de referência (formato AAAA-MM), usado no ranking.',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Período inválido. Use o formato AAAA-MM.',
  })
  period?: string;
}
