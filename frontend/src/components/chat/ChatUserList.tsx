import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { ChatUser } from '@/types/chat';

import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';

interface ChatUserListProps {
  onSelectUser: (userId: string, userName: string) => void;
}

export function ChatUserList({ onSelectUser }: ChatUserListProps) {
  const { onlineUserIds, unreadDmUserIds } = useChat();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);

  useEffect(() => {
    api
      .get<ChatUser[]>('/chat/users')
      .then((response) => setUsers(response.data))
      .catch(() => {});
  }, []);

  const sorted = [...users].sort((a, b) => {
    const aOnline = onlineUserIds.includes(a.id) ? 0 : 1;
    const bOnline = onlineUserIds.includes(b.id) ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  if (sorted.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Nenhum outro usuário encontrado.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {sorted.map((u) => {
        const isOnline = onlineUserIds.includes(u.id);
        const isMe = u.id === currentUser?.id;

        return (
          <li key={u.id}>
            <button
              type="button"
              disabled={isMe}
              onClick={() => onSelectUser(u.id, u.name)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm
                         hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
              />
              <span className="flex-1 truncate">{u.name}</span>
              {unreadDmUserIds.has(u.id) && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              )}
              <span className="shrink-0 text-[10px] text-muted-foreground">{u.role}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
