import { FuelType } from '../../../generated/prisma/client';
import { calculateFuelMetrics, isFuelTypeCompatible } from './fuel.util';

describe('isFuelTypeCompatible', () => {
  it('aceita o mesmo tipo de combustível do veículo', () => {
    expect(isFuelTypeCompatible(FuelType.DIESEL, FuelType.DIESEL)).toBe(true);
  });

  it('veículo FLEX aceita gasolina e etanol', () => {
    expect(isFuelTypeCompatible(FuelType.FLEX, FuelType.GASOLINE)).toBe(true);
    expect(isFuelTypeCompatible(FuelType.FLEX, FuelType.ETHANOL)).toBe(true);
  });

  it('rejeita combinações incompatíveis', () => {
    expect(isFuelTypeCompatible(FuelType.DIESEL, FuelType.GASOLINE)).toBe(
      false,
    );
    expect(isFuelTypeCompatible(FuelType.GASOLINE, FuelType.ETHANOL)).toBe(
      false,
    );
  });
});

describe('calculateFuelMetrics', () => {
  it('retorna consumptionKmL e costPerKm nulos para o primeiro abastecimento', () => {
    const result = calculateFuelMetrics({
      currentKm: 1000,
      previousKm: null,
      liters: 40,
      amountPaid: 200,
    });

    expect(result.consumptionKmL).toBeNull();
    expect(result.costPerKm).toBeNull();
  });

  it('calcula consumptionKmL e costPerKm com base no abastecimento anterior', () => {
    const result = calculateFuelMetrics({
      currentKm: 1400,
      previousKm: 1000,
      liters: 40,
      amountPaid: 200,
    });

    expect(result.consumptionKmL?.toNumber()).toBe(10);
    expect(result.costPerKm?.toNumber()).toBe(0.5);
  });

  it('retorna nulos quando o KM atual é igual ao anterior', () => {
    const result = calculateFuelMetrics({
      currentKm: 1000,
      previousKm: 1000,
      liters: 40,
      amountPaid: 200,
    });

    expect(result.consumptionKmL).toBeNull();
    expect(result.costPerKm).toBeNull();
  });

  it('retorna nulos quando liters é zero (evita divisão por zero)', () => {
    const result = calculateFuelMetrics({
      currentKm: 1400,
      previousKm: 1000,
      liters: 0,
      amountPaid: 200,
    });

    expect(result.consumptionKmL).toBeNull();
    expect(result.costPerKm).toBeNull();
  });
});
