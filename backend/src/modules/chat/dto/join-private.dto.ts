import { IsNotEmpty, IsString } from 'class-validator';

export class JoinPrivateDto {
  @IsString()
  @IsNotEmpty({ message: 'O id do usuário é obrigatório.' })
  userId: string;
}
