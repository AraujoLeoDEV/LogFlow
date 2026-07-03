import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetHistoryDto {
  @IsString()
  @IsNotEmpty({ message: 'O id da sala é obrigatório.' })
  roomId: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
