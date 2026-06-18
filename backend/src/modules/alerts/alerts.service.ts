import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Alert,
  AlertStatus,
  DailyLogStatus,
  Prisma,
  Role,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { AlertQueryDto } from './dto/alert-query.dto';
import { AlertsMailerService } from './alerts-mailer.service';
import {
  AlertCandidate,
  buildDriverCnhAlerts,
  buildTripDelayedAlert,
  buildVehicleExpirationAlerts,
  buildVehicleMaintenanceAlerts,
} from './alerts.util';

const DEFAULT_ALERT_CRON_EXPRESSION = '0 6 * * *';

const ALERT_TYPE_LABELS: Record<string, string> = {
  LICENSING: 'Licenciamento',
  INSURANCE: 'Seguro',
  CNH: 'CNH',
  REVIEW: 'Revisão',
  OIL_CHANGE: 'Troca de óleo',
  TIRE_CHANGE: 'Troca de pneus',
  TRIP_DELAYED: 'Viagem atrasada',
};

export interface GenerateAlertsResult {
  created: number;
  emailed: number;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: AlertsMailerService,
  ) {}

  // Job diário - seção 4.10: verifica vencimentos de licenciamento/seguro/CNH,
  // agenda de manutenção e viagens atrasadas, gera os alertas (idempotente
  // via @@unique no Alert) e envia e-mails pendentes.
  @Cron(process.env.ALERT_CRON_EXPRESSION || DEFAULT_ALERT_CRON_EXPRESSION)
  async generateAlerts(): Promise<GenerateAlertsResult> {
    const candidates = await this.buildCandidates();
    const created = await this.persistCandidates(candidates);
    const emailed = await this.sendPendingEmails();

    this.logger.log(
      `Job de alertas: ${candidates.length} candidato(s) avaliado(s), ${created} novo(s) registrado(s), ${emailed} e-mail(s) enviado(s).`,
    );

    return { created, emailed };
  }

  private async buildCandidates(): Promise<AlertCandidate[]> {
    const now = new Date();
    const candidates: AlertCandidate[] = [];

    const vehicles = await this.prisma.vehicle.findMany({
      where: { deletedAt: null, active: true },
      select: {
        id: true,
        plate: true,
        currentKm: true,
        licensingExpiration: true,
        insuranceExpiration: true,
        nextOilChangeKm: true,
        nextOilChangeDate: true,
        nextTireChangeKm: true,
        nextTireChangeDate: true,
        nextReviewKm: true,
        nextReviewDate: true,
      },
    });

    for (const vehicle of vehicles) {
      const source = {
        id: vehicle.id,
        plate: vehicle.plate,
        currentKm: vehicle.currentKm.toNumber(),
        licensingExpiration: vehicle.licensingExpiration,
        insuranceExpiration: vehicle.insuranceExpiration,
        nextOilChangeKm: vehicle.nextOilChangeKm?.toNumber() ?? null,
        nextOilChangeDate: vehicle.nextOilChangeDate,
        nextTireChangeKm: vehicle.nextTireChangeKm?.toNumber() ?? null,
        nextTireChangeDate: vehicle.nextTireChangeDate,
        nextReviewKm: vehicle.nextReviewKm?.toNumber() ?? null,
        nextReviewDate: vehicle.nextReviewDate,
      };

      candidates.push(...buildVehicleExpirationAlerts(source, now));
      candidates.push(...buildVehicleMaintenanceAlerts(source, now));
    }

    const drivers = await this.prisma.driver.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true, userId: true, cnhExpiration: true },
    });

    for (const driver of drivers) {
      candidates.push(...buildDriverCnhAlerts(driver, now));
    }

    const delayedLogs = await this.prisma.dailyLog.findMany({
      where: { status: DailyLogStatus.ATRASADO },
      include: {
        driver: { select: { name: true, userId: true } },
        vehicle: { select: { plate: true } },
        route: { select: { estimatedDurationMinutes: true } },
      },
    });

    for (const log of delayedLogs) {
      candidates.push(
        buildTripDelayedAlert({
          id: log.id,
          destination: log.destination,
          departureAt: log.departureAt,
          estimatedDurationMinutes: log.route.estimatedDurationMinutes,
          driverName: log.driver.name,
          driverUserId: log.driver.userId,
          vehiclePlate: log.vehicle.plate,
        }),
      );
    }

    return candidates;
  }

  // Insere os alertas gerados, ignorando duplicados (mesma referência,
  // tipo e dueDate) - seção 4.10
  private async persistCandidates(
    candidates: AlertCandidate[],
  ): Promise<number> {
    if (candidates.length === 0) {
      return 0;
    }

    const result = await this.prisma.alert.createMany({
      data: candidates.map((candidate) => ({
        type: candidate.type,
        referenceType: candidate.referenceType,
        referenceId: candidate.referenceId,
        message: candidate.message,
        severity: candidate.severity,
        dueDate: candidate.dueDate,
        targetRole: candidate.targetRole,
        targetUserId: candidate.targetUserId,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  // Envia e-mails para alertas PENDENTE - seção 4.10. Alertas sem
  // destinatário com e-mail cadastrado são marcados ENVIADO (nada a
  // enviar); falhas de envio voltam para PENDENTE para nova tentativa
  // no próximo job (retry implícito).
  //
  // Antes de enviar, cada alerta é "reivindicado" individualmente via
  // updateMany PENDENTE -> ENVIANDO (count=1 confirma que este processo
  // venceu a corrida). Isso evita e-mail duplicado se o job rodar
  // concorrentemente (deploy com múltiplas instâncias, ou execução
  // anterior ainda em andamento).
  private async sendPendingEmails(): Promise<number> {
    if (!this.mailer.isEnabled()) {
      return 0;
    }

    const pending = await this.prisma.alert.findMany({
      where: { status: AlertStatus.PENDENTE },
    });

    let emailed = 0;

    for (const alert of pending) {
      const claimed = await this.prisma.alert.updateMany({
        where: { id: alert.id, status: AlertStatus.PENDENTE },
        data: { status: AlertStatus.ENVIANDO },
      });

      if (claimed.count === 0) {
        // outra execução já reivindicou este alerta
        continue;
      }

      const recipients = await this.resolveRecipients(
        alert.targetRole,
        alert.targetUserId,
      );

      if (recipients.length === 0) {
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { status: AlertStatus.ENVIADO },
        });
        continue;
      }

      const subject = `[Alerta] ${ALERT_TYPE_LABELS[alert.type] ?? alert.type}`;
      const results = await Promise.all(
        recipients.map((email) =>
          this.mailer.sendAlertEmail(email, subject, alert.message),
        ),
      );

      if (results.every(Boolean)) {
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { status: AlertStatus.ENVIADO },
        });
        emailed += 1;
      } else {
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { status: AlertStatus.PENDENTE },
        });
      }
    }

    return emailed;
  }

  private async resolveRecipients(
    targetRole: Role | null,
    targetUserId: string | null,
  ): Promise<string[]> {
    const emails = new Set<string>();

    if (targetRole) {
      const users = await this.prisma.user.findMany({
        where: { role: targetRole, isActive: true, deletedAt: null },
        select: { email: true },
      });
      users.forEach((recipient) => emails.add(recipient.email));
    }

    if (targetUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: targetUserId, isActive: true, deletedAt: null },
        select: { email: true },
      });
      if (user) {
        emails.add(user.email);
      }
    }

    return Array.from(emails);
  }

  // Lista alertas visíveis para o usuário autenticado - seção 4.10. ADMIN
  // vê todos; demais perfis veem apenas alertas direcionados ao seu Role
  // (targetRole) ou a eles diretamente (targetUserId).
  async findAll(
    query: AlertQueryDto,
    user: AuthenticatedUser,
  ): Promise<Alert[]> {
    const where: Prisma.AlertWhereInput = {
      status: query.status,
      ...this.visibilityFilter(user),
    };

    return this.prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Marca um alerta como lido - seção 4.10
  async markAsRead(id: string, user: AuthenticatedUser): Promise<Alert> {
    const alert = await this.prisma.alert.findFirst({
      where: { id, ...this.visibilityFilter(user) },
    });

    if (!alert) {
      throw new NotFoundException('Alerta não encontrado.');
    }

    return this.prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.LIDO },
    });
  }

  private visibilityFilter(user: AuthenticatedUser): Prisma.AlertWhereInput {
    if (user.role === Role.ADMIN) {
      return {};
    }

    return {
      OR: [{ targetRole: user.role }, { targetUserId: user.sub }],
    };
  }
}
