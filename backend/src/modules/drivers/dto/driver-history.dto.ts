import { ApiProperty } from '@nestjs/swagger';

// Estrutura placeholder - será populada conforme as Fases 4 (viagens),
// 5 (abastecimentos) e 7 (ocorrências) forem implementadas.
export class DriverHistoryDto {
  @ApiProperty({ type: [Object], example: [] })
  trips: unknown[];

  @ApiProperty({ type: [Object], example: [] })
  fuelRecords: unknown[];

  @ApiProperty({ type: [Object], example: [] })
  incidents: unknown[];
}
