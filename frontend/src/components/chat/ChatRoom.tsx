import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';

interface ChatRoomProps {
  roomId: string;
}

export function ChatRoom({ roomId }: ChatRoomProps) {
  const { user } = useAuth();
  const { messages, sendMessage, markRead, loadHistory } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const roomMessages = messages.get(roomId) ?? [];

  useEffect(() => {
    loadHistory(roomId);
    markRead(roomId);
  }, [roomId, loadHistory, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length]);

  function handleSend() {
    const content = input.trim();
    if (!content) return;
    sendMessage(roomId, content);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* mensagens */}
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {roomMessages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhuma mensagem ainda. Seja o primeiro a escrever!
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roomMessages.map((msg) => {
              const isOwn = msg.senderId === user?.id;
              const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <li key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                      {msg.senderName}
                    </span>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{time}</span>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      {/* input */}
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem..."
          maxLength={2000}
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm
                     outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
        <Button type="button" size="sm" disabled={!input.trim()} onClick={handleSend}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
