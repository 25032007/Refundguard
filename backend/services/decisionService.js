const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'persist');
const DECISIONS_FILE = path.join(DATA_DIR, 'decisions.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');

const VALID_DECISIONS = ['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DECISIONS_FILE)) fs.writeFileSync(DECISIONS_FILE, JSON.stringify({}));
  if (!fs.existsSync(AUDIT_FILE)) fs.writeFileSync(AUDIT_FILE, JSON.stringify([]));
}

function getDecisions() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf8'));
}

function getAuditLogs() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
}

function getDecision(entityId) {
  const decisions = getDecisions();
  return decisions[entityId] || {
    entityId,
    decision: 'UNREVIEWED',
    previousDecision: null,
    analystId: null,
    reason: null,
    createdAt: null,
    updatedAt: null,
  };
}

function getAuditHistory(entityId) {
  const auditLogs = getAuditLogs();
  return auditLogs.filter((log) => log.entityId === entityId);
}

function updateDecision(entityId, newDecision, analystId = 'system', reason = '', timestamp = null) {
  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Invalid entity ID');
  }
  if (!VALID_DECISIONS.includes(newDecision)) {
    throw new Error(`Invalid decision: ${newDecision}`);
  }

  const decisions = getDecisions();
  const current = decisions[entityId] || { decision: 'UNREVIEWED' };

  const now = timestamp || new Date().toISOString();

  const auditEvent = {
    entityId,
    previousDecision: current.decision,
    newDecision,
    analystId,
    reason,
    timestamp: now,
  };

  const auditLogs = getAuditLogs();
  auditLogs.push(auditEvent);
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditLogs, null, 2));

  const updatedDecision = {
    entityId,
    decision: newDecision,
    previousDecision: current.decision,
    analystId,
    reason,
    createdAt: current.createdAt || now,
    updatedAt: now,
  };
  decisions[entityId] = updatedDecision;
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2));

  return updatedDecision;
}

module.exports = {
  getDecision,
  updateDecision,
  getAuditHistory,
};
