import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RouteStopDto {
  @ApiProperty({ description: 'Nome do ponto de parada.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do ponto de parada.' })
  name: string;
}
