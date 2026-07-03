import { ForbiddenException, Injectable } from '@nestjs/common';

import { ChatRoomType } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const GENERAL_ROOM_ID = 'general';
const HISTORY_PAGE_SIZE = 50;

export interface ChatMessageDto {
  id: string;
  content: string;
  roomId: string;
  senderId: string;
  senderName: string;
  createdAt: Date;
}

function pairKeyFor(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // Garante que toda sala (geral ou privada) tem o usuário como membro,
  // criando o vínculo na primeira vez que ele a acessa.
  async ensureMembership(roomId: string, userId: string): Promise<void> {
    await this.prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: {},
      create: { roomId, userId },
    });
  }

  // Confere que o usuário participa da sala antes de ler/escrever nela -
  // evita que alguém leia/envie mensagem numa DM da qual não faz parte.
  private async assertMembership(
    roomId: string,
    userId: string,
  ): Promise<void> {
    if (roomId === GENERAL_ROOM_ID) {
      await this.ensureMembership(roomId, userId);
      return;
    }

    const membership = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('Você não participa desta conversa.');
    }
  }

  async sendMessage(
    senderId: string,
    roomId: string,
    content: string,
  ): Promise<ChatMessageDto> {
    await this.assertMembership(roomId, senderId);

    const message = await this.prisma.chatMessage.create({
      data: { content, roomId, senderId },
      include: { sender: { select: { name: true } } },
    });

    await this.markRead(senderId, roomId);

    return {
      id: message.id,
      content: message.content,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.sender.name,
      createdAt: message.createdAt,
    };
  }

  async getHistory(
    roomId: string,
    userId: string,
    cursor?: string,
  ): Promise<ChatMessageDto[]> {
    await this.assertMembership(roomId, userId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { sender: { select: { name: true } } },
    });

    return messages.reverse().map((message) => ({
      id: message.id,
      content: message.content,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.sender.name,
      createdAt: message.createdAt,
    }));
  }

  // Busca a sala privada entre os 2 usuários, criando-a (e seus 2 vínculos
  // de membro) se for a primeira conversa entre eles.
  async getOrCreatePrivateRoom(
    userIdA: string,
    userIdB: string,
  ): Promise<string> {
    const pairKey = pairKeyFor(userIdA, userIdB);

    const existing = await this.prisma.chatRoom.findUnique({
      where: { pairKey },
      select: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    const room = await this.prisma.chatRoom.create({
      data: {
        type: ChatRoomType.PRIVATE,
        pairKey,
        members: {
          create: [{ userId: userIdA }, { userId: userIdB }],
        },
      },
      select: { id: true },
    });

    return room.id;
  }

  async markRead(userId: string, roomId: string): Promise<void> {
    await this.prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: { lastReadAt: new Date() },
      create: { roomId, userId, lastReadAt: new Date() },
    });
  }

  // Total de mensagens não lidas do usuário, somando todas as salas das
  // quais ele participa (geral + DMs) - usado pro badge do widget.
  async getTotalUnread(userId: string): Promise<number> {
    const memberships = await this.prisma.chatRoomMember.findMany({
      where: { userId },
      select: { roomId: true, lastReadAt: true },
    });

    if (memberships.length === 0) {
      return 0;
    }

    const counts = await Promise.all(
      memberships.map((membership) =>
        this.prisma.chatMessage.count({
          where: {
            roomId: membership.roomId,
            senderId: { not: userId },
            createdAt: { gt: membership.lastReadAt },
          },
        }),
      ),
    );

    return counts.reduce((total, count) => total + count, 0);
  }

  // Lista as salas (id + tipo) das quais o usuário participa, para o
  // gateway colocar o socket recém-conectado em todas elas.
  async getUserRoomIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.chatRoomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });

    return memberships.map((membership) => membership.roomId);
  }

  // Diretório de usuários pra aba "Usuários" do chat - qualquer pessoa
  // autenticada pode ver, ao contrário de GET /users que é ADMIN-only.
  async getDirectoryUsers(excludeUserId: string) {
    return this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true, id: { not: excludeUserId } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }
}
