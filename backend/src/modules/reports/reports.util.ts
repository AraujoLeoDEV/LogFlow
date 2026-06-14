import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PDFFont, PDFPage, StandardFonts, PDFDocument } from 'pdf-lib';

import { PrismaService } from '../../prisma/prisma.service';
import { parseDateOnly } from '../../common/utils/date-range.util';
import {
  Prisma,
  ReportFormat,
  ReportType,
} from '../../../generated/prisma/client';
import { FinanceService } from '../finance/finance.service';
import { GoalsService } from '../goals/goals.service';
import { ReportFiltersDto } from './dto/report-filters.dto';

export interface ReportColumn {
  key: string;
  header: string;
}

export interface ReportTable {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
}

export interface ReportDependencies {
  prisma: PrismaService;
  finance: FinanceService;
  goals: GoalsService;
}

// Extensão de arquivo correspondente ao formato escolhido - seção 4.14.
export function getReportFileExtension(format: ReportFormat): string {
  switch (format) {
    case ReportFormat.PDF:
      return 'pdf';
    case ReportFormat.EXCEL:
      return 'xlsx';
    case ReportFormat.CSV:
      return 'csv';
  }
}

// Valida filtros obrigatórios por tipo de relatório - seção 4.14: histórico
// por veículo/motorista exige o respectivo id e o ranking exige o período.
export function validateReportFilters(
  type: ReportType,
  filters: ReportFiltersDto,
): void {
  if (type === ReportType.VEHICLE_HISTORY && !filters.vehicleId) {
    throw new BadRequestException(
      'Informe o veículo para gerar o histórico por veículo.',
    );
  }

  if (type === ReportType.DRIVER_HISTORY && !filters.driverId) {
    throw new BadRequestException(
      'Informe o motorista para gerar o histórico por motorista.',
    );
  }

  if (type === ReportType.RANKING && !filters.period) {
    throw new BadRequestException(
      'Informe o período (AAAA-MM) para gerar o ranking.',
    );
  }
}

// Monta a tabela de dados (título, colunas e linhas) de acordo com o tipo de
// relatório - seção 4.14. A mesma tabela é usada pelos três geradores de
// arquivo (CSV, Excel e PDF).
export async function buildReportTable(
  type: ReportType,
  filters: ReportFiltersDto,
  deps: ReportDependencies,
): Promise<ReportTable> {
  switch (type) {
    case ReportType.DAILY_USAGE:
      return buildDailyLogsTable(deps.prisma, filters, 'Uso Diário da Frota');
    case ReportType.VEHICLE_HISTORY:
      return buildDailyLogsTable(deps.prisma, filters, 'Histórico por Veículo');
    case ReportType.DRIVER_HISTORY:
      return buildDailyLogsTable(
        deps.prisma,
        filters,
        'Histórico por Motorista',
      );
    case ReportType.MONTHLY_COSTS:
      return buildMonthlyCostsTable(deps.finance, filters);
    case ReportType.FUEL:
      return buildFuelTable(deps.prisma, filters);
    case ReportType.MAINTENANCE:
      return buildMaintenanceTable(deps.prisma, filters);
    case ReportType.INCIDENTS:
      return buildIncidentsTable(deps.prisma, filters);
    case ReportType.SAVINGS:
      return buildSavingsTable(deps.finance, filters);
    case ReportType.RANKING:
      return buildRankingTable(deps.goals, filters);
  }
}

function dateFilter(
  filters: ReportFiltersDto,
): Prisma.DateTimeFilter | undefined {
  if (!filters.from && !filters.to) {
    return undefined;
  }

  return {
    ...(filters.from ? { gte: parseDateOnly(filters.from) } : {}),
    ...(filters.to ? { lte: parseDateOnly(filters.to, true) } : {}),
  };
}

function formatDateTime(value: Date | null): string {
  return value ? value.toLocaleString('pt-BR') : '-';
}

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString('pt-BR') : '-';
}

function formatDecimal(value: Prisma.Decimal | null): number | string {
  return value ? value.toNumber() : '-';
}

