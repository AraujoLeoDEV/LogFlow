import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';

import { PrismaService } from '../../prisma/prisma.service';
import { AlertsMailerService } from '../alerts/alerts-mailer.service';
import { buildDateRangeFilter } from '../../common/utils/date-range.util';
import { paginate, PaginatedResult } from '../../common/utils/pagination.util';
import {
  AlertSeverity,
  AlertType,
  Prisma,
  Role,
  Shipment,
  ShipmentFile,
  ShipmentFileType,
  ShipmentItem,
  ShipmentPriority,
  ShipmentReceipt,
  ShipmentStatus,
  ShipmentStatusHistory,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { ConfirmShipmentDto } from './dto/confirm-shipment.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  GENERATE_SHIPMENT_PDF_JOB,
  SHIPMENT_PDF_QUEUE,
} from './shipment-pdf.constants';
import {
  buildProtocolNumber,
  formatProtocolDate,
  isFinalShipmentStatus,
  isValidShipmentTransition,
} from './shipments.util';

type ShipmentRecord = Shipment & {
  destinationUnit: { id: string; name: string; phone: string | null };
  originUnit: { id: string; name: string } | null;
  sender: { id: string; name: string };
  transporter: { id: string; name: string } | null;
  items: ShipmentItem[];
  files: ShipmentFile[];
  receipt:
    | (ShipmentReceipt & { confirmedByUser: { id: string; name: string } })
    | null;
};

export type ShipmentWithRelations = ShipmentRecord;

export interface ShipmentWithTimeline extends ShipmentWithRelations {
  statusHistory: ShipmentStatusHistory[];
}

export interface ShipmentMonitoringItem extends ShipmentWithRelations {
  hoursWaiting: number;
  overdue: boolean;
}

const URGENT_OVERDUE_HOURS = 24;
const MS_PER_HOUR = 3_600_000;

export const shipmentInclude = {
  destinationUnit: { select: { id: true, name: true, phone: true } },
  originUnit: { select: { id: true, name: true } },
  sender: { select: { id: true, name: true } },
  transporter: { select: { id: true, name: true } },
  items: true,
  files: true,
  receipt: {
    include: { confirmedByUser: { select: { id: true, name: true } } },
  },
} as const;

