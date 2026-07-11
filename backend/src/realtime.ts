import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './utils/token';

type Client = WebSocket & { userId?: string; isAlive?: boolean };

const clients = new Map<string, Set<Client>>();
let wss: WebSocketServer | null = null;

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/**
 * Attaches a cookie-authenticated WebSocket server to the HTTP server. Clients
 * connect to /ws; the access-token cookie is validated during the upgrade, and
 * sockets are indexed by userId so the app can push events to a specific user.
 */
export function initRealtime(server: Server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!req.url || !req.url.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    const token = readCookie(req.headers.cookie, 'guildos_access_token');
    const payload = token ? verifyToken(token) : null;
    if (!payload || payload.purpose !== 'access') {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss!.handleUpgrade(req, socket, head, (ws) => {
      (ws as Client).userId = payload.sub;
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: Client) => {
    const userId = ws.userId as string;
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(ws);
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', (raw) => {
      // Client keep-alive ping.
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch {
        /* ignore malformed frames */
      }
    });
    ws.on('close', () => {
      const set = clients.get(userId);
      if (set) {
        set.delete(ws);
        if (!set.size) clients.delete(userId);
      }
    });
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  // Drop dead connections.
  const heartbeat = setInterval(() => {
    wss?.clients.forEach((ws) => {
      const c = ws as Client;
      if (c.isAlive === false) {
        c.terminate();
        return;
      }
      c.isAlive = false;
      c.ping();
    });
  }, 30_000);
  heartbeat.unref();

  console.log('[GuildOS] Realtime WebSocket ready at /ws');
}

/** Pushes a JSON event to every open socket for the given user (all devices/tabs). */
export function emitToUser(userId: string, event: Record<string, unknown>) {
  const set = clients.get(userId);
  if (!set || !set.size) return;
  const data = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch {
        /* ignore send failures */
      }
    }
  }
}
