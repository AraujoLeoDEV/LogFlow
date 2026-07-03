import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Diretório de usuários pra iniciar uma DM - qualquer usuário autenticado
  // pode ver (não é restrito a ADMIN como GET /users).
  @Get('users')
  @ApiOperation({ summary: 'Lista usuários ativos para iniciar uma conversa' })
  listUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.getDirectoryUsers(user.sub);
  }

  // Contagem inicial de não lidas, usada antes do socket conectar (ex.: ao
  // carregar a página) para já exibir o badge sem esperar o WebSocket.
  @Get('unread-count')
  @ApiOperation({ summary: 'Total de mensagens não lidas do usuário logado' })
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.chatService.getTotalUnread(user.sub);
    return { count };
  }
}
