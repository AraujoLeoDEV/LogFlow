import { IsNotEmpty, IsString } from 'class-validator';

export class MarkReadDto {
  @IsString()
  @IsNotEmpty({ message: 'O id da sala é obrigatório.' })
  roomId: string;
}
