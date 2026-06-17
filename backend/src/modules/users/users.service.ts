import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PasswordService } from '../../common/utils/password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  unitId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const passwordHash = await this.passwordService.hash(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
          unitId: dto.unitId,
        },
        select: USER_SELECT,
      });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  findAll(): Promise<UserResponseDto[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.findOne(id);

    const data: Prisma.UserUncheckedUpdateInput = {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      unitId: dto.unitId,
      isActive: dto.isActive,
    };

    if (dto.password) {
      data.passwordHash = await this.passwordService.hash(dto.password);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: USER_SELECT,
      });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private toFriendlyError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Já existe um usuário cadastrado com este e-mail.',
      );
    }

    return error;
  }
}
