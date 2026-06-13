import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { mkdir, writeFile } from 'fs/promises';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Report,
  ReportFormat,
  ReportStatus,
  ReportType,
} from '../../../generated/prisma/client';
import { FinanceService } from '../finance/finance.service';
import { GoalsService } from '../goals/goals.service';
import { GenerateReportJobData, ReportsProcessor } from './reports.processor';
import * as reportsUtil from './reports.util';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const mockedMkdir = jest.mocked(mkdir);
const mockedWriteFile = jest.mocked(writeFile);

function buildReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    type: ReportType.DAILY_USAGE,
    format: ReportFormat.CSV,
    filters: {},
    status: ReportStatus.PENDING,
    filePath: null,
    errorMessage: null,
    requestedBy: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildJob(
  data: GenerateReportJobData,
  name = 'generate',
): Job<GenerateReportJobData> {
  return { name, data } as Job<GenerateReportJobData>;
}

function buildProcessor(report: Report | null) {
  const updates: Partial<Report>[] = [];
  const findUnique = jest.fn().mockResolvedValue(report);
  const update = jest.fn((args: { data: Partial<Report> }) => {
    updates.push(args.data);
    return Promise.resolve({ ...report, ...args.data });
  });

  const prisma = {
    report: { findUnique, update },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn().mockReturnValue('./storage/reports'),
  } as unknown as ConfigService;

  const processor = new ReportsProcessor(
    prisma,
    {} as FinanceService,
    {} as GoalsService,
    config,
  );

  return { processor, findUnique, update, updates };
}

describe('ReportsProcessor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockedMkdir.mockClear();
    mockedWriteFile.mockClear();
  });

  it('gera o arquivo e marca o relatório como DONE', async () => {
    const report = buildReport();
    const { processor, updates } = buildProcessor(report);

    jest
      .spyOn(reportsUtil, 'buildReportTable')
      .mockResolvedValue({ title: 'Teste', columns: [], rows: [] });
    jest
      .spyOn(reportsUtil, 'generateReportFile')
      .mockResolvedValue(Buffer.from('conteudo'));

    await processor.process(buildJob({ reportId: report.id }));

    expect(updates[0]).toEqual({ status: ReportStatus.PROCESSING });
    expect(mockedMkdir).toHaveBeenCalledWith('./storage/reports', {
      recursive: true,
    });
    expect(mockedWriteFile).toHaveBeenCalled();
    expect(updates[1]).toMatchObject({ status: ReportStatus.DONE });
    expect(updates[1].filePath).toContain(report.id);
  });

  it('marca o relatório como ERROR quando a geração falha', async () => {
    const report = buildReport();
    const { processor, updates } = buildProcessor(report);

    jest
      .spyOn(reportsUtil, 'buildReportTable')
      .mockRejectedValue(new Error('falha ao montar tabela'));

    await processor.process(buildJob({ reportId: report.id }));

    expect(updates[1]).toEqual({
      status: ReportStatus.ERROR,
      errorMessage: 'falha ao montar tabela',
    });
  });

  it('não faz nada quando o relatório não existe', async () => {
    const { processor, update } = buildProcessor(null);

    await processor.process(buildJob({ reportId: 'inexistente' }));

    expect(update).not.toHaveBeenCalled();
  });

  it('ignora jobs com nome diferente de "generate"', async () => {
    const report = buildReport();
    const { processor, findUnique, update } = buildProcessor(report);

    await processor.process(buildJob({ reportId: report.id }, 'outro-job'));

    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
