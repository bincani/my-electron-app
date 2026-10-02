const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { WebSocket } = require('ws');
const { startServer } = require('../server');

function client(port, username) {
  const ws = new WebSocket(`ws://localhost:${port}?username=${username}`);
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    const i = waiters.findIndex((w) => w.type === msg.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else queue.push(msg);
  });
  ws.next = (type) => {
    const i = queue.findIndex((m) => m.type === type);
    if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
    return new Promise((resolve) => waiters.push({ type, resolve }));
  };
  return ws;
}

test('stores connections and pushes chat to all connected clients', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-'));
  const server = startServer({ port: 0, dbFile: path.join(dir, 'test.db') });
  t.after(() => server.close());
  await server.listening;
  const port = server.port();

  const page = await fetch(`http://localhost:${port}/`);
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /id="composer"/);
  assert.strictEqual((await fetch(`http://localhost:${port}/server/db.js`)).status, 404);

  const alice = client(port, 'alice');
  await alice.next('welcome');
  const bob = client(port, 'bob');
  await bob.next('welcome');

  assert.deepStrictEqual(
    server.db.activeConnections().map((c) => c.username),
    ['alice', 'bob']
  );

  alice.send(JSON.stringify({ type: 'chat', body: 'hi bob' }));
  const [a, b] = await Promise.all([alice.next('chat'), bob.next('chat')]);
  assert.strictEqual(a.message.body, 'hi bob');
  assert.strictEqual(b.message.username, 'alice');

  bob.close();
  let users;
  do {
    users = (await alice.next('presence')).users.map((u) => u.username);
  } while (users.includes('bob'));
  assert.deepStrictEqual(users, ['alice']);

  const carol = client(port, 'carol');
  const welcome = await carol.next('welcome');
  assert.strictEqual(welcome.history.at(-1).body, 'hi bob');

});
