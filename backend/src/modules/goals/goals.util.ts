import { GoalStatus, Prisma } from '../../../generated/prisma/client';

export interface PeriodRange {
  start: Date;
  end: Date;
}

// Converte um período "YYYY-MM" no intervalo de datas (início e fim do mês)
// correspondente - seção 4.13.
export function getPeriodRange(period: string): PeriodRange {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// Indica se o período "YYYY-MM" já foi encerrado (mês corrente em diante
// ainda não tem dados completos para apuração) - seção 4.13.
export function isPeriodClosed(period: string, now = new Date()): boolean {
  return getPeriodRange(period).end <= now;
}

export interface GoalEvaluation {
  status: GoalStatus;
  commissionValue: Prisma.Decimal | null;
}

// Valor de comissão (R$) pago por cada km/L de consumo médio acima da meta -
// seção 4.13.
export const COMMISSION_PER_KML_ABOVE_TARGET = 50;

// Avalia o resultado de uma meta de redução de consumo, comparando o consumo
// médio real (km/L) apurado no período com a meta definida e calculando a
// comissão devida quando a meta é atingida ou superada - seção 4.13.
export function evaluateGoal(
  targetValue: Prisma.Decimal,
  actualValue: Prisma.Decimal | null,
): GoalEvaluation {
  if (actualValue === null) {
    return { status: GoalStatus.ABERTA, commissionValue: null };
  }

  if (actualValue.greaterThanOrEqualTo(targetValue)) {
    return {
      status: GoalStatus.ATINGIDA,
      commissionValue: actualValue
        .minus(targetValue)
        .times(COMMISSION_PER_KML_ABOVE_TARGET),
    };
  }

  return {
    status: GoalStatus.NAO_ATINGIDA,
    commissionValue: new Prisma.Decimal(0),
  };
}
