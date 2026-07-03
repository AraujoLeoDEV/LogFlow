import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getAccessToken } from '@/lib/api';
import type { ChatMessage, ChatUser } from '@/types/chat';

import { useAuth } from './AuthContext';

const GENERAL_ROOM_ID = 'general';

interface PrivateRoomJoined {
  roomId: string;
  userId: string;
}

interface HistoryPayload {
  roomId: string;
  messages: ChatMessage[];
}

interface ChatContextValue {
  isConnected: boolean;
  messages: Map<string, ChatMessage[]>;
  unreadCount: number;
  onlineUserIds: string[];
  users: ChatUser[];
  activeRoomId: string;
  isPanelOpen: boolean;
  // userId -> roomId, populado ao receber chat:room-joined
  privateRooms: Map<string, string>;
  setIsPanelOpen: (open: boolean) => void;
  setActiveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string) => void;
  // onJoined é chamado com o roomId quando o servidor confirma a sala privada
  joinPrivate: (userId: string, onJoined?: (roomId: string) => void) => void;
  markRead: (roomId: string) => void;
  loadHistory: (roomId: string, cursor?: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const joinCallbacksRef = useRef<Map<string, (roomId: string) => void>>(new Map());

  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [users] = useState<ChatUser[]>([]);
  const [activeRoomId, setActiveRoomId] = useState(GENERAL_ROOM_ID);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [privateRooms, setPrivateRooms] = useState<Map<string, string>>(new Map());

  const addMessages = useCallback((roomId: string, incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const next = new Map(prev);
      const existing = prev.get(roomId) ?? [];
      const existingIds = new Set(existing.map((m) => m.id));
      const deduped = incoming.filter((m) => !existingIds.has(m.id));
      next.set(
        roomId,
        [...existing, ...deduped].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      );
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const apiUrl = import.meta.env.VITE_API_URL as string;
    const socket = io(`${apiUrl}/chat`, {
      auth: { token: getAccessToken() },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('chat:history', { roomId: GENERAL_ROOM_ID });
    });

    socket.on('disconnect', () => setIsConnected(false));

    // Antes de reconectar, atualiza o token (pode ter sido renovado pelo refresh)
    socket.io.on('reconnect_attempt', () => {
      socket.auth = { token: getAccessToken() };
    });

    socket.on('chat:message', (message: ChatMessage) => {
      addMessages(message.roomId, [message]);
      if (!isPanelOpen || message.roomId !== activeRoomId) {
        setUnreadCount((n) => n + 1);
      }
    });

    socket.on('chat:history', ({ roomId, messages: msgs }: HistoryPayload) => {
      addMessages(roomId, msgs);
    });

    socket.on('chat:online-users', (userIds: string[]) => {
      setOnlineUserIds(userIds);
    });

    socket.on('chat:room-joined', ({ roomId, userId: peerId }: PrivateRoomJoined) => {
      socket.emit('chat:history', { roomId });
      setPrivateRooms((prev) => new Map(prev).set(peerId, roomId));
      const cb = joinCallbacksRef.current.get(peerId);
      if (cb) {
        joinCallbacksRef.current.delete(peerId);
        cb(roomId);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setMessages(new Map());
      setUnreadCount(0);
      setOnlineUserIds([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Reaplica o efeito de atualizar o unread quando o painel ou sala ativa mudam
  // sem re-criar o socket (apenas a closure de isPanelOpen/activeRoomId atualiza).
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handler = (message: ChatMessage) => {
      addMessages(message.roomId, [message]);
      if (!isPanelOpen || message.roomId !== activeRoomId) {
        setUnreadCount((n) => n + 1);
      }
    };

    socket.off('chat:message');
    socket.on('chat:message', handler);
  }, [isPanelOpen, activeRoomId, addMessages]);

  const sendMessage = useCallback((roomId: string, content: string) => {
    socketRef.current?.emit('chat:message', { roomId, content });
  }, []);

  const joinPrivate = useCallback((userId: string, onJoined?: (roomId: string) => void) => {
    if (onJoined) joinCallbacksRef.current.set(userId, onJoined);
    socketRef.current?.emit('chat:join-private', { userId });
  }, []);

  const markRead = useCallback(
    (roomId: string) => {
      socketRef.current?.emit('chat:read', { roomId });
      setUnreadCount((n) => Math.max(0, n - (messages.get(roomId)?.length ?? 0)));
    },
    [messages],
  );

  const loadHistory = useCallback((roomId: string, cursor?: string) => {
    socketRef.current?.emit('chat:history', { roomId, ...(cursor ? { cursor } : {}) });
  }, []);

  const setActiveRoom = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      markRead(roomId);
    },
    [markRead],
  );

  const handleSetIsPanelOpen = useCallback(
    (open: boolean) => {
      setIsPanelOpen(open);
      if (open) {
        markRead(activeRoomId);
      }
    },
    [activeRoomId, markRead],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      isConnected,
      messages,
      unreadCount,
      onlineUserIds,
      users,
      activeRoomId,
      isPanelOpen,
      privateRooms,
      setIsPanelOpen: handleSetIsPanelOpen,
      setActiveRoom,
      sendMessage,
      joinPrivate,
      markRead,
      loadHistory,
    }),
    [
      isConnected,
      messages,
      unreadCount,
      onlineUserIds,
      users,
      activeRoomId,
      isPanelOpen,
      privateRooms,
      handleSetIsPanelOpen,
      setActiveRoom,
      sendMessage,
      joinPrivate,
      markRead,
      loadHistory,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat deve ser usado dentro de <ChatProvider>');
  }
  return context;
}

export { GENERAL_ROOM_ID };
