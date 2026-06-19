import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateRouteDto {
  @ApiProperty({ example: 'Rota Centro - Bairro Industrial' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;

  @ApiProperty({
    example: 18.5,
    description: 'Distância estimada em quilômetros.',
  })
  @IsPositive({ message: 'A distância estimada deve ser maior que zero.' })
  estimatedDistanceKm: number;

  @ApiProperty({ example: 45, description: 'Duração estimada em minutos.' })
  @IsInt({
    message: 'A duração estimada deve ser um número inteiro de minutos.',
  })
  @IsPositive({ message: 'A duração estimada deve ser maior que zero.' })
  estimatedDurationMinutes: number;

  @ApiPropertyOptional({ description: 'Indica se a rota está ativa.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
