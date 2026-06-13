import { UnprocessableEntityException } from '@nestjs/common';

import { calculateReturnMetrics } from './daily-logs.util';

describe('calculateReturnMetrics', () => {
  it('calcula km rodado, duração e velocidade média em um caso normal', () => {
    const result = calculateReturnMetrics({
      startKm: 1000,
      endKm: 1050,
      departureAt: new Date('2026-06-12T08:00:00Z'),
      returnAt: new Date('2026-06-12T09:00:00Z'),
    });

    expect(result.kmDriven).toBe(50);
    expect(result.totalDurationMinutes).toBe(60);
    expect(result.avgSpeedKmh).toBe(50);
  });

  it('aceita valores Decimal/string do Prisma', () => {
    const result = calculateReturnMetrics({
      startKm: '1000.0',
      endKm: '1030.5',
      departureAt: new Date('2026-06-12T08:00:00Z'),
      returnAt: new Date('2026-06-12T08:30:00Z'),
    });

    expect(result.kmDriven).toBeCloseTo(30.5);
    expect(result.totalDurationMinutes).toBe(30);
    expect(result.avgSpeedKmh).toBeCloseTo(61);
  });

  it('retorna velocidade média zero quando a duração é zero', () => {
    const sameInstant = new Date('2026-06-12T08:00:00Z');

    const result = calculateReturnMetrics({
      startKm: 1000,
      endKm: 1010,
      departureAt: sameInstant,
      returnAt: sameInstant,
    });

    expect(result.kmDriven).toBe(10);
    expect(result.totalDurationMinutes).toBe(0);
    expect(result.avgSpeedKmh).toBe(0);
  });

  it('retorna km rodado e velocidade zero quando endKm == startKm', () => {
    const result = calculateReturnMetrics({
      startKm: 1000,
      endKm: 1000,
      departureAt: new Date('2026-06-12T08:00:00Z'),
      returnAt: new Date('2026-06-12T08:30:00Z'),
    });

    expect(result.kmDriven).toBe(0);
    expect(result.avgSpeedKmh).toBe(0);
  });

  it('rejeita endKm menor que startKm com UnprocessableEntityException', () => {
    expect(() =>
      calculateReturnMetrics({
        startKm: 1000,
        endKm: 999,
        departureAt: new Date('2026-06-12T08:00:00Z'),
        returnAt: new Date('2026-06-12T09:00:00Z'),
      }),
    ).toThrow(UnprocessableEntityException);
  });
});
