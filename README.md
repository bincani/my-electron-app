## Intro

I'm starting to learn how to create an electron app running on node v24.19.0 using windows powershell. I am interested in setting up a database which two app instances can access over tcp/ip

## Chat app

Electron chat client backed by a WebSocket server and a shared SQLite database.
Run one server, and any number of app instances (on this or other machines)
connect to it over TCP/IP.

- **`server/`**: a WebSocket server (`ws`). Each connection is recorded in the
  `connections` table and each message in the `messages` table (`server/db.js`,
  using Node's built-in `node:sqlite`). New messages and presence changes are
  pushed to every connected client.
- **Electron app** (`index.js`, `preload.js`, `index.html`, `renderer.js`): pick
  a name, see recent history and who's online, and send messages.

### Protocol (JSON over WebSocket)

| Direction | Message |
|-----------|---------|
| client → server | `{ "type": "chat", "body": "hello" }` |
| server → client | `{ "type": "welcome", "id", "history": [...] }` on connect |
| server → client | `{ "type": "chat", "message": { id, username, body, created_at } }` |
| server → client | `{ "type": "presence", "users": [{ id, username, connected_at }] }` |

### Running

```powershell
npm install
npm run server   # listens on ws://0.0.0.0:8080, stores data in .\chat.db
npm start        # launch a client; start it again for a second instance
npm test
```

Settings (PowerShell syntax):

```powershell
$env:PORT = "9000"; $env:CHAT_DB = "C:\data\chat.db"; npm run server
$env:CHAT_SERVER_URL = "ws://192.168.1.20:9000"; npm start
```

To connect from another machine, allow the port through Windows Firewall.
