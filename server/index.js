const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');
const { openDb } = require('./db');

function startServer({ port = 8080, dbFile } = {}) {
  const db = openDb(dbFile);
  const wss = new WebSocketServer({ port });
  let closing = false;

  const send = (ws, msg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const broadcast = (msg) => wss.clients.forEach((ws) => send(ws, msg));
  const pushPresence = () =>
    broadcast({ type: 'presence', users: db.activeConnections() });

  wss.on('connection', (ws, req) => {
    const id = randomUUID();
    const url = new URL(req.url, 'http://localhost');
    const username = (url.searchParams.get('username') || 'anonymous').slice(0, 32);

    db.addConnection(id, username);
    send(ws, { type: 'welcome', id, history: db.recentMessages() });
    pushPresence();

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return send(ws, { type: 'error', error: 'invalid JSON' });
      }
      const body = typeof data.body === 'string' ? data.body.trim().slice(0, 2000) : '';
      if (data.type !== 'chat' || !body) return;

      const message = db.addMessage(id, username, body);
      broadcast({ type: 'chat', message });
    });

    ws.on('close', () => {
      if (closing) return;
      db.closeConnection(id);
      pushPresence();
    });
  });

  return {
    wss,
    db,
    close: () =>
      new Promise((resolve) => {
        closing = true;
        db.closeAllConnections();
        wss.clients.forEach((ws) => ws.terminate());
        wss.close(() => {
          db.close();
          resolve();
        });
      }),
  };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  startServer({ port });
  console.log(`Chat server listening on ws://localhost:${port}`);
}

module.exports = { startServer };
