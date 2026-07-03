import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Server, Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { ChatService, GENERAL_ROOM_ID } from './chat.service';
import { GetHistoryDto } from './dto/get-history.dto';
import { JoinPrivateDto } from './dto/join-private.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { SendMessageDto } from './dto/send-message.dto';

type UserData = { user: JwtPayload };

function userData(client: Socket): JwtPayload {
  return (client.data as UserData).user;
}

const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: allowedOrigins, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // userId -> quantidade de sockets conectados (1 usuário pode ter +1 aba aberta)
  private readonly onlineUsers = new Map<string, number>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth as { token?: string })?.token;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      (client.data as UserData).user = payload;
    } catch {
      client.disconnect();
      return;
    }

    const userId = userData(client).sub;

    await this.chatService.ensureMembership(GENERAL_ROOM_ID, userId);
    const roomIds = await this.chatService.getUserRoomIds(userId);
    for (const roomId of roomIds) {
      await client.join(roomId);
    }

    this.onlineUsers.set(userId, (this.onlineUsers.get(userId) ?? 0) + 1);
    this.broadcastOnlineUsers();
  }

  handleDisconnect(client: Socket): void {
    const user = (client.data as Partial<UserData>).user;
    if (!user) return;

    const current = this.onlineUsers.get(user.sub) ?? 0;
    if (current <= 1) {
      this.onlineUsers.delete(user.sub);
    } else {
      this.onlineUsers.set(user.sub, current - 1);
    }
    this.broadcastOnlineUsers();
  }

  private broadcastOnlineUsers(): void {
    this.server.emit('chat:online-users', Array.from(this.onlineUsers.keys()));
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendMessageDto,
  ): Promise<void> {
    const dto = await this.validateOrEmitError(client, SendMessageDto, body);
    if (!dto) return;

    try {
      const message = await this.chatService.sendMessage(
        userData(client).sub,
        dto.roomId,
        dto.content,
      );
      this.server.to(dto.roomId).emit('chat:message', message);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('chat:history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: GetHistoryDto,
  ): Promise<void> {
    const dto = await this.validateOrEmitError(client, GetHistoryDto, body);
    if (!dto) return;

    try {
      const messages = await this.chatService.getHistory(
        dto.roomId,
        userData(client).sub,
        dto.cursor,
      );
      client.emit('chat:history', { roomId: dto.roomId, messages });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('chat:join-private')
  async handleJoinPrivate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinPrivateDto,
  ): Promise<void> {
    const dto = await this.validateOrEmitError(client, JoinPrivateDto, body);
    if (!dto) return;

    const roomId = await this.chatService.getOrCreatePrivateRoom(
      userData(client).sub,
      dto.userId,
    );
    await client.join(roomId);
    client.emit('chat:room-joined', { roomId, userId: dto.userId });
  }

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MarkReadDto,
  ): Promise<void> {
    const dto = await this.validateOrEmitError(client, MarkReadDto, body);
    if (!dto) return;

    await this.chatService.markRead(userData(client).sub, dto.roomId);
  }

  private async validateOrEmitError<T extends object>(
    client: Socket,
    dtoClass: new () => T,
    body: unknown,
  ): Promise<T | null> {
    const instance = plainToInstance(dtoClass, body);
    const errors = await validate(instance as object);

    if (errors.length > 0) {
      client.emit('chat:error', {
        message: 'Dados inválidos.',
        details: errors.flatMap((error) =>
          Object.values(error.constraints ?? {}),
        ),
      });
      return null;
    }

    return instance;
  }

  private emitError(client: Socket, error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'Erro inesperado no chat.';
    this.logger.error(message);
    client.emit('chat:error', { message });
  }
}
