import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import { IsVehiclePlate } from '../../../common/validators/vehicle-plate.validator';
import { FuelType } from '../../../../generated/prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC1D23' })
  @IsString()
  @IsNotEmpty({ message: 'A placa é obrigatória.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  @IsVehiclePlate()
  plate: string;

  @ApiProperty({ example: 'Fiat Strada' })
  @IsString()
  @IsNotEmpty({ message: 'O modelo é obrigatório.' })
  model: string;

  @ApiProperty({ enum: FuelType, example: FuelType.FLEX })
  @IsEnum(FuelType, { message: 'Tipo de combustível inválido.' })
  fuelType: FuelType;

  @ApiProperty({ example: 60, description: 'Capacidade do tanque em litros.' })
  @IsPositive({ message: 'A capacidade do tanque deve ser maior que zero.' })
  tankCapacityLiters: number;

  @ApiProperty({ example: 2022 })
  @IsInt({ message: 'O ano/modelo deve ser um número inteiro.' })
  @Min(1950, { message: 'O ano/modelo informado é inválido.' })
  yearModel: number;

  @ApiPropertyOptional({ description: 'Id da rota principal do veículo.' })
  @IsOptional()
  @IsUUID('all', { message: 'Rota principal inválida.' })
  mainRouteId?: string;

  @ApiProperty({
    example: 120000,
    description: 'Valor de aquisição do veículo.',
  })
  @IsPositive({ message: 'O valor de aquisição deve ser maior que zero.' })
  acquisitionValue: number;

  @ApiProperty({ example: 48, description: 'Vida útil estimada em meses.' })
  @IsInt({ message: 'A vida útil deve ser um número inteiro de meses.' })
  @IsPositive({ message: 'A vida útil deve ser maior que zero.' })
  usefulLifeMonths: number;

  @ApiProperty({ example: 30000, description: 'Valor residual estimado.' })
  @Min(0, { message: 'O valor residual não pode ser negativo.' })
  residualValue: number;

  @ApiPropertyOptional({ example: 0, description: 'KM atual do veículo.' })
  @IsOptional()
  @Min(0, { message: 'O KM atual não pode ser negativo.' })
  currentKm?: number;

  @ApiPropertyOptional({ description: 'Data de vencimento do licenciamento.' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de vencimento do licenciamento inválida.' },
  )
  licensingExpiration?: string;

  @ApiPropertyOptional({ description: 'Data de vencimento do seguro.' })
  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento do seguro inválida.' })
  insuranceExpiration?: string;

  @ApiPropertyOptional({ description: 'Indica se o veículo está ativo.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
