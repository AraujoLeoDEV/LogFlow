import { BadRequestException } from '@nestjs/common';

import { calculateMonthlyDepreciation } from './vehicles.util';

describe('calculateMonthlyDepreciation', () => {
  it('calcula a depreciação mensal linear', () => {
    const result = calculateMonthlyDepreciation({
      acquisitionValue: 120000,
      residualValue: 30000,
      usefulLifeMonths: 60,
    });

    expect(result).toBe(1500);
  });

  it('aceita valores Decimal/string do Prisma', () => {
    const result = calculateMonthlyDepreciation({
      acquisitionValue: '95000',
      residualValue: '35000',
      usefulLifeMonths: 60,
    });

    expect(result).toBeCloseTo(1000);
  });

  it('rejeita vida útil igual a zero', () => {
    expect(() =>
      calculateMonthlyDepreciation({
        acquisitionValue: 100000,
        residualValue: 10000,
        usefulLifeMonths: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejeita vida útil negativa', () => {
    expect(() =>
      calculateMonthlyDepreciation({
        acquisitionValue: 100000,
        residualValue: 10000,
        usefulLifeMonths: -12,
      }),
    ).toThrow(BadRequestException);
  });
});
