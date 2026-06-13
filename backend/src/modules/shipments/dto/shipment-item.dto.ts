import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ShipmentItemDto {
  @ApiProperty({ description: 'Descrição do item enviado.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a descrição do item.' })
  description: string;

  @ApiProperty({ description: 'Quantidade do item.', example: 1 })
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade deve ser maior que zero.' })
  quantity: number;
}
