import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';

import { ReportFormat, ReportType } from '../../../../generated/prisma/client';
import { ReportFiltersDto } from './report-filters.dto';

export class CreateReportDto {
  @ApiProperty({ enum: ReportType, description: 'Tipo de relatório a gerar.' })
  @IsEnum(ReportType, { message: 'Tipo de relatório inválido.' })
  type: ReportType;

  @ApiProperty({
    enum: ReportFormat,
    description: 'Formato de exportação do relatório.',
  })
  @IsEnum(ReportFormat, { message: 'Formato de relatório inválido.' })
  format: ReportFormat;

  @ApiPropertyOptional({
    description: 'Filtros aplicados na geração do relatório.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters?: ReportFiltersDto;
}
