import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateTripDto {
  @ApiProperty({ description: 'Id do veículo utilizado na viagem.' })
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

  @ApiProperty({ description: 'Destino da viagem.' })
  @MinLength(1, { message: 'Informe o destino da viagem.' })
  destination: string;

  @ApiPropertyOptional({
    description: 'Data/hora de início da viagem. Padrão: agora.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data/hora de início inválida.' })
  startedAt?: string;
}
