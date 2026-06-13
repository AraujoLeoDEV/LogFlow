import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { ReportStatus, ReportType } from '../../../../generated/prisma/client';

export class ReportQueryDto {
  @ApiPropertyOptional({
    enum: ReportType,
    description: 'Filtrar pelo tipo de relatório.',
  })
  @IsOptional()
  @IsEnum(ReportType, { message: 'Tipo de relatório inválido.' })
  type?: ReportType;

  @ApiPropertyOptional({
    enum: ReportStatus,
    description: 'Filtrar pelo status do relatório.',
  })
  @IsOptional()
  @IsEnum(ReportStatus, { message: 'Status de relatório inválido.' })
  status?: ReportStatus;
}
