import { UnprocessableEntityException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';

interface ReturnMetricsInput {
  startKm: Prisma.Decimal | number | string;
  endKm: Prisma.Decimal | number | string;
  departureAt: Date;
  returnAt: Date;
}

export interface ReturnMetrics {
  kmDriven: number;
  totalDurationMinutes: number;
  avgSpeedKmh: number;
}

// Cálculos do retorno - seção 4.4
export function calculateReturnMetrics({
  startKm,
  endKm,
  departureAt,
  returnAt,
}: ReturnMetricsInput): ReturnMetrics {
  const start = new Prisma.Decimal(startKm);
  const end = new Prisma.Decimal(endKm);

  if (end.lessThan(start)) {
    throw new UnprocessableEntityException(
      'O KM final não pode ser menor que o KM inicial.',
    );
  }

  const kmDriven = end.minus(start);
  const totalDurationMinutes = Math.max(
    0,
    Math.round((returnAt.getTime() - departureAt.getTime()) / 60_000),
  );
  const avgSpeedKmh =
    totalDurationMinutes > 0
      ? kmDriven.dividedBy(totalDurationMinutes / 60).toNumber()
      : 0;

  return {
    kmDriven: kmDriven.toNumber(),
    totalDurationMinutes,
    avgSpeedKmh,
  };
}
