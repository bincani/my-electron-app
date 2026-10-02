const { app, BrowserWindow } = require('electron/main')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

// The first instance owns the default profile. Extra instances (e.g. a second
// chat user on the same PC) get a throwaway profile so they don't fight over
// Chromium's cache files. It's left in the OS temp folder for the OS to clear
// (Chromium still writes to it after the app's quit event).
if (!app.requestSingleInstanceLock()) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'my-electron-app-'))
  app.setPath('userData', profile)
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})