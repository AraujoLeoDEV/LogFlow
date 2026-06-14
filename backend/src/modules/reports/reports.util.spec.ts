import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PDFDocument } from 'pdf-lib';

import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyLogStatus,
  FuelType,
  GoalStatus,
  GoalType,
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
  MaintenanceCategory,
  MaintenanceType,
  Prisma,
  ReportFormat,
  ReportType,
} from '../../../generated/prisma/client';
import { FinanceService } from '../finance/finance.service';
import { GoalsService, GoalRankingEntry } from '../goals/goals.service';
import {
  buildReportTable,
  generateReportCsv,
  generateReportExcel,
  generateReportFile,
  generateReportPdf,
  getReportFileExtension,
  validateReportFilters,
} from './reports.util';

describe('getReportFileExtension', () => {
  it('retorna a extensão correspondente a cada formato', () => {
    expect(getReportFileExtension(ReportFormat.PDF)).toBe('pdf');
    expect(getReportFileExtension(ReportFormat.EXCEL)).toBe('xlsx');
    expect(getReportFileExtension(ReportFormat.CSV)).toBe('csv');
  });
});

describe('validateReportFilters', () => {
  it('exige vehicleId para o histórico por veículo', () => {
    expect(() => validateReportFilters(ReportType.VEHICLE_HISTORY, {})).toThrow(
      BadRequestException,
    );

    expect(() =>
      validateReportFilters(ReportType.VEHICLE_HISTORY, {
        vehicleId: 'vehicle-1',
      }),
    ).not.toThrow();
  });

  it('exige driverId para o histórico por motorista', () => {
    expect(() => validateReportFilters(ReportType.DRIVER_HISTORY, {})).toThrow(
      BadRequestException,
    );
  });

  it('exige period para o ranking', () => {
    expect(() => validateReportFilters(ReportType.RANKING, {})).toThrow(
      BadRequestException,
    );

    expect(() =>
      validateReportFilters(ReportType.RANKING, { period: '2026-06' }),
    ).not.toThrow();
  });

  it('não exige filtros adicionais para uso diário', () => {
    expect(() =>
      validateReportFilters(ReportType.DAILY_USAGE, {}),
    ).not.toThrow();
  });
});

