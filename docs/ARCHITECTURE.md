# LAN architecture

Two Windows PCs and a Yodeck player on one unmanaged switch. The server PC runs
the chat server and owns the database; the client PC runs the Electron app; the
Yodeck player shows the admin page on a screen.

```
┌────────────────────────────────────┐    ┌────────────────────────────────────┐
│ CLIENT PC          192.168.10.20   │    │ YODECK PLAYER      192.168.10.30   │
│ Windows · Node.js 24               │    │ Raspberry Pi · Yodeck OS           │
│                                    │    │                                    │
│ Electron 44 app (npm start)        │    │ Chromium kiosk showing Web Page:   │
│  index.js     main process         │    │  http://admin:<pw>@                │
│  preload.js   passes server URL    │    │  192.168.10.10:8080/admin          │
│  index.html + renderer.js  chat UI │    │                                    │
│                                    │    │ admin.js polls the user list       │
│ CHAT_SERVER_URL=                   │    │ every 10 s                         │
│   ws://192.168.10.10:8080          │    │                                    │
└──────────────────┬─────────────────┘    └──────────────────┬─────────────────┘
                   │ WebSocket (chat)                        │ HTTP (Basic auth)
                   │ ws://192.168.10.10:8080                 │ GET /admin, /api/admin/*
                   │                                         │
             ┌─────┴─────────────────────────────────────────┴─────┐
             │             UNMANAGED SWITCH  (no DHCP)             │
             │         subnet 192.168.10.0/24 · static IPs         │
             └──────────────────────────┬──────────────────────────┘
                                        │  Ethernet
                  ┌─────────────────────┴────────────────────┐
                  │ SERVER PC                192.168.10.10   │
                  │ Windows · Node.js 24                     │
                  │                                          │
                  │ server/index.js (npm run server)         │
                  │  HTTP      :8080  chat page, /admin,     │
                  │                   /api/admin/* (JSON)    │
                  │  WebSocket :8080  chat + presence push   │
                  │                                          │
                  │ server/db.js → node:sqlite               │
                  │  chat.db  tables: connections, messages  │
                  │                                          │
                  │ Firewall: allow inbound TCP 8080         │
                  │ env: ADMIN_PASSWORD=<pw>                 │
                  └──────────────────────────────────────────┘
```

## IP plan

A simple switch has no DHCP server, so every device needs a static IP on the
same subnet (`192.168.10.0/24`, mask `255.255.255.0`). No gateway or DNS is
needed for the chat itself.

| Device | IP | Runs | Talks to |
|---|---|---|---|
| Server PC | `192.168.10.10` | `npm run server` (HTTP + WebSocket on TCP 8080, SQLite `chat.db`) | — |
| Client PC | `192.168.10.20` | `npm start` (Electron app) | `ws://192.168.10.10:8080` |
| Yodeck player | `192.168.10.30` | Yodeck Web Page | `http://192.168.10.10:8080/admin` |

## Setup

**Server PC**

```powershell
# Static IP (run as Administrator; check the adapter name with Get-NetAdapter)
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.10.10 -PrefixLength 24

# Allow the chat port in
New-NetFirewallRule -DisplayName "Chat server" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow

# Start the server
$env:ADMIN_PASSWORD = "choose-a-password"; npm run server
```

**Client PC**

```powershell
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.10.20 -PrefixLength 24
$env:CHAT_SERVER_URL = "ws://192.168.10.10:8080"; npm start
```

**Yodeck player**

- Set a static IP of `192.168.10.30` / `255.255.255.0` in the player's network
  settings in the Yodeck portal.
- Add a Web Page with the URL
  `http://admin:choose-a-password@192.168.10.10:8080/admin` and assign it to
  the player.

Check the network with `ping 192.168.10.10` from the client PC. Windows blocks
ping by default, so if it fails, test `http://192.168.10.10:8080` in a browser
instead.

## Notes

- **Yodeck needs the internet for setup.** The player registers with and gets
  its schedule from Yodeck's cloud, which a switch-only LAN can't reach. Set it
  up on a network with internet first, or give it Wi-Fi for internet while its
  Ethernet port is on the switch.
- **The admin password travels in plain text.** On a closed LAN with no
  internet that's usually acceptable.
- **Only the server PC holds data.** Back up `chat.db` on the server PC; the
  client and Yodeck store nothing.
