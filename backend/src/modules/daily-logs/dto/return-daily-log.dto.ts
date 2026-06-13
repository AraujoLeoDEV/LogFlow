import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Min } from 'class-validator';

export class ReturnDailyLogDto {
  @ApiPropertyOptional({
    description: 'Data/hora do retorno. Padrão: agora.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data/hora de retorno inválida.' })
  returnAt?: string;

  @ApiProperty({ example: 1050, description: 'KM final do veículo.' })
  @Min(0, { message: 'O KM final não pode ser negativo.' })
  endKm: number;

  @ApiPropertyOptional({ description: 'Observações sobre o retorno.' })
  @IsOptional()
  @IsString()
  observations?: string;
}
