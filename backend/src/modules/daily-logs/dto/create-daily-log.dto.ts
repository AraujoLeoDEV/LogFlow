import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateDailyLogDto {
  @ApiProperty({ description: 'Id do veículo que está saindo.' })
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId: string;

  @ApiPropertyOptional({
    description:
      'Id do motorista. Obrigatório para ADMIN/COORDENACAO; motoristas usam o próprio registro automaticamente.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional({
    description:
      'Id da rota. Se não informado, usa a rota padrão do motorista.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Rota inválida.' })
  routeId?: string;

  @ApiPropertyOptional({
    description: 'Data/hora da saída. Padrão: agora.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data/hora de saída inválida.' })
  departureAt?: string;

  @ApiProperty({ example: 1000, description: 'KM inicial do veículo.' })
  @Min(0, { message: 'O KM inicial não pode ser negativo.' })
  startKm: number;

  @ApiPropertyOptional({ description: 'Observações sobre a saída.' })
  @IsOptional()
  @IsString()
  observations?: string;
}
