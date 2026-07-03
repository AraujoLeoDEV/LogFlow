import { useState } from 'react';
import { ArrowLeft, MessageSquare, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GENERAL_ROOM_ID, useChat } from '@/contexts/ChatContext';

import { ChatRoom } from './ChatRoom';
import { ChatUserList } from './ChatUserList';

type Tab = 'geral' | 'usuarios';

export function ChatPanel() {
  const { setIsPanelOpen, setActiveRoom, activeRoomId, joinPrivate } = useChat();
  const [tab, setTab] = useState<Tab>('usuarios');
  const [privateRoomLabel, setPrivateRoomLabel] = useState<string | null>(null);
  const isInPrivate = activeRoomId !== GENERAL_ROOM_ID;

  function handleSelectUser(userId: string, userName: string) {
    setPrivateRoomLabel(userName);
    joinPrivate(userId, (roomId) => {
      setActiveRoom(roomId);
    });
  }

  function handleBack() {
    setActiveRoom(GENERAL_ROOM_ID);
    setPrivateRoomLabel(null);
    setTab('usuarios');
  }

  return (
    <div className="flex h-[480px] w-80 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
      {/* cabeçalho */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        {isInPrivate ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="truncate text-sm font-semibold">{privateRoomLabel}</span>
          </div>
        ) : (
          <span className="text-sm font-semibold">Chat</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={() => setIsPanelOpen(false)}
        >
          <span className="text-lg leading-none">×</span>
        </Button>
      </div>

      {/* tabs (só visíveis fora de DM) */}
      {!isInPrivate && (
        <div className="flex border-b text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab('geral')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 transition-colors ${
              tab === 'geral'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Geral
          </button>
          <button
            type="button"
            onClick={() => setTab('usuarios')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 transition-colors ${
              tab === 'usuarios'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Usuários
          </button>
        </div>
      )}

      {/* conteúdo */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {isInPrivate ? (
          <ChatRoom roomId={activeRoomId} />
        ) : tab === 'geral' ? (
          <ChatRoom roomId={GENERAL_ROOM_ID} />
        ) : (
          <div className="h-full overflow-y-auto p-2">
            <ChatUserList onSelectUser={handleSelectUser} />
          </div>
        )}
      </div>
    </div>
  );
}
