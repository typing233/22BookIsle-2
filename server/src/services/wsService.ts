import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { verifyAccessToken } from './authService';
import { logger } from '../utils/logger';
import { ScanProgressEvent } from '../../../shared/types/api';

let wss: WebSocketServer | null = null;
const clients = new Map<WebSocket, { userId: number; username: string }>();

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      clients.set(ws, { userId: payload.userId, username: payload.username });
      logger.debug({ userId: payload.userId }, 'WebSocket client connected');

      ws.on('close', () => {
        clients.delete(ws);
      });

      ws.on('error', () => {
        clients.delete(ws);
      });

      ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
    } catch {
      ws.close(4001, 'Invalid token');
    }
  });

  logger.info('WebSocket server initialized');
}

export function broadcastScanProgress(libraryId: number, data: ScanProgressEvent): void {
  if (!wss) return;

  const message = JSON.stringify({ type: 'scan_progress', data });

  for (const [ws, _client] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

export function broadcastToUser(userId: number, type: string, data: any): void {
  if (!wss) return;

  const message = JSON.stringify({ type, data });

  for (const [ws, client] of clients) {
    if (client.userId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}
