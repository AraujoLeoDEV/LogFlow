export type ReportType =
  | 'DAILY_USAGE'
  | 'VEHICLE_HISTORY'
  | 'DRIVER_HISTORY'
  | 'MONTHLY_COSTS'
  | 'FUEL'
  | 'MAINTENANCE'
  | 'INCIDENTS'
  | 'SAVINGS'
  | 'RANKING';

export type ReportFormat = 'PDF' | 'EXCEL' | 'CSV';

export type ReportStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR';

export interface ReportFilters {
  from?: string;
  to?: string;
  vehicleId?: string;
  driverId?: string;
  period?: string;
}

export interface Report {
  id: string;
  type: ReportType;
  format: ReportFormat;
  filters: ReportFilters;
  status: ReportStatus;
  filePath: string | null;
  errorMessage: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportPayload {
  type: ReportType;
  format: ReportFormat;
  filters?: ReportFilters;
}

export interface ReportQuery {
  type?: ReportType;
  status?: ReportStatus;
}
