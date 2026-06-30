import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { existsSync, unlinkSync } from 'fs';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Report, ReportStatus } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { validateReportFilters } from './reports.util';

export const REPORTS_QUEUE = 'reports';
export const GENERATE_REPORT_JOB = 'generate';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REPORTS_QUEUE) private readonly queue: Queue,
  ) {}

  // Enfileira a geração assíncrona do relatório - seção 4.14. A validação
  // dos filtros obrigatórios por tipo ocorre antes de criar o registro.
  async create(dto: CreateReportDto, user: AuthenticatedUser): Promise<Report> {
    const filters = dto.filters ?? {};
    validateReportFilters(dto.type, filters);

    const report = await this.prisma.report.create({
      data: {
        type: dto.type,
        format: dto.format,
        filters: filters as Prisma.InputJsonValue,
        requestedBy: user.sub,
      },
    });

    await this.queue.add(GENERATE_REPORT_JOB, { reportId: report.id });

    return report;
  }

  async findAll(query: ReportQueryDto): Promise<Report[]> {
    return this.prisma.report.findMany({
      where: { type: query.type, status: query.status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Report> {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new NotFoundException('Relatório não encontrado.');
    }

    return report;
  }

  // Caminho do arquivo gerado, para download - seção 4.14. Só está
  // disponível quando o job foi concluído com sucesso (status DONE).
  async getFilePath(id: string): Promise<Report & { filePath: string }> {
    const report = await this.findOne(id);

    if (report.status !== ReportStatus.DONE || !report.filePath) {
      throw new BadRequestException(
        'Relatório ainda não está disponível para download.',
      );
    }

    return report as Report & { filePath: string };
  }

  // Exclusão definitiva - somente ADMIN. O delete no banco roda primeiro:
  // se falhar, o arquivo gerado em disco não é tocado e nada fica órfão.
  async remove(id: string): Promise<void> {
    const report = await this.findOne(id);

    await this.prisma.report.delete({ where: { id } });

    if (report.filePath && existsSync(report.filePath)) {
      unlinkSync(report.filePath);
    }
  }
}
