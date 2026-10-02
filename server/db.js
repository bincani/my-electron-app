const { DatabaseSync } = require('node:sqlite');

// Shared store for connections and messages. Every server instance pointed at
// the same file sees the same connection list and history.
function openDb(file = process.env.CHAT_DB || 'chat.db') {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      disconnected_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id TEXT NOT NULL REFERENCES connections(id),
      username TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const stmts = {
    addConnection: db.prepare('INSERT INTO connections (id, username) VALUES (?, ?)'),
    closeConnection: db.prepare(
      "UPDATE connections SET disconnected_at = datetime('now') WHERE id = ?"
    ),
    closeAllConnections: db.prepare(
      "UPDATE connections SET disconnected_at = datetime('now') WHERE disconnected_at IS NULL"
    ),
    activeConnections: db.prepare(
      'SELECT id, username, connected_at FROM connections WHERE disconnected_at IS NULL ORDER BY connected_at'
    ),
    addMessage: db.prepare(
      'INSERT INTO messages (connection_id, username, body) VALUES (?, ?, ?) RETURNING *'
    ),
    recentMessages: db.prepare(
      'SELECT * FROM (SELECT * FROM messages ORDER BY id DESC LIMIT ?) ORDER BY id'
    ),
  };

  return {
    addConnection: (id, username) => stmts.addConnection.run(id, username),
    closeConnection: (id) => stmts.closeConnection.run(id),
    closeAllConnections: () => stmts.closeAllConnections.run(),
    activeConnections: () => stmts.activeConnections.all(),
    addMessage: (connectionId, username, body) =>
      stmts.addMessage.get(connectionId, username, body),
    recentMessages: (limit = 50) => stmts.recentMessages.all(limit),
    close: () => db.close(),
  };
}

module.exports = { openDb };
