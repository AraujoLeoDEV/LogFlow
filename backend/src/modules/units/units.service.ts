import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Unit } from '../../../generated/prisma/client';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateUnitDto): Promise<Unit> {
    return this.prisma.unit.create({ data: dto });
  }

  findAll(): Promise<Unit[]> {
    return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({ where: { id } });

    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }

    return unit;
  }

  async update(id: string, dto: UpdateUnitDto): Promise<Unit> {
    await this.findOne(id);

    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.unit.update({ where: { id }, data: { active: false } });
  }

  // Exclusão definitiva - somente ADMIN. Diferente de remove() (inativação),
  // apaga o registro de verdade; bloqueada se houver envios vinculados a
  // esta unidade (como origem ou destino) ou usuários vinculados a ela.
  async removePermanently(id: string): Promise<void> {
    await this.findOne(id);

    try {
      await this.prisma.unit.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Não é possível excluir definitivamente: existem envios ou usuários vinculados a esta unidade. Use inativar em vez de excluir.',
        );
      }

      throw error;
    }
  }
}
