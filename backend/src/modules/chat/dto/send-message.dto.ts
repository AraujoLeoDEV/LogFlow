import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'O id da sala é obrigatório.' })
  roomId: string;

  @IsString()
  @IsNotEmpty({ message: 'A mensagem não pode ser vazia.' })
  @MaxLength(2000, {
    message: 'A mensagem deve ter no máximo 2000 caracteres.',
  })
  content: string;
}
