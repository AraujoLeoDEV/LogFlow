import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Goal,
  GoalStatus,
  GoalType,
  Prisma,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalQueryDto } from './dto/goal-query.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { evaluateGoal, getPeriodRange, isPeriodClosed } from './goals.util';

const DEFAULT_GOALS_CRON_EXPRESSION = '0 7 1 * *';

export interface GoalWithRelations extends Goal {
  driver: { id: string; name: string } | null;
  vehicle: { id: string; plate: string } | null;
}

export interface GoalRankingEntry {
  goalId: string;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  type: GoalType;
  targetValue: number;
  actualValue: number | null;
  difference: number | null;
  status: GoalStatus;
  commissionValue: number | null;
}

const goalInclude = {
  driver: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true } },
} as const;

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Criação de meta - seção 4.13. Exige exatamente um entre motorista e
  // veículo. Se o período informado já estiver encerrado, apura o
  // resultado imediatamente.
  async create(
    dto: CreateGoalDto,
    user: AuthenticatedUser,
  ): Promise<GoalWithRelations> {
    if (!dto.driverId && !dto.vehicleId) {
      throw new BadRequestException(
        'Informe o motorista ou o veículo da meta.',
      );
    }

    if (dto.driverId && dto.vehicleId) {
      throw new BadRequestException(
        'Informe apenas o motorista ou o veículo da meta, não ambos.',
      );
    }

    if (dto.driverId) {
      await this.assertDriverExists(dto.driverId);
    }

    if (dto.vehicleId) {
      await this.assertVehicleExists(dto.vehicleId);
    }

    const created = await this.prisma.goal.create({
      data: {
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        type: dto.type,
        period: dto.period,
        targetValue: dto.targetValue,
        createdBy: user.sub,
        updatedBy: user.sub,
      },
    });

    if (isPeriodClosed(created.period)) {
      return this.recalculateGoal(created.id);
    }

    return this.findOne(created.id);
  }

  // Listagem com filtros - seção 4.13
  async findAll(query: GoalQueryDto): Promise<GoalWithRelations[]> {
    const where: Prisma.GoalWhereInput = {
      driverId: query.driverId,
      vehicleId: query.vehicleId,
      period: query.period,
      type: query.type,
      status: query.status,
    };

    return this.prisma.goal.findMany({
      where,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: goalInclude,
    });
  }

  async findOne(id: string): Promise<GoalWithRelations> {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: goalInclude,
    });

    if (!goal) {
      throw new NotFoundException('Meta não encontrada.');
    }

    return goal;
  }

  // Atualização de meta - seção 4.13. Trocar motorista/veículo limpa o
  // outro vínculo, mantendo a regra de exatamente um vínculo por meta.
  async update(
    id: string,
    dto: UpdateGoalDto,
    user: AuthenticatedUser,
  ): Promise<GoalWithRelations> {
    const existing = await this.prisma.goal.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Meta não encontrada.');
    }

    let driverId = existing.driverId;
    let vehicleId = existing.vehicleId;

    if (dto.driverId !== undefined) {
      driverId = dto.driverId;
      vehicleId = null;
      await this.assertDriverExists(driverId);
    }

    if (dto.vehicleId !== undefined) {
      vehicleId = dto.vehicleId;
      driverId = null;
      await this.assertVehicleExists(vehicleId);
    }

    if (!driverId && !vehicleId) {
      throw new BadRequestException(
        'Informe o motorista ou o veículo da meta.',
      );
    }

    const updated = await this.prisma.goal.update({
      where: { id },
      data: {
        driverId,
        vehicleId,
        type: dto.type,
        period: dto.period,
        targetValue: dto.targetValue,
        updatedBy: user.sub,
      },
    });

    if (isPeriodClosed(updated.period)) {
      return this.recalculateGoal(updated.id);
    }

    return this.findOne(updated.id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.goal.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Meta não encontrada.');
    }

    await this.prisma.goal.delete({ where: { id } });
  }

  // Apura o valor real (consumo médio em km/L no período) e recalcula
  // status/comissão da meta - seção 4.13.
  async recalculateGoal(id: string): Promise<GoalWithRelations> {
    const goal = await this.prisma.goal.findUnique({ where: { id } });

    if (!goal) {
      throw new NotFoundException('Meta não encontrada.');
    }

    const actualValue = await this.calculateActualValue(goal);
    const { status, commissionValue } = evaluateGoal(
      goal.targetValue,
      actualValue,
    );

    return this.prisma.goal.update({
      where: { id },
      data: { actualValue, status, commissionValue },
      include: goalInclude,
    });
  }

  // Job mensal - seção 4.13: recalcula metas ABERTA cujo período já tenha
  // se encerrado, apurando o resultado real e a comissão devida.
  @Cron(process.env.GOALS_CRON_EXPRESSION || DEFAULT_GOALS_CRON_EXPRESSION)
  async recalculateClosedGoals(): Promise<number> {
    const openGoals = await this.prisma.goal.findMany({
      where: { status: GoalStatus.ABERTA },
    });

    let updated = 0;

    for (const goal of openGoals) {
      if (isPeriodClosed(goal.period)) {
        await this.recalculateGoal(goal.id);
        updated += 1;
      }
    }

    this.logger.log(`Job de metas: ${updated} meta(s) recalculada(s).`);

    return updated;
  }

  // Ranking real vs. meta por motorista/veículo - seção 4.13. Ordenado
  // pela maior diferença (real - meta), metas sem apuração ficam por
  // último.
  async getRanking(period: string): Promise<GoalRankingEntry[]> {
    const goals = await this.prisma.goal.findMany({
      where: { period },
      include: goalInclude,
    });

    const entries: GoalRankingEntry[] = goals.map((goal) => {
      const actualValue = goal.actualValue ? goal.actualValue.toNumber() : null;
      const targetValue = goal.targetValue.toNumber();

      return {
        goalId: goal.id,
        driverId: goal.driverId,
        driverName: goal.driver?.name ?? null,
        vehicleId: goal.vehicleId,
        vehiclePlate: goal.vehicle?.plate ?? null,
        type: goal.type,
        targetValue,
        actualValue,
        difference: actualValue !== null ? actualValue - targetValue : null,
        status: goal.status,
        commissionValue: goal.commissionValue
          ? goal.commissionValue.toNumber()
          : null,
      };
    });

    return entries.sort((a, b) => {
      if (a.difference === null) return 1;
      if (b.difference === null) return -1;
      return b.difference - a.difference;
    });
  }

  private async calculateActualValue(
    goal: Goal,
  ): Promise<Prisma.Decimal | null> {
    const { start, end } = getPeriodRange(goal.period);

    const where: Prisma.FuelWhereInput = {
      date: { gte: start, lte: end },
      consumptionKmL: { not: null },
      ...(goal.driverId ? { driverId: goal.driverId } : {}),
      ...(goal.vehicleId ? { vehicleId: goal.vehicleId } : {}),
    };

    const records = await this.prisma.fuel.findMany({
      where,
      select: { consumptionKmL: true },
    });

    if (records.length === 0) {
      return null;
    }

    const sum = records.reduce(
      (acc, record) => acc.plus(record.consumptionKmL as Prisma.Decimal),
      new Prisma.Decimal(0),
    );

    return sum.dividedBy(records.length);
  }

  private async assertDriverExists(driverId: string): Promise<void> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, deletedAt: null },
    });

    if (!driver) {
      throw new BadRequestException('Motorista informado não existe.');
    }
  }

  private async assertVehicleExists(vehicleId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    });

    if (!vehicle) {
      throw new BadRequestException('Veículo informado não existe.');
    }
  }
}
