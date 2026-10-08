const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'refundguard.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS decisions (
    datasetId TEXT NOT NULL,
    customerId TEXT NOT NULL,
    decision TEXT NOT NULL,
    reason TEXT,
    analystId TEXT,
    version INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (datasetId, customerId)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datasetId TEXT NOT NULL,
    customerId TEXT NOT NULL,
    decision TEXT NOT NULL,
    previousDecision TEXT,
    reason TEXT,
    analystId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
