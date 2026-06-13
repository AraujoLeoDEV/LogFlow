import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Prisma,
  Shipment,
  ShipmentStatus,
  ShipmentStatusHistory,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  buildProtocolNumber,
  formatProtocolDate,
  isFinalShipmentStatus,
  isValidShipmentTransition,
} from './shipments.util';

export interface ShipmentItem {
  description: string;
  quantity: number;
}

type ShipmentRecord = Shipment & {
  destinationUnit: { id: string; name: string };
  sender: { id: string; name: string };
  transporter: { id: string; name: string } | null;
};

export interface ShipmentWithRelations extends Omit<ShipmentRecord, 'items'> {
  items: ShipmentItem[];
}

export interface ShipmentWithTimeline extends ShipmentWithRelations {
  statusHistory: ShipmentStatusHistory[];
}

const shipmentInclude = {
  destinationUnit: { select: { id: true, name: true } },
  sender: { select: { id: true, name: true } },
  transporter: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Criação de envio com protocolo único gerado de forma atômica - seção 4.9
  async create(
    dto: CreateShipmentDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const destinationUnit = await this.prisma.unit.findFirst({
      where: { id: dto.destinationUnitId, active: true },
    });

    if (!destinationUnit) {
      throw new BadRequestException('Unidade de destino informada não existe.');
    }

    if (dto.transporterId) {
      await this.ensureDriverExists(dto.transporterId);
    }

    const protocolNumber = await this.generateProtocolNumber();

    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          protocolNumber,
          destinationUnitId: dto.destinationUnitId,
          items: dto.items as unknown as Prisma.InputJsonValue,
          senderId: user.sub,
          transporterId: dto.transporterId,
          observations: dto.observations,
          status: ShipmentStatus.PENDENTE,
          createdBy: user.sub,
        },
        include: shipmentInclude,
      });

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: created.id,
          status: ShipmentStatus.PENDENTE,
          changedBy: user.sub,
        },
      });

      return created;
    });

    return this.toShipmentWithRelations(shipment);
  }

  // Listagem com filtros por status, unidade de destino e período - seção 4.9
  async findAll(query: ShipmentQueryDto): Promise<ShipmentWithRelations[]> {
    const where: Prisma.ShipmentWhereInput = {
      status: query.status,
      destinationUnitId: query.destinationUnitId,
    };

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const shipments = await this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: shipmentInclude,
    });

    return shipments.map((shipment) => this.toShipmentWithRelations(shipment));
  }

  // Detalhe + timeline completa pelo número de protocolo - seção 4.9
  async findByProtocolNumber(
    protocolNumber: string,
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

    const { statusHistory, ...rest } = shipment;

    return { ...this.toShipmentWithRelations(rest), statusHistory };
  }

  // Atualização de status com validação de transição e registro na timeline
  // (PENDENTE -> EM_TRANSITO -> ENTREGUE, ou CANCELADO a partir de PENDENTE/
  // EM_TRANSITO) - seção 4.9
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

    return this.toShipmentWithRelations(updated);
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

  private toShipmentWithRelations(
    shipment: ShipmentRecord,
  ): ShipmentWithRelations {
    return {
      ...shipment,
      items: shipment.items as unknown as ShipmentItem[],
    };
  }
}
