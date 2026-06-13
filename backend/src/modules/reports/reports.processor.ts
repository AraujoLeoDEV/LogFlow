import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { PrismaService } from '../../prisma/prisma.service';
import { ReportStatus } from '../../../generated/prisma/client';
import { FinanceService } from '../finance/finance.service';
import { GoalsService } from '../goals/goals.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { GENERATE_REPORT_JOB, REPORTS_QUEUE } from './reports.service';
import {
  buildReportTable,
  generateReportFile,
  getReportFileExtension,
} from './reports.util';

export interface GenerateReportJobData {
  reportId: string;
}

// Worker da fila de relatórios - seção 4.14: gera o arquivo (PDF/Excel/CSV)
// em background e atualiza o status do registro (PROCESSING -> DONE/ERROR).
@Processor(REPORTS_QUEUE)
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly goals: GoalsService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<GenerateReportJobData>): Promise<void> {
    if (job.name !== GENERATE_REPORT_JOB) {
      return;
    }

    const { reportId } = job.data;
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      this.logger.warn(`Relatório ${reportId} não encontrado para geração.`);
      return;
    }

    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.PROCESSING },
    });

    try {
      const filters = (report.filters ?? {}) as ReportFiltersDto;
      const table = await buildReportTable(report.type, filters, {
        prisma: this.prisma,
        finance: this.finance,
        goals: this.goals,
      });
      const file = await generateReportFile(table, report.format);

      const storagePath = this.config.get<string>(
        'PDF_STORAGE_PATH',
        './storage/reports',
      );
      await mkdir(storagePath, { recursive: true });

      const extension = getReportFileExtension(report.format);
      const filePath = join(storagePath, `${report.id}.${extension}`);
      await writeFile(filePath, file);

      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: ReportStatus.DONE, filePath },
      });
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Erro ao gerar relatório ${reportId}: ${message}`);

      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: ReportStatus.ERROR, errorMessage: message },
      });
    }
  }
}
