import type { FuelType } from '@/types/vehicle';

export const fuelTypeLabels: Record<FuelType, string> = {
  GASOLINE: 'Gasolina',
  ETHANOL: 'Etanol',
  DIESEL: 'Diesel',
  FLEX: 'Flex',
  GNV: 'GNV',
};

export const fuelTypeOptions: { value: FuelType; label: string }[] = Object.entries(
  fuelTypeLabels,
).map(([value, label]) => ({ value: value as FuelType, label }));
