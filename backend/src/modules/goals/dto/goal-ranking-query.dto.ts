import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class GoalRankingQueryDto {
  @ApiProperty({
    example: '2026-06',
    description: 'Período de referência do ranking (formato AAAA-MM).',
  })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Período inválido. Use o formato AAAA-MM.',
  })
  period: string;
}
