const { createHash, randomUUID, timingSafeEqual } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');
const { openDb } = require('./db');

// The same UI the Electron app uses, served so a plain browser (e.g. a phone)
// can join the chat too.
const STATIC_FILES = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/renderer.js': ['renderer.js', 'text/javascript'],
  '/styles.css': ['styles.css', 'text/css'],
  '/admin': ['admin.html', 'text/html'],
  '/admin.js': ['admin.js', 'text/javascript'],
  '/admin.css': ['admin.css', 'text/css'],
};

const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const sha256 = (value) => createHash('sha256').update(value).digest();

// Admin pages need the ADMIN_PASSWORD (any username) via the browser's login
// prompt. Without ADMIN_PASSWORD set, they're only reachable from this PC.
function isAdmin(req, password) {
  if (!password) return LOCAL_ADDRESSES.has(req.socket.remoteAddress);
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const given = Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':');
  return timingSafeEqual(sha256(given), sha256(password));
}

function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveFile(res, [name, type]) {
  fs.readFile(path.join(__dirname, '..', name), (err, data) => {
    if (err) res.writeHead(500).end('Server error');
    else res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }).end(data);
  });
}

function startServer({ port = 8080, dbFile, adminPassword = process.env.ADMIN_PASSWORD } = {}) {
  const db = openDb(dbFile);

  const httpServer = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const adminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin/');

    if (adminRoute && !isAdmin(req, adminPassword)) {
      if (adminPassword) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Chat admin"' });
        res.end('Login required');
      } else {
        res.writeHead(403).end('Admin is only available on the server PC unless ADMIN_PASSWORD is set');
      }
      return;
    }

    if (pathname === '/api/admin/users') return sendJson(res, db.userSummary());
    const userPath = pathname.match(/^\/api\/admin\/users\/([^/]+)\/messages$/);
    if (userPath) return sendJson(res, db.userMessages(decodeURIComponent(userPath[1])));

    const file = STATIC_FILES[pathname];
    if (file) return serveFile(res, file);
    res.writeHead(404).end('Not found');
  });
  const wss = new WebSocketServer({ server: httpServer });
  const listening = new Promise((resolve) => httpServer.listen(port, resolve));
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
    listening,
    port: () => httpServer.address().port,
    close: () =>
      new Promise((resolve) => {
        closing = true;
        db.closeAllConnections();
        wss.clients.forEach((ws) => ws.terminate());
        wss.close(() => {
          httpServer.close(() => {
            db.close();
            resolve();
          });
        });
      }),
  };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  startServer({ port });
  console.log(`Chat server listening on http://localhost:${port} (WebSocket on the same port)`);
}

module.exports = { startServer };
