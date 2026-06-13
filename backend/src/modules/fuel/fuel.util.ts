import { FuelType, Prisma } from '../../../generated/prisma/client';

// Compatibilidade de combustível - seção 4.6
const FUEL_COMPATIBILITY: Record<FuelType, FuelType[]> = {
  [FuelType.GASOLINE]: [FuelType.GASOLINE],
  [FuelType.ETHANOL]: [FuelType.ETHANOL],
  [FuelType.DIESEL]: [FuelType.DIESEL],
  [FuelType.FLEX]: [FuelType.FLEX, FuelType.GASOLINE, FuelType.ETHANOL],
  [FuelType.GNV]: [FuelType.GNV, FuelType.GASOLINE],
};

export function isFuelTypeCompatible(
  vehicleFuelType: FuelType,
  fuelType: FuelType,
): boolean {
  return FUEL_COMPATIBILITY[vehicleFuelType].includes(fuelType);
}

export interface FuelMetrics {
  consumptionKmL: Prisma.Decimal | null;
  costPerKm: Prisma.Decimal | null;
}

interface FuelMetricsInput {
  currentKm: Prisma.Decimal | number | string;
  previousKm: Prisma.Decimal | number | string | null;
  liters: Prisma.Decimal | number | string;
  amountPaid: Prisma.Decimal | number | string;
}

// Cálculo de consumo (KM/L) e custo por KM - seção 4.6
export function calculateFuelMetrics({
  currentKm,
  previousKm,
  liters,
  amountPaid,
}: FuelMetricsInput): FuelMetrics {
  if (previousKm === null) {
    return { consumptionKmL: null, costPerKm: null };
  }

  const kmDriven = new Prisma.Decimal(currentKm).minus(previousKm);

  if (kmDriven.lessThanOrEqualTo(0)) {
    return { consumptionKmL: null, costPerKm: null };
  }

  return {
    consumptionKmL: kmDriven.dividedBy(liters),
    costPerKm: new Prisma.Decimal(amountPaid).dividedBy(kmDriven),
  };
}