const STORAGE_PATH =
  process.env.SHIPMENT_PDF_STORAGE_PATH ?? './storage/shipments';

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SHIPMENT_PDF_QUEUE) private readonly pdfQueue: Queue,
    private readonly mailer: AlertsMailerService,
  ) {}

  // Criação de envio com protocolo único gerado de forma atômica - seção 4.9.
  // CONFERENTE pode criar envios: originUnitId é auto-derivado da sua unitId
  // e não pode ser sobrescrito pelo DTO.
  async create(
    dto: CreateShipmentDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    let resolvedOriginUnitId = dto.originUnitId;

    if (user.role === Role.CONFERENTE) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { unitId: true },
      });
      if (!dbUser?.unitId) {
        throw new ForbiddenException(
          'Usuário Conferente não está vinculado a nenhuma unidade.',
        );
      }
      resolvedOriginUnitId = dbUser.unitId;
    }

    const destinationUnit = await this.prisma.unit.findFirst({
      where: { id: dto.destinationUnitId, active: true },
    });

    if (!destinationUnit) {
      throw new BadRequestException('Unidade de destino informada não existe.');
    }

    if (resolvedOriginUnitId) {
      const originUnit = await this.prisma.unit.findFirst({
        where: { id: resolvedOriginUnitId, active: true },
      });

      if (!originUnit) {
        throw new BadRequestException(
          'Unidade de origem informada não existe.',
        );
      }
    }

    if (dto.transporterId) {
      await this.ensureDriverExists(dto.transporterId);
    }

    const protocolNumber = await this.generateProtocolNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          protocolNumber,
          destinationUnitId: dto.destinationUnitId,
          originUnitId: resolvedOriginUnitId,
          shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : undefined,
          items: {
            create: dto.items.map((item) => ({
              description: item.description,
              category: item.category,
              quantity: item.quantity,
              unit: item.unit,
              notes: item.notes,
            })),
          },
          senderId: user.sub,
          transporterId: dto.transporterId,
          observations: dto.observations,
          status: ShipmentStatus.PENDENTE,
          priority: dto.priority,
          createdBy: user.sub,
        },
        include: shipmentInclude,
      });

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: shipment.id,
          status: ShipmentStatus.PENDENTE,
          changedBy: user.sub,
        },
      });

      return shipment;
    });

    void this.notifyShipmentCreated(created);

    return created;
  }

  // Faz upload de uma foto para o envio e registra como ShipmentFile (PHOTO).
  async uploadPhoto(
    id: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<ShipmentFile> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    if (user.role === Role.CONFERENTE) {
      const unitId = await this.getConferenteUnitId(user);
      if (
        shipment.originUnitId !== unitId &&
        shipment.destinationUnitId !== unitId
      ) {
        throw new ForbiddenException('Você não tem acesso a este envio.');
      }
    }

    const storagePath = STORAGE_PATH;
    if (!existsSync(storagePath)) {
      mkdirSync(storagePath, { recursive: true });
    }

    return this.prisma.shipmentFile.create({
      data: {
        shipmentId: id,
        type: ShipmentFileType.PHOTO,
        filePath: file.path,
        publicToken: randomBytes(16).toString('hex'),
      },
    });
  }

  // Listagem com filtros por status, unidade de destino e período - seção 4.9.
  // Usuários Conferente veem envios destinados à sua unidade OU enviados por ela.
  async findAll(
    query: ShipmentQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<ShipmentWithRelations>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ShipmentWhereInput = {
      status: query.status,
      destinationUnitId: query.destinationUnitId,
    };

    if (user.role === Role.CONFERENTE) {
      const unitId = await this.getConferenteUnitId(user);
      delete (where as Record<string, unknown>).destinationUnitId;
      where.OR = [{ destinationUnitId: unitId }, { originUnitId: unitId }];
      if (query.status) {
        where.status = query.status;
      }
    }

    const dateFilter = buildDateRangeFilter(query.from, query.to);
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: shipmentInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return paginate(shipments, total, page, limit);
  }

  // Detalhe + timeline completa pelo número de protocolo - seção 4.9.
  // Usuários Conferente só podem acessar envios destinados à sua unidade.
  async findByProtocolNumber(
    protocolNumber: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithTimeline> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { protocolNumber },
      include: {
        ...shipmentInclude,
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    if (user.role === Role.CONFERENTE) {
      const unitId = await this.getConferenteUnitId(user);

      if (
        shipment.destinationUnitId !== unitId &&
        shipment.originUnitId !== unitId
      ) {
        throw new ForbiddenException('Você não tem acesso a este envio.');
      }
    }

    return shipment;
  }

  // Busca um envio pelo id (usado para resolver o link de uma notificação de
  // envio até o protocolo correspondente). Usuários Conferente só podem
  // acessar envios da sua unidade.
  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: shipmentInclude,
    });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    if (user.role === Role.CONFERENTE) {
      const unitId = await this.getConferenteUnitId(user);

      if (
        shipment.destinationUnitId !== unitId &&
        shipment.originUnitId !== unitId
      ) {
        throw new ForbiddenException('Você não tem acesso a este envio.');
      }
    }

    return shipment;
  }

  // Lista envios ainda não confirmados/cancelados para o painel de
  // monitoramento (ADMIN/COORDENACAO), com tempo de espera calculado em
  // memória. Urgente com 24h+ de espera é marcado como `overdue` para o
  // frontend destacar (piscar) o card.
  async findMonitoring(): Promise<ShipmentMonitoringItem[]> {
    const shipments = await this.prisma.shipment.findMany({
      where: {
        status: {
          in: [
            ShipmentStatus.PENDENTE,
            ShipmentStatus.EM_TRANSITO,
            ShipmentStatus.ENTREGUE,
          ],
        },
      },
      orderBy: { shippedAt: 'asc' },
      include: shipmentInclude,
    });

    const now = Date.now();

    return shipments.map((shipment) => {
      const hoursWaiting = Math.max(
        0,
        (now - shipment.shippedAt.getTime()) / MS_PER_HOUR,
      );

      return {
        ...shipment,
        hoursWaiting,
        overdue:
          shipment.priority === ShipmentPriority.URGENTE &&
          hoursWaiting >= URGENT_OVERDUE_HOURS,
      };
    });
  }

  // Atualização de status com validação de transição e registro na timeline
  // (PENDENTE -> EM_TRANSITO -> ENTREGUE, ou CANCELADO a partir de PENDENTE/
  // EM_TRANSITO) - seção 4.9. Ao chegar em ENTREGUE, enfileira a geração do
  // PDF de comprovante.
  async updateStatus(
    id: string,
    dto: UpdateShipmentStatusDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    if (isFinalShipmentStatus(shipment.status)) {
      throw new ConflictException(
        'Este envio já foi finalizado e não pode ser atualizado.',
      );
    }

    if (!isValidShipmentTransition(shipment.status, dto.status)) {
      throw new UnprocessableEntityException(
        `Transição de status inválida: ${shipment.status} -> ${dto.status}.`,
      );
    }

    if (dto.transporterId) {
      await this.ensureDriverExists(dto.transporterId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.shipment.update({
        where: { id },
        data: {
          status: dto.status,
          transporterId: dto.transporterId ?? shipment.transporterId,
        },
        include: shipmentInclude,
      });

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: id,
          status: dto.status,
          changedBy: user.sub,
          notes: dto.notes,
        },
      });

      return result;
    });

    if (dto.status === ShipmentStatus.ENTREGUE) {
      await this.enqueuePdfGeneration(id);
    }

    return updated;
  }

  // Confirmação de recebimento pelo Conferente da unidade de destino (ou
  // ADMIN/COORDENACAO) - seção do módulo de envios. Gera ShipmentReceipt,
  // muda o status para CONFIRMADO e registra na timeline.
  async confirmReceipt(
    id: string,
    dto: ConfirmShipmentDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ): Promise<ShipmentWithRelations> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    if (
      shipment.status === ShipmentStatus.CONFIRMADO ||
      shipment.status === ShipmentStatus.CANCELADO
    ) {
      throw new ConflictException(
        'Este envio não pode ter o recebimento confirmado no status atual.',
      );
    }

    if (user.role === Role.CONFERENTE) {
      const unitId = await this.getConferenteUnitId(user);

      if (shipment.destinationUnitId !== unitId) {
        throw new ForbiddenException('Você não tem acesso a este envio.');
      }
    }

    const wasDelivered = shipment.status === ShipmentStatus.ENTREGUE;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (!wasDelivered) {
        await tx.shipment.update({
          where: { id },
          data: { status: ShipmentStatus.ENTREGUE },
        });

        await tx.shipmentStatusHistory.create({
          data: {
            shipmentId: id,
            status: ShipmentStatus.ENTREGUE,
            changedBy: user.sub,
            notes: 'Marcado como entregue ao confirmar o recebimento.',
          },
        });
      }

      await tx.shipmentReceipt.create({
        data: {
          shipmentId: id,
          confirmedBy: user.sub,
          notes: dto.notes,
          ipAddress,
        },
      });

      const result = await tx.shipment.update({
        where: { id },
        data: { status: ShipmentStatus.CONFIRMADO },
        include: shipmentInclude,
      });

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: id,
          status: ShipmentStatus.CONFIRMADO,
          changedBy: user.sub,
          notes: dto.notes,
        },
      });

      return result;
    });

    if (!wasDelivered) {
      await this.enqueuePdfGeneration(id);
    }

    return updated;
  }

  // Edição de itens, observações e/ou transportador de um envio já existente
  // - restrita a ADMIN/COORDENACAO pelo controller. Envios CONFIRMADOS podem
  // ser editados (ex.: correção de erros de lançamento), mas a alteração é
  // registrada na timeline (ShipmentStatusHistory) para fins de auditoria.
  // Envios CANCELADOS não podem ser editados.
  async update(
    id: string,
    dto: UpdateShipmentDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    if (shipment.status === ShipmentStatus.CANCELADO) {
      throw new ConflictException('Envios cancelados não podem ser editados.');
    }

    if (dto.transporterId) {
      await this.ensureDriverExists(dto.transporterId);
    }

    const changes: string[] = [];
    if (dto.items) changes.push('itens');
    if (
      dto.observations !== undefined &&
      dto.observations !== (shipment.observations ?? '')
    ) {
      changes.push('observações');
    }
    if (
      dto.transporterId !== undefined &&
      dto.transporterId !== shipment.transporterId
    ) {
      changes.push('transportador');
    }
    if (dto.priority !== undefined && dto.priority !== shipment.priority) {
      changes.push('criticidade');
    }

    if (changes.length === 0) {
      const current = await this.prisma.shipment.findUnique({
        where: { id },
        include: shipmentInclude,
      });
      return current as ShipmentWithRelations;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.shipmentItem.deleteMany({ where: { shipmentId: id } });
      }

      const result = await tx.shipment.update({
        where: { id },
        data: {
          observations: dto.observations,
          transporterId: dto.transporterId,
          priority: dto.priority,
          ...(dto.items
            ? {
                items: {
                  create: dto.items.map((item) => ({
                    description: item.description,
                    category: item.category,
                    quantity: item.quantity,
                    unit: item.unit,
                    notes: item.notes,
                  })),
                },
              }
            : {}),
        },
        include: shipmentInclude,
      });

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: id,
          status: shipment.status,
          changedBy: user.sub,
          notes: `Envio editado (${changes.join(', ')}).`,
        },
      });

      return result;
    });
  }

  // Exclusão definitiva - somente ADMIN. Itens, arquivos, recibo e timeline
  // cascateiam via FK (onDelete: Cascade). O delete no banco roda primeiro:
  // se falhar, nenhum arquivo físico é tocado e nada fica órfão.
  async remove(id: string): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    await this.prisma.shipment.delete({ where: { id } });

    for (const file of shipment.files) {
      if (existsSync(file.filePath)) {
        unlinkSync(file.filePath);
      }
    }
  }

  // Lista os arquivos (ex.: PDF de comprovante) gerados para o envio.
  // Usuários Conferente só podem acessar arquivos de envios destinados à sua
  // unidade.
  async listFiles(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentFile[]> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado.');
    }

    if (user.role === Role.CONFERENTE) {
      const unitId = await this.getConferenteUnitId(user);

      if (shipment.destinationUnitId !== unitId) {
        throw new ForbiddenException('Você não tem acesso a este envio.');
      }
    }

    return shipment.files;
  }

  // Busca um arquivo de envio pelo token público, usado no endpoint de
  // download (@Public()).
  async findFileByPublicToken(token: string): Promise<ShipmentFile> {
    const file = await this.prisma.shipmentFile.findUnique({
      where: { publicToken: token },
    });

    if (!file) {
      throw new NotFoundException('Arquivo não encontrado.');
    }

    return file;
  }

  // Cria alertas (sino) e envia e-mails para COORDENACAO e usuários da unidade
  // de destino quando um novo envio é criado.
  private async notifyShipmentCreated(
    shipment: ShipmentWithRelations,
  ): Promise<void> {
    try {
      const destUnit = shipment.destinationUnit;
      const message =
        `Novo envio criado: protocolo ${shipment.protocolNumber}` +
        ` com destino para ${destUnit.name}.`;

      const now = new Date();

      const destUsers = await this.prisma.user.findMany({
        where: {
          unitId: destUnit.id,
          isActive: true,
          deletedAt: null,
          id: { not: shipment.senderId },
        },
        select: { id: true, email: true, name: true },
      });

      const coordUsers = await this.prisma.user.findMany({
        where: {
          role: Role.COORDENACAO,
          isActive: true,
          deletedAt: null,
          id: { not: shipment.senderId },
        },
        select: { id: true, email: true },
      });

      const alertData = [
        ...coordUsers.map((u) => ({
          type: AlertType.SHIPMENT_CREATED,
          referenceType: 'SHIPMENT' as const,
          referenceId: shipment.id,
          message,
          severity: AlertSeverity.INFO,
          dueDate: now,
          targetRole: null as Role | null,
          targetUserId: u.id,
        })),
        ...destUsers.map((u) => ({
          type: AlertType.SHIPMENT_CREATED,
          referenceType: 'SHIPMENT' as const,
          referenceId: shipment.id,
          message,
          severity: AlertSeverity.INFO,
          dueDate: now,
          targetRole: null as Role | null,
          targetUserId: u.id,
        })),
      ];

      await this.prisma.alert.createMany({
        data: alertData,
        skipDuplicates: true,
      });

      if (this.mailer.isEnabled()) {
        const emailTargets = [
          ...coordUsers.map((u) => u.email),
          ...destUsers.map((u) => u.email),
        ].filter((e) => !!e);

        const uniqueEmails = [...new Set(emailTargets)] as string[];

        await Promise.allSettled(
          uniqueEmails.map((email) =>
            this.mailer.sendAlertEmail(
              email,
              `Novo envio criado — Protocolo ${shipment.protocolNumber}`,
              message,
            ),
          ),
        );
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao notificar criação do envio ${shipment.protocolNumber}: ${(err as Error).message}`,
      );
    }
  }

  // Enfileira a geração assíncrona do PDF de comprovante do envio.
  private async enqueuePdfGeneration(shipmentId: string): Promise<void> {
    await this.pdfQueue.add(GENERATE_SHIPMENT_PDF_JOB, { shipmentId });
  }

  // Resolve a unidade vinculada ao usuário Conferente autenticado.
  private async getConferenteUnitId(user: AuthenticatedUser): Promise<string> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { unitId: true },
    });

    if (!dbUser?.unitId) {
      throw new ForbiddenException(
        'Usuário Conferente não está vinculado a nenhuma unidade.',
      );
    }

    return dbUser.unitId;
  }

  // Gera o número de protocolo no formato AAAAMMDD-SEQ de forma atômica via
  // INSERT ... ON CONFLICT DO UPDATE (seguro sob concorrência) - seção 4.9
  private async generateProtocolNumber(): Promise<string> {
    const now = new Date();
    const dateKey = formatProtocolDate(now);

    const result = await this.prisma.$queryRaw<{ lastSeq: number }[]>`
      INSERT INTO protocol_counters (date, last_seq)
      VALUES (${dateKey}, 1)
      ON CONFLICT (date) DO UPDATE SET last_seq = protocol_counters.last_seq + 1
      RETURNING last_seq AS "lastSeq"
    `;

    return buildProtocolNumber(now, result[0].lastSeq);
  }

  private async ensureDriverExists(driverId: string): Promise<void> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, deletedAt: null },
    });

    if (!driver) {
      throw new BadRequestException(
        'Motorista (transportador) informado não existe.',
      );
    }
  }
}
