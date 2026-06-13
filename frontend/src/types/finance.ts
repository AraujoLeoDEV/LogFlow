export interface FinanceQuery {
  from?: string;
  to?: string;
}

export interface MonthlyFinanceSummary {
  month: string;
  fuelCost: number;
  maintenanceCost: number;
  depreciation: number;
  total: number;
}

export interface MonthlyFinanceComparison extends MonthlyFinanceSummary {
  variation: number | null;
}

export interface CostPerKmResult {
  totalCost: number;
  kmTotal: number;
  costPerKm: number | null;
}
