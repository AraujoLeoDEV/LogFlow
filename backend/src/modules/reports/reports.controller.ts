import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { Report, Role } from '../../../generated/prisma/client';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';
import { getReportFileExtension } from './reports.util';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(Role.ADMIN, Role.COORDENACAO, Role.FINANCEIRO)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({
    summary: 'Enfileira a geração assíncrona de um relatório (PDF/Excel/CSV)',
  })
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Report> {
    return this.reportsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lista relatórios gerados, com filtros' })
  findAll(@Query() query: ReportQueryDto): Promise<Report[]> {
    return this.reportsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta o status de um relatório' })
  findOne(@Param('id') id: string): Promise<Report> {
    return this.reportsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Baixa o arquivo de um relatório concluído' })
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const report = await this.reportsService.getFilePath(id);
    const extension = getReportFileExtension(report.format);
    const filename = `${report.type.toLowerCase()}-${report.id}.${extension}`;

    res.download(report.filePath, filename);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui definitivamente um relatório (somente ADMIN)',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.reportsService.remove(id);
  }
}
