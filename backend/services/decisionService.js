const fs = require('fs');
const path = require('path');

const PERSIST_DIR = process.env.PERSIST_DIR || path.join(__dirname, '..', '..', 'data', 'persist');
const DECISIONS_FILE = path.join(PERSIST_DIR, 'decisions.json');
const AUDIT_FILE = path.join(PERSIST_DIR, 'audit.json');

const VALID_DECISIONS = ['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'];

function ensureDataDir() {
  if (!fs.existsSync(PERSIST_DIR)) fs.mkdirSync(PERSIST_DIR, { recursive: true });
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

  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    throw new Error('Invalid reason: must be a string');
  }

  let finalReason = reason ? reason.trim() : '';

  if (finalReason.length > 500) {
    throw new Error('Invalid reason: maximum 500 characters allowed');
  }

  if ((newDecision === 'ESCALATED' || newDecision === 'CLEARED') && finalReason.length < 5) {
    throw new Error(`Invalid reason: ${newDecision} requires a reason of at least 5 characters`);
  }

  const decisions = getDecisions();
  const current = decisions[entityId] || { decision: 'UNREVIEWED' };

  const now = timestamp || new Date().toISOString();

  const auditEvent = {
    entityId,
    previousDecision: current.decision,
    newDecision,
    analystId,
    reason: finalReason,
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
    reason: finalReason,
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
