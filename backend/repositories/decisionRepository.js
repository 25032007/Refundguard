const db = require('../services/db');

class DecisionRepository {
  getDecision(datasetId, customerId) {
    const stmt = db.prepare('SELECT * FROM decisions WHERE datasetId = ? AND customerId = ?');
    const row = stmt.get(datasetId, customerId);
    if (!row) return null;
    return {
      status: row.decision,
      reason: row.reason,
      analystId: row.analystId,
      version: row.version,
      updatedAt: row.updatedAt
    };
  }

  getDecisionsForDataset(datasetId) {
    const stmt = db.prepare('SELECT customerId, decision FROM decisions WHERE datasetId = ?');
    return stmt.all(datasetId);
  }

  saveDecision(datasetId, customerId, decision, reason, analystId, expectedVersion) {
    return db.transaction(() => {
      const current = this.getDecision(datasetId, customerId);
      const currentVersion = current ? current.version : 0;
      const currentDecision = current ? current.status : 'UNREVIEWED';

      if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
        const error = new Error('Version mismatch');
        error.code = 'VERSION_MISMATCH';
        error.currentState = current || { status: 'UNREVIEWED', version: 0 };
        throw error;
      }

      // Idempotency check
      if (current && current.status === decision && (current.reason || '') === (reason || '') && current.analystId === analystId) {
        return current;
      }

      const now = new Date().toISOString();
      const newVersion = currentVersion + 1;

      const insertDecision = db.prepare(`
        INSERT INTO decisions (datasetId, customerId, decision, reason, analystId, version, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(datasetId, customerId) DO UPDATE SET
          decision = excluded.decision,
          reason = excluded.reason,
          analystId = excluded.analystId,
          version = excluded.version,
          updatedAt = excluded.updatedAt
      `);

      insertDecision.run(
        datasetId, customerId, decision, reason || null, analystId || null, newVersion,
        current ? current.createdAt : now, now
      );

      const insertAudit = db.prepare(`
        INSERT INTO audit_logs (datasetId, customerId, decision, previousDecision, reason, analystId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertAudit.run(datasetId, customerId, decision, currentDecision, reason || null, analystId || null, now);

      return this.getDecision(datasetId, customerId);
    })();
  }

  getAuditHistory(datasetId, customerId) {
    const stmt = db.prepare('SELECT id, decision, previousDecision, reason, analystId, createdAt FROM audit_logs WHERE datasetId = ? AND customerId = ? ORDER BY id DESC');
    return stmt.all(datasetId, customerId);
  }
}

module.exports = new DecisionRepository();
