import React from 'react';
import { formatDateTime } from '../utils/format';

export default function AuditHistory({ history = [] }) {
  if (!history || history.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--rg-text-tertiary)', padding: '8px 0' }}>
        No audit history recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.map((log, index) => (
        <div key={log.id || index} className="audit-entry">
          <span className="audit-timestamp">{formatDateTime(log.timestamp)}</span>
          <div className="audit-transition">
            {log.previousDecision} → {log.newDecision}
          </div>
          <div className="audit-analyst">
            Analyst: <span style={{ fontFamily: 'var(--rg-font-mono)', fontSize: 11 }}>{log.analystId}</span>
            {log.reason && (
              <span style={{ color: 'var(--rg-text-tertiary)', marginLeft: 6 }}>· {log.reason}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
