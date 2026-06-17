import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

import { Role } from '../../../../generated/prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;

  @ApiProperty({ example: 'maria.silva@logflow.com' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  password: string;

  @ApiProperty({ enum: Role, example: Role.COORDENACAO })
  @IsEnum(Role, { message: 'Perfil inválido.' })
  role: Role;

  @ApiPropertyOptional({
    description:
      'Id da unidade vinculada ao usuário (obrigatório para o perfil Conferente).',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Unidade inválida.' })
  unitId?: string;
}