// Registros diários (saída/retorno) - usado por DAILY_USAGE, VEHICLE_HISTORY
// e DRIVER_HISTORY, que diferem apenas no título e nos filtros aplicados
// (período, veículo, motorista) - seção 4.14.
async function buildDailyLogsTable(
  prisma: PrismaService,
  filters: ReportFiltersDto,
  title: string,
): Promise<ReportTable> {
  const where: Prisma.DailyLogWhereInput = {
    departureAt: dateFilter(filters),
    vehicleId: filters.vehicleId,
    driverId: filters.driverId,
  };

  const logs = await prisma.dailyLog.findMany({
    where,
    orderBy: { departureAt: 'desc' },
    include: {
      vehicle: { select: { plate: true } },
      driver: { select: { name: true } },
      route: { select: { name: true } },
    },
  });

  return {
    title,
    columns: [
      { key: 'departureAt', header: 'Saída' },
      { key: 'returnAt', header: 'Retorno' },
      { key: 'vehicle', header: 'Veículo' },
      { key: 'driver', header: 'Motorista' },
      { key: 'route', header: 'Rota' },
      { key: 'startKm', header: 'KM Inicial' },
      { key: 'endKm', header: 'KM Final' },
      { key: 'kmDriven', header: 'KM Rodado' },
      { key: 'durationMinutes', header: 'Duração (min)' },
      { key: 'avgSpeedKmh', header: 'Vel. Média (km/h)' },
      { key: 'status', header: 'Status' },
    ],
    rows: logs.map((log) => ({
      departureAt: formatDateTime(log.departureAt),
      returnAt: formatDateTime(log.returnAt),
      vehicle: log.vehicle.plate,
      driver: log.driver.name,
      route: log.route.name,
      startKm: log.startKm.toNumber(),
      endKm: formatDecimal(log.endKm),
      kmDriven: formatDecimal(log.kmDriven),
      durationMinutes: log.totalDurationMinutes ?? '-',
      avgSpeedKmh: formatDecimal(log.avgSpeedKmh),
      status: log.status,
    })),
  };
}

// Custos mensais da frota - seção 4.12/4.14, reaproveita
// FinanceService.getMonthlySummary.
async function buildMonthlyCostsTable(
  finance: FinanceService,
  filters: ReportFiltersDto,
): Promise<ReportTable> {
  const summary = await finance.getMonthlySummary({
    from: filters.from,
    to: filters.to,
  });

  return {
    title: 'Custos Mensais da Frota',
    columns: [
      { key: 'month', header: 'Mês' },
      { key: 'fuelCost', header: 'Combustível (R$)' },
      { key: 'maintenanceCost', header: 'Manutenção (R$)' },
      { key: 'depreciation', header: 'Depreciação (R$)' },
      { key: 'total', header: 'Total (R$)' },
    ],
    rows: summary.map((entry) => ({
      month: entry.month,
      fuelCost: entry.fuelCost,
      maintenanceCost: entry.maintenanceCost,
      depreciation: entry.depreciation,
      total: entry.total,
    })),
  };
}

// Abastecimentos - seção 4.6/4.14.
async function buildFuelTable(
  prisma: PrismaService,
  filters: ReportFiltersDto,
): Promise<ReportTable> {
  const where: Prisma.FuelWhereInput = {
    date: dateFilter(filters),
    vehicleId: filters.vehicleId,
    driverId: filters.driverId,
  };

  const records = await prisma.fuel.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      vehicle: { select: { plate: true } },
      driver: { select: { name: true } },
    },
  });

  return {
    title: 'Abastecimentos',
    columns: [
      { key: 'date', header: 'Data' },
      { key: 'vehicle', header: 'Veículo' },
      { key: 'driver', header: 'Motorista' },
      { key: 'fuelType', header: 'Combustível' },
      { key: 'liters', header: 'Litros' },
      { key: 'amountPaid', header: 'Valor Pago (R$)' },
      { key: 'currentKm', header: 'KM Atual' },
      { key: 'consumptionKmL', header: 'Consumo (km/L)' },
      { key: 'costPerKm', header: 'Custo por KM (R$)' },
    ],
    rows: records.map((record) => ({
      date: formatDate(record.date),
      vehicle: record.vehicle.plate,
      driver: record.driver.name,
      fuelType: record.fuelType,
      liters: record.liters.toNumber(),
      amountPaid: record.amountPaid.toNumber(),
      currentKm: record.currentKm.toNumber(),
      consumptionKmL: formatDecimal(record.consumptionKmL),
      costPerKm: formatDecimal(record.costPerKm),
    })),
  };
}

