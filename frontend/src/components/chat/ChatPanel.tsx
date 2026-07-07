import { useState } from 'react';
import { MessageSquare, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GENERAL_ROOM_ID, useChat } from '@/contexts/ChatContext';

import { ChatRoom } from './ChatRoom';
import { ChatUserList } from './ChatUserList';

type Tab = 'geral' | 'usuarios' | 'dm';

export function ChatPanel() {
  const { setIsPanelOpen, setActiveRoom, activeRoomId, joinPrivate } = useChat();
  const [tab, setTab] = useState<Tab>('usuarios');
  const [privateRoomLabel, setPrivateRoomLabel] = useState<string | null>(null);
  const isInPrivate = activeRoomId !== GENERAL_ROOM_ID;

  function handleSelectUser(userId: string, userName: string) {
    setPrivateRoomLabel(userName);
    joinPrivate(userId, (roomId) => {
      setActiveRoom(roomId);
      setTab('dm');
    });
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    if (next === 'geral') setActiveRoom(GENERAL_ROOM_ID);
  }

  return (
    <div className="flex h-[480px] w-80 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
      {/* cabeçalho */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">Chat</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={() => setIsPanelOpen(false)}
        >
          <span className="text-lg leading-none">×</span>
        </Button>
      </div>

      {/* tabs */}
      <div className="flex border-b text-xs font-medium">
        <button
          type="button"
          onClick={() => handleTabChange('geral')}
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
          onClick={() => handleTabChange('usuarios')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 transition-colors ${
            tab === 'usuarios'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Usuários
        </button>
        {isInPrivate && privateRoomLabel && (
          <button
            type="button"
            onClick={() => setTab('dm')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 transition-colors truncate px-2 ${
              tab === 'dm'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="truncate">{privateRoomLabel}</span>
          </button>
        )}
      </div>

      {/* conteúdo */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'dm' && isInPrivate ? (
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
