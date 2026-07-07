import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateDailyLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { message: 'Veículo inválido.' })
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { message: 'Motorista inválido.' })
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { message: 'Rota inválida.' })
  routeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Data/hora de saída inválida.' })
  departureAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: 'KM inicial inválido.' })
  @Min(0, { message: 'O KM inicial não pode ser negativo.' })
  startKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}
