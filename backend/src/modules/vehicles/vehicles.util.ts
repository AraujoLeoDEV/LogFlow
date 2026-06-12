import { BadRequestException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';

interface DepreciationInput {
  acquisitionValue: Prisma.Decimal | number | string;
  residualValue: Prisma.Decimal | number | string;
  usefulLifeMonths: number;
}

// Depreciação mensal linear - seção 4.3
export function calculateMonthlyDepreciation({
  acquisitionValue,
  residualValue,
  usefulLifeMonths,
}: DepreciationInput): number {
  if (usefulLifeMonths <= 0) {
    throw new BadRequestException(
      'A vida útil do veículo deve ser maior que zero para calcular a depreciação.',
    );
  }

  const acquisition = new Prisma.Decimal(acquisitionValue);
  const residual = new Prisma.Decimal(residualValue);

  return acquisition.minus(residual).dividedBy(usefulLifeMonths).toNumber();
}
