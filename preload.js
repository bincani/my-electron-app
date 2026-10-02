const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('chatConfig', {
  serverUrl: process.env.CHAT_SERVER_URL || 'ws://localhost:8080',
});
