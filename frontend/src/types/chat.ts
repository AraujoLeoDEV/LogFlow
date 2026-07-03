import type { Role } from './auth';

export interface ChatMessage {
  id: string;
  content: string;
  roomId: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

export interface ChatUser {
  id: string;
  name: string;
  role: Role;
}
