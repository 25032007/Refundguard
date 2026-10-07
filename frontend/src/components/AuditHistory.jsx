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
    return <div className="detail-muted">Loading audit history...</div>;
  }

  if (history.length === 0) {
    return <div className="detail-muted">No audit history available.</div>;
  }

  return (
    <div className="audit-history">
      {history.map((log, index) => (
        <div key={index} className="list-item">
          <div className="mono">
            {new Date(log.timestamp).toLocaleString()}
          </div>
          <div>
            <strong>{log.previousDecision}</strong> → <strong>{log.newDecision}</strong>
          </div>
          <div className="list-meta">
            Analyst: {log.analystId} {log.reason && `· Note: ${log.reason}`}
          </div>
        </div>
      ))}
    </div>
  );
}