// Manutenções - seção 4.7/4.14.
async function buildMaintenanceTable(
  prisma: PrismaService,
  filters: ReportFiltersDto,
): Promise<ReportTable> {
  const where: Prisma.MaintenanceWhereInput = {
    createdAt: dateFilter(filters),
    vehicleId: filters.vehicleId,
  };

  const records = await prisma.maintenance.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { vehicle: { select: { plate: true } } },
  });

  return {
    title: 'Manutenções',
    columns: [
      { key: 'performedDate', header: 'Data Realizada' },
      { key: 'scheduledDate', header: 'Data Prevista' },
      { key: 'vehicle', header: 'Veículo' },
      { key: 'type', header: 'Tipo' },
      { key: 'category', header: 'Categoria' },
      { key: 'km', header: 'KM' },
      { key: 'cost', header: 'Custo (R$)' },
      { key: 'description', header: 'Descrição' },
    ],
    rows: records.map((record) => ({
      performedDate: formatDate(record.performedDate),
      scheduledDate: formatDate(record.scheduledDate),
      vehicle: record.vehicle.plate,
      type: record.type,
      category: record.category,
      km: record.km.toNumber(),
      cost: record.cost.toNumber(),
      description: record.description,
    })),
  };
}

// Ocorrências - seção 4.8/4.14.
async function buildIncidentsTable(
  prisma: PrismaService,
  filters: ReportFiltersDto,
): Promise<ReportTable> {
  const where: Prisma.IncidentWhereInput = {
    date: dateFilter(filters),
    vehicleId: filters.vehicleId,
    driverId: filters.driverId,
  };

  const records = await prisma.incident.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      vehicle: { select: { plate: true } },
      driver: { select: { name: true } },
    },
  });

  return {
    title: 'Ocorrências',
    columns: [
      { key: 'date', header: 'Data' },
      { key: 'vehicle', header: 'Veículo' },
      { key: 'driver', header: 'Motorista' },
      { key: 'category', header: 'Categoria' },
      { key: 'type', header: 'Tipo' },
      { key: 'severity', header: 'Gravidade' },
      { key: 'responsible', header: 'Responsável' },
      { key: 'cost', header: 'Custo (R$)' },
      { key: 'observations', header: 'Observações' },
    ],
    rows: records.map((record) => ({
      date: formatDate(record.date),
      vehicle: record.vehicle.plate,
      driver: record.driver.name,
      category: record.category,
      type: record.type,
      severity: record.severity,
      responsible: record.responsible,
      cost: formatDecimal(record.cost),
      observations: record.observations,
    })),
  };
}

// Economia - seção 4.12/4.14, reaproveita FinanceService.getMonthlyComparison.
async function buildSavingsTable(
  finance: FinanceService,
  filters: ReportFiltersDto,
): Promise<ReportTable> {
  const comparison = await finance.getMonthlyComparison({
    from: filters.from,
    to: filters.to,
  });

  return {
    title: 'Economia (Comparativo Mensal)',
    columns: [
      { key: 'month', header: 'Mês' },
      { key: 'total', header: 'Custo Total (R$)' },
      { key: 'variation', header: 'Variação (%)' },
    ],
    rows: comparison.map((entry) => ({
      month: entry.month,
      total: entry.total,
      variation: entry.variation !== null ? entry.variation.toFixed(2) : '-',
    })),
  };
}

// Ranking de metas - seção 4.13/4.14, reaproveita GoalsService.getRanking.
async function buildRankingTable(
  goals: GoalsService,
  filters: ReportFiltersDto,
): Promise<ReportTable> {
  const ranking = await goals.getRanking(filters.period as string);

  return {
    title: `Ranking de Metas - ${filters.period}`,
    columns: [
      { key: 'entity', header: 'Motorista/Veículo' },
      { key: 'type', header: 'Tipo' },
      { key: 'targetValue', header: 'Meta (km/L)' },
      { key: 'actualValue', header: 'Realizado (km/L)' },
      { key: 'difference', header: 'Diferença' },
      { key: 'status', header: 'Status' },
      { key: 'commissionValue', header: 'Comissão (R$)' },
    ],
    rows: ranking.map((entry) => ({
      entity: entry.driverName ?? entry.vehiclePlate ?? '-',
      type: entry.type,
      targetValue: entry.targetValue,
      actualValue: entry.actualValue ?? '-',
      difference: entry.difference !== null ? entry.difference.toFixed(3) : '-',
      status: entry.status,
      commissionValue: entry.commissionValue ?? '-',
    })),
  };
}

