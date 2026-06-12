import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;

  @ApiProperty({ example: 'Motorista' })
  @IsString()
  @IsNotEmpty({ message: 'O cargo/função é obrigatório.' })
  position: string;

  @ApiPropertyOptional({ description: 'Id do veículo vinculado ao motorista.' })
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional({ example: 0, description: 'KM atual do motorista.' })
  @IsOptional()
  @Min(0, { message: 'O KM atual não pode ser negativo.' })
  currentKm?: number;

  @ApiPropertyOptional({ description: 'Id da rota padrão do motorista.' })
  @IsOptional()
  @IsUUID('all', { message: 'Rota padrão inválida.' })
  defaultRouteId?: string;

  @ApiPropertyOptional({ description: 'Data de vencimento da CNH.' })
  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento da CNH inválida.' })
  cnhExpiration?: string;

  @ApiPropertyOptional({
    description:
      'Id do usuário vinculado (perfil MOTORISTA) para login do motorista.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Usuário inválido.' })
  userId?: string;

  @ApiPropertyOptional({ description: 'Indica se o motorista está ativo.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
