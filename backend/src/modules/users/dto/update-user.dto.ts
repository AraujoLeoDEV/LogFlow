import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'Ativa ou desativa o acesso do usuário ao sistema.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