// Gera o arquivo CSV (com BOM UTF-8 para abrir corretamente em planilhas) -
// seção 4.14.
export function generateReportCsv(table: ReportTable): Buffer {
  const escape = (value: string): string => {
    if (/[",\r\n;]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const lines = [
    table.columns.map((column) => escape(column.header)).join(';'),
    ...table.rows.map((row) =>
      table.columns
        .map((column) => escape(String(row[column.key] ?? '')))
        .join(';'),
    ),
  ];

  const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([utf8Bom, Buffer.from(lines.join('\r\n'), 'utf-8')]);
}

// Gera o arquivo Excel (.xlsx) com cabeçalho em destaque - seção 4.14.
export async function generateReportExcel(table: ReportTable): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(table.title.slice(0, 31));

  sheet.columns = table.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: 22,
  }));

  sheet.getRow(1).font = { bold: true };

  table.rows.forEach((row) => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const PDF_PAGE_WIDTH = 841.89; // A4 paisagem
const PDF_PAGE_HEIGHT = 595.28;
const PDF_MARGIN = 30;
const PDF_FONT_SIZE = 8;
const PDF_ROW_HEIGHT = 16;

// Substitui caracteres que a fonte WinAnsi não consegue codificar (ex.: dados
// com encoding corrompido no banco) por "?" para evitar falha na geração do
// PDF - seção 4.14.
function sanitizeForPdf(text: string, font: PDFFont): string {
  let result = '';
  for (const char of text) {
    try {
      font.encodeText(char);
      result += char;
    } catch {
      result += '?';
    }
  }
  return result;
}

function truncateToWidth(
  text: string,
  font: PDFFont,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, PDF_FONT_SIZE) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (
    truncated.length > 1 &&
    font.widthOfTextAtSize(`${truncated}…`, PDF_FONT_SIZE) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}…`;
}

// Gera o arquivo PDF desenhando uma tabela paginada manualmente (página A4
// paisagem) - seção 4.14.
export async function generateReportPdf(table: ReportTable): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const usableWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const columnWidth = usableWidth / table.columns.length;

  let page: PDFPage = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  let y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  const drawRow = (values: string[], rowFont: PDFFont): void => {
    values.forEach((value, index) => {
      const sanitized = sanitizeForPdf(value, rowFont);
      page.drawText(truncateToWidth(sanitized, rowFont, columnWidth - 4), {
        x: PDF_MARGIN + index * columnWidth,
        y,
        size: PDF_FONT_SIZE,
        font: rowFont,
      });
    });
    y -= PDF_ROW_HEIGHT;
  };

  const drawHeaderRow = (): void => {
    drawRow(
      table.columns.map((column) => column.header),
      boldFont,
    );
  };

  const startNewPage = (withTitle: boolean): void => {
    page = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
    y = PDF_PAGE_HEIGHT - PDF_MARGIN;

    if (withTitle) {
      page.drawText(sanitizeForPdf(table.title, boldFont), {
        x: PDF_MARGIN,
        y,
        size: 12,
        font: boldFont,
      });
      y -= PDF_ROW_HEIGHT * 1.5;
    }

    drawHeaderRow();
  };

  startNewPage(true);

  for (const row of table.rows) {
    if (y < PDF_MARGIN + PDF_ROW_HEIGHT) {
      startNewPage(false);
    }

    drawRow(
      table.columns.map((column) => String(row[column.key] ?? '')),
      font,
    );
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// Gera o arquivo no formato solicitado a partir da tabela de dados -
// seção 4.14.
export async function generateReportFile(
  table: ReportTable,
  format: ReportFormat,
): Promise<Buffer> {
  switch (format) {
    case ReportFormat.CSV:
      return generateReportCsv(table);
    case ReportFormat.EXCEL:
      return generateReportExcel(table);
    case ReportFormat.PDF:
      return generateReportPdf(table);
  }
}
