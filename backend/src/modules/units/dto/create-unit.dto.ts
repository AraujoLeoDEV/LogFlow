import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'Filial Centro' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;

  @ApiProperty({ example: 'Rua Principal, 123 - Centro' })
  @IsString()
  @IsNotEmpty({ message: 'O endereço é obrigatório.' })
  address: string;

  @ApiPropertyOptional({
    description:
      'Telefone/WhatsApp da unidade (com DDD), usado para compartilhamento de envios.',
    example: '11987654321',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Indica se a unidade está ativa.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
