'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type RealtimeEvent =
  | { type: 'connected' }
  | { type: 'pong' }
  | {
      type: 'message';
      conversationId: string;
      message: {
        id: string;
        senderId: string;
        content: string;
        createdAt: string;
        replyTo?: { id: string; content: string; senderId: string } | null;
      };
      actor: { id: string; fullName: string; username: string; avatar: string };
    }
  | { type: 'message:edit'; conversationId: string; message: { id: string; content: string; editedAt: string } }
  | { type: 'message:delete'; conversationId: string; messageId: string }
  | { type: 'conversation:settings'; conversationId: string; disappearAfterHours: number }
  | { type: 'notification'; notificationType?: string };

type Handler = (event: RealtimeEvent) => void;

const handlers = new Set<Handler>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function wsUrl() {
  return `${API_BASE_URL.replace(/^http/i, 'ws')}/ws`;
}

function connect() {
  if (typeof window === 'undefined') return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  try {
    socket = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
    }, 25_000);
  };

  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as RealtimeEvent;
      handlers.forEach((h) => h(data));
    } catch {
      /* ignore malformed frames */
    }
  };

  socket.onclose = () => {
    socket = null;
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (handlers.size) scheduleReconnect();
  };

  socket.onerror = () => {
    socket?.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 4000);
}

/**
 * Subscribe to realtime events. Opens the shared WebSocket on first use and
 * returns an unsubscribe function. The socket auto-reconnects while any
 * subscribers remain.
 */
export function onRealtime(handler: Handler): () => void {
  handlers.add(handler);
  connect();
  return () => {
    handlers.delete(handler);
    if (!handlers.size && socket) {
      socket.close();
      socket = null;
    }
  };
}
