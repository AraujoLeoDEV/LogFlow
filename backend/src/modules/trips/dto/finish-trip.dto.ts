import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Min } from 'class-validator';

export class FinishTripDto {
  @ApiProperty({ example: 1050, description: 'KM de devolução do veículo.' })
  @Min(0, { message: 'O KM de devolução não pode ser negativo.' })
  endKm: number;

  @ApiPropertyOptional({
    description: 'Data/hora de encerramento da viagem. Padrão: agora.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data/hora de encerramento inválida.' })
  finishedAt?: string;
}
