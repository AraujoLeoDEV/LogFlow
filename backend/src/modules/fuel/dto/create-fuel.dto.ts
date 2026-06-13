import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID, Min } from 'class-validator';

import { FuelType } from '../../../../generated/prisma/client';

export class CreateFuelDto {
  @ApiProperty({ description: 'Id do veículo abastecido.' })
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId: string;

  @ApiPropertyOptional({
    description:
      'Id do motorista responsável. Obrigatório para ADMIN/COORDENACAO; motoristas usam o próprio registro automaticamente.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiProperty({
    example: 40,
    description: 'Quantidade de litros abastecidos.',
  })
  @Min(0.01, { message: 'A quantidade de litros deve ser maior que zero.' })
  liters: number;

  @ApiProperty({
    example: 250,
    description: 'Valor total pago no abastecimento.',
  })
  @Min(0, { message: 'O valor pago não pode ser negativo.' })
  amountPaid: number;

  @ApiProperty({
    example: 15400,
    description: 'KM do veículo no momento do abastecimento.',
  })
  @Min(0, { message: 'O KM atual não pode ser negativo.' })
  currentKm: number;

  @ApiProperty({
    enum: FuelType,
    description: 'Tipo de combustível abastecido.',
  })
  @IsEnum(FuelType, { message: 'Tipo de combustível inválido.' })
  fuelType: FuelType;

  @ApiPropertyOptional({
    description: 'Data/hora do abastecimento. Padrão: agora.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data/hora do abastecimento inválida.' })
  date?: string;
}
