import { useEffect, useState } from 'react';
import { getAuditHistory } from '../services/api.js';

export default function AuditHistory({ entityId, refreshTrigger }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAuditHistory(entityId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        // ignore errors
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, refreshTrigger]);

  if (loading) {
    return <div className="rg-meta" style={{ color: 'var(--rg-text-secondary)' }}>Loading audit history...</div>;
  }

  if (history.length === 0) {
    return <div className="rg-meta" style={{ color: 'var(--rg-text-secondary)' }}>No audit history available.</div>;
  }

  return (
    <div className="rg-audit-history" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-3)' }}>
      {history.map((log, index) => (
        <div key={index} style={{ padding: 'var(--rg-space-3)', backgroundColor: 'var(--rg-surface-hover)', borderRadius: 'var(--rg-radius-sm)', border: 'var(--rg-border-width) solid var(--rg-border-subtle)' }}>
          <div className="rg-meta" style={{ marginBottom: 'var(--rg-space-1)' }}>
            {new Date(log.timestamp).toLocaleString()}
          </div>
          <div className="rg-body-compact" style={{ marginBottom: 'var(--rg-space-1)' }}>
            <strong>{log.previousDecision}</strong> → <strong>{log.newDecision}</strong>
          </div>
          <div className="rg-body-compact" style={{ color: 'var(--rg-text-secondary)' }}>
            Analyst: <span className="rg-mono">{log.analystId}</span> {log.reason && `· Note: ${log.reason}`}
          </div>
        </div>
      ))}
    </div>
  );
}
