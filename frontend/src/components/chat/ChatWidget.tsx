import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';

import { ChatPanel } from './ChatPanel';

export function ChatWidget() {
  const { pathname } = useLocation();
  const { unreadCount, isPanelOpen, setIsPanelOpen } = useChat();

  // Não exibe na Visão Executiva (apresentação à diretoria)
  if (pathname === '/dashboard/executivo') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isPanelOpen && (
        <div className="absolute bottom-14 right-0">
          <ChatPanel />
        </div>
      )}

      <Button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="relative h-12 w-12 rounded-full shadow-lg"
        aria-label="Abrir chat"
      >
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center
                       rounded-full bg-red-500 text-[10px] font-bold text-white shadow"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </div>
  );
}
