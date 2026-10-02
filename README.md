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
npm run server   # listens on port 8080, stores data in .\chat.db
npm start        # launch a client; start it again for a second instance
npm test
```

Settings (PowerShell syntax):

```powershell
$env:PORT = "9000"; $env:CHAT_DB = "C:\data\chat.db"; npm run server
$env:CHAT_SERVER_URL = "ws://192.168.1.20:9000"; npm start
```

To connect from another machine, allow the port through Windows Firewall
(run PowerShell as Administrator):

```powershell
New-NetFirewallRule -DisplayName "Chat server" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

### Admin page

Open `http://localhost:8080/admin` on the server PC to see everyone who has
joined: their message count, number of logins and when they were last seen
(a green dot means online now). Click a user to see their message history.

From other devices, set an admin password before starting the server. The
browser then asks for it (the username can be anything):

```powershell
$env:ADMIN_PASSWORD = "choose-a-password"; npm run server
```

Users are grouped by the name they typed when joining, since there are no
accounts. Two people using the same name show up as one user.

### From a phone or any browser

The server also serves the chat page, so you can open `http://<server-ip>:8080`
in a browser instead of running the Electron app.

Over the internet, the simplest option is [Tailscale](https://tailscale.com):
install it on the server PC and on your phone, signed in to the same account,
then browse to `http://<server's Tailscale IP>:8080` (for example
`http://100.127.83.8:8080`). Your router needs no changes and the server isn't
exposed publicly.

To share it with people who aren't on your Tailscale network, run
`tailscale funnel 8080`. That publishes the chat at a public
`https://<machine>.<tailnet>.ts.net` address. Anyone with the link can read and
post, because the chat has no login.
