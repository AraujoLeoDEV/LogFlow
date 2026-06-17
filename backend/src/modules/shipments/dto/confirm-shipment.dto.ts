import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmShipmentDto {
  @ApiPropertyOptional({
    description: 'Observação registrada na confirmação de recebimento.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