describe('geradores de arquivo', () => {
  const table = {
    title: 'Relatório de Teste',
    columns: [
      { key: 'name', header: 'Nome' },
      { key: 'value', header: 'Valor' },
    ],
    rows: [
      { name: 'Linha 1', value: 10 },
      { name: 'Linha; com ponto e vírgula', value: 20 },
    ],
  };

  it('generateReportCsv gera CSV com BOM, cabeçalho e linhas separadas por ;', () => {
    const buffer = generateReportCsv(table);
    const content = buffer.toString('utf-8');

    expect(content.charCodeAt(0)).toBe(0xfeff);
    const lines = content.slice(1).split('\r\n');

    expect(lines[0]).toBe('Nome;Valor');
    expect(lines[1]).toBe('Linha 1;10');
    expect(lines[2]).toBe('"Linha; com ponto e vírgula";20');
  });

  it('generateReportExcel gera planilha com cabeçalho em negrito e linhas de dados', async () => {
    const buffer = await generateReportExcel(table);

    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).getCell(1).value).toBe('Nome');
    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.getRow(2).getCell(1).value).toBe('Linha 1');
    expect(sheet.getRow(3).getCell(2).value).toBe(20);
  });

  it('generateReportPdf gera um PDF válido com ao menos uma página', async () => {
    const buffer = await generateReportPdf(table);

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('generateReportPdf pagina quando há muitas linhas', async () => {
    const manyRows = Array.from({ length: 80 }, (_, i) => ({
      name: `Linha ${i}`,
      value: i,
    }));

    const buffer = await generateReportPdf({ ...table, rows: manyRows });
    const pdf = await PDFDocument.load(buffer);

    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it('generateReportFile despacha para o gerador correto por formato', async () => {
    const csv = await generateReportFile(table, ReportFormat.CSV);
    expect(csv.toString('utf-8')).toContain('Nome');

    const pdf = await generateReportFile(table, ReportFormat.PDF);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const excel = await generateReportFile(table, ReportFormat.EXCEL);
    expect(excel.byteLength).toBeGreaterThan(0);
  });
});

describe('buildReportTable', () => {
  function buildPrismaMock(overrides: Record<string, unknown> = {}) {
    return {
      dailyLog: { findMany: jest.fn().mockResolvedValue([]) },
      fuel: { findMany: jest.fn().mockResolvedValue([]) },
      maintenance: { findMany: jest.fn().mockResolvedValue([]) },
      incident: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    } as unknown as PrismaService;
  }

  const getMonthlySummary = jest.fn();
  const getMonthlyComparison = jest.fn();
  const financeMock = {
    getMonthlySummary,
    getMonthlyComparison,
  } as unknown as FinanceService;

  const getRanking = jest.fn();
  const goalsMock = { getRanking } as unknown as GoalsService;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('DAILY_USAGE monta a tabela a partir dos registros diários', async () => {
    const prisma = buildPrismaMock({
      dailyLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            departureAt: new Date('2026-06-01T08:00:00'),
            returnAt: new Date('2026-06-01T12:00:00'),
            startKm: new Prisma.Decimal(100),
            endKm: new Prisma.Decimal(150),
            kmDriven: new Prisma.Decimal(50),
            totalDurationMinutes: 240,
            avgSpeedKmh: new Prisma.Decimal(12.5),
            status: DailyLogStatus.FINALIZADO,
            vehicle: { plate: 'ABC1D23' },
            driver: { name: 'João' },
            route: { name: 'Rota Centro' },
          },
        ]),
      },
    });

    const table = await buildReportTable(
      ReportType.DAILY_USAGE,
      {},
      { prisma, finance: financeMock, goals: goalsMock },
    );

    expect(table.title).toBe('Uso Diário da Frota');
    expect(table.columns.map((c) => c.key)).toContain('kmDriven');
    expect(table.rows[0]).toMatchObject({
      vehicle: 'ABC1D23',
      driver: 'João',
      route: 'Rota Centro',
      startKm: 100,
      endKm: 150,
      kmDriven: 50,
      durationMinutes: 240,
      status: DailyLogStatus.FINALIZADO,
    });
  });

  it('MONTHLY_COSTS reaproveita FinanceService.getMonthlySummary', async () => {
    getMonthlySummary.mockResolvedValue([
      {
        month: '2026-06',
        fuelCost: 1000,
        maintenanceCost: 200,
        depreciation: 300,
        total: 1500,
      },
    ]);

    const table = await buildReportTable(
      ReportType.MONTHLY_COSTS,
      { from: '2026-06-01', to: '2026-06-30' },
      { prisma: buildPrismaMock(), finance: financeMock, goals: goalsMock },
    );

    expect(getMonthlySummary).toHaveBeenCalledWith({
      from: '2026-06-01',
      to: '2026-06-30',
    });
    expect(table.rows[0]).toMatchObject({ month: '2026-06', total: 1500 });
  });

  it('FUEL monta a tabela a partir dos abastecimentos', async () => {
    const prisma = buildPrismaMock({
      fuel: {
        findMany: jest.fn().mockResolvedValue([
          {
            date: new Date('2026-06-05'),
            fuelType: FuelType.DIESEL,
            liters: new Prisma.Decimal(50),
            amountPaid: new Prisma.Decimal(300),
            currentKm: new Prisma.Decimal(1000),
            consumptionKmL: new Prisma.Decimal(8),
            costPerKm: new Prisma.Decimal(0.5),
            vehicle: { plate: 'ABC1D23' },
            driver: { name: 'João' },
          },
        ]),
      },
    });

    const table = await buildReportTable(
      ReportType.FUEL,
      {},
      { prisma, finance: financeMock, goals: goalsMock },
    );

    expect(table.title).toBe('Abastecimentos');
    expect(table.rows[0]).toMatchObject({
      vehicle: 'ABC1D23',
      driver: 'João',
      fuelType: FuelType.DIESEL,
      liters: 50,
      amountPaid: 300,
      consumptionKmL: 8,
    });
  });

  it('MAINTENANCE monta a tabela a partir das manutenções', async () => {
    const prisma = buildPrismaMock({
      maintenance: {
        findMany: jest.fn().mockResolvedValue([
          {
            performedDate: new Date('2026-06-01'),
            scheduledDate: null,
            type: MaintenanceType.PREVENTIVA,
            category: MaintenanceCategory.TROCA_OLEO,
            km: new Prisma.Decimal(10000),
            cost: new Prisma.Decimal(250),
            description: 'Troca de óleo',
            vehicle: { plate: 'ABC1D23' },
          },
        ]),
      },
    });

    const table = await buildReportTable(
      ReportType.MAINTENANCE,
      {},
      { prisma, finance: financeMock, goals: goalsMock },
    );

    expect(table.title).toBe('Manutenções');
    expect(table.rows[0]).toMatchObject({
      vehicle: 'ABC1D23',
      type: MaintenanceType.PREVENTIVA,
      category: MaintenanceCategory.TROCA_OLEO,
      km: 10000,
      cost: 250,
      description: 'Troca de óleo',
      scheduledDate: '-',
    });
  });

  it('INCIDENTS monta a tabela a partir das ocorrências', async () => {
    const prisma = buildPrismaMock({
      incident: {
        findMany: jest.fn().mockResolvedValue([
          {
            date: new Date('2026-06-02'),
            category: IncidentCategory.TRANSITO,
            type: IncidentType.MULTA,
            severity: IncidentSeverity.BAIXA,
            responsible: 'João',
            cost: new Prisma.Decimal(150),
            observations: 'Excesso de velocidade',
            vehicle: { plate: 'ABC1D23' },
            driver: { name: 'João' },
          },
        ]),
      },
    });

    const table = await buildReportTable(
      ReportType.INCIDENTS,
      {},
      { prisma, finance: financeMock, goals: goalsMock },
    );

    expect(table.title).toBe('Ocorrências');
    expect(table.rows[0]).toMatchObject({
      vehicle: 'ABC1D23',
      driver: 'João',
      category: IncidentCategory.TRANSITO,
      severity: IncidentSeverity.BAIXA,
      cost: 150,
    });
  });

  it('SAVINGS reaproveita FinanceService.getMonthlyComparison', async () => {
    getMonthlyComparison.mockResolvedValue([
      {
        month: '2026-05',
        fuelCost: 0,
        maintenanceCost: 0,
        depreciation: 0,
        total: 1000,
        variation: null,
      },
      {
        month: '2026-06',
        fuelCost: 0,
        maintenanceCost: 0,
        depreciation: 0,
        total: 900,
        variation: -10,
      },
    ]);

    const table = await buildReportTable(
      ReportType.SAVINGS,
      {},
      { prisma: buildPrismaMock(), finance: financeMock, goals: goalsMock },
    );

    expect(table.title).toBe('Economia (Comparativo Mensal)');
    expect(table.rows[1]).toMatchObject({
      month: '2026-06',
      total: 900,
      variation: '-10.00',
    });
    expect(table.rows[0].variation).toBe('-');
  });

  it('RANKING reaproveita GoalsService.getRanking e exige period', async () => {
    const entries: GoalRankingEntry[] = [
      {
        goalId: 'goal-1',
        driverId: 'driver-1',
        driverName: 'João',
        vehicleId: null,
        vehiclePlate: null,
        vehicleModel: null,
        vehicleCurrentKm: null,
        type: GoalType.CONSUMPTION_REDUCTION,
        targetValue: 10,
        actualValue: 12,
        difference: 2,
        status: GoalStatus.ATINGIDA,
        commissionValue: 100,
      },
    ];
    getRanking.mockResolvedValue(entries);

    const table = await buildReportTable(
      ReportType.RANKING,
      { period: '2026-06' },
      { prisma: buildPrismaMock(), finance: financeMock, goals: goalsMock },
    );

    expect(getRanking).toHaveBeenCalledWith('2026-06');
    expect(table.title).toBe('Ranking de Metas - 2026-06');
    expect(table.rows[0]).toMatchObject({
      entity: 'João',
      targetValue: 10,
      actualValue: 12,
      difference: '2.000',
      commissionValue: 100,
    });
  });

  it('VEHICLE_HISTORY e DRIVER_HISTORY usam o título correspondente', async () => {
    const prisma = buildPrismaMock();

    const vehicleTable = await buildReportTable(
      ReportType.VEHICLE_HISTORY,
      { vehicleId: 'vehicle-1' },
      { prisma, finance: financeMock, goals: goalsMock },
    );
    expect(vehicleTable.title).toBe('Histórico por Veículo');

    const driverTable = await buildReportTable(
      ReportType.DRIVER_HISTORY,
      { driverId: 'driver-1' },
      { prisma, finance: financeMock, goals: goalsMock },
    );
    expect(driverTable.title).toBe('Histórico por Motorista');
  });
});
