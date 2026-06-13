import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Report,
  ReportFormat,
  ReportStatus,
  ReportType,
  Role,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateReportDto } from './dto/create-report.dto';
import { GENERATE_REPORT_JOB, ReportsService } from './reports.service';

const adminUser: AuthenticatedUser = {
  sub: 'user-admin',
  email: 'admin@empresa.com',
  role: Role.ADMIN,
};

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

function buildService(reports: Report[] = []) {
  const prisma = {
    report: {
      create: jest.fn((args: { data: Partial<Report> }) => {
        const created = buildReport({
          ...args.data,
          filters: args.data.filters ?? {},
        });
        reports.push(created);
        return Promise.resolve(created);
      }),
      findMany: jest.fn(
        (args: { where: { type?: ReportType; status?: ReportStatus } }) => {
          return Promise.resolve(
            reports.filter(
              (r) =>
                (!args.where.type || r.type === args.where.type) &&
                (!args.where.status || r.status === args.where.status),
            ),
          );
        },
      ),
      findUnique: jest.fn((args: { where: { id: string } }) =>
        Promise.resolve(reports.find((r) => r.id === args.where.id) ?? null),
      ),
    },
  } as unknown as PrismaService;

  const add = jest.fn();
  const queue = { add } as unknown as Queue;

  return { service: new ReportsService(prisma, queue), add, reports };
}

describe('ReportsService', () => {
  it('cria o relatório e enfileira o job de geração', async () => {
    const { service, add, reports } = buildService();

    const dto: CreateReportDto = {
      type: ReportType.DAILY_USAGE,
      format: ReportFormat.CSV,
    };

    const result = await service.create(dto, adminUser);

    expect(result.status).toBe(ReportStatus.PENDING);
    expect(result.requestedBy).toBe('user-admin');
    expect(reports).toHaveLength(1);
    expect(add).toHaveBeenCalledWith(GENERATE_REPORT_JOB, {
      reportId: result.id,
    });
  });

  it('rejeita histórico por veículo sem vehicleId', async () => {
    const { service } = buildService();

    const dto: CreateReportDto = {
      type: ReportType.VEHICLE_HISTORY,
      format: ReportFormat.PDF,
    };

    await expect(service.create(dto, adminUser)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejeita ranking sem period', async () => {
    const { service } = buildService();

    const dto: CreateReportDto = {
      type: ReportType.RANKING,
      format: ReportFormat.EXCEL,
    };

    await expect(service.create(dto, adminUser)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('findAll filtra por tipo e status', async () => {
    const existing = [
      buildReport({
        id: 'r1',
        type: ReportType.FUEL,
        status: ReportStatus.DONE,
      }),
      buildReport({
        id: 'r2',
        type: ReportType.INCIDENTS,
        status: ReportStatus.PENDING,
      }),
    ];
    const { service } = buildService(existing);

    const result = await service.findAll({ type: ReportType.FUEL });

    expect(result).toEqual([existing[0]]);
  });

  it('findOne lança NotFoundException quando o relatório não existe', async () => {
    const { service } = buildService();

    await expect(service.findOne('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getFilePath lança BadRequestException quando o relatório não está concluído', async () => {
    const existing = [
      buildReport({ id: 'r1', status: ReportStatus.PROCESSING }),
    ];
    const { service } = buildService(existing);

    await expect(service.getFilePath('r1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getFilePath retorna o caminho do arquivo quando concluído', async () => {
    const existing = [
      buildReport({
        id: 'r1',
        status: ReportStatus.DONE,
        filePath: '/tmp/r1.csv',
      }),
    ];
    const { service } = buildService(existing);

    const result = await service.getFilePath('r1');

    expect(result.filePath).toBe('/tmp/r1.csv');
  });
});
