import { useState, useEffect } from 'react';

export const DECISION_STATES = ['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'];

const DECISION_LABELS = {
  UNREVIEWED: 'Unreviewed',
  MONITOR: 'Mark for Monitoring',
  ESCALATED: 'Escalate Case',
  CLEARED: 'Clear Case',
};

export default function InvestigationDecision({ currentDecision = 'UNREVIEWED', onSave }) {
  const [draftDecision, setDraftDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ack, setAck] = useState(null);

  // Sync draft with current when current changes if no active draft
  useEffect(() => {
    setDraftDecision(null);
    setReason('');
    setError(null);
    setAck(null);
  }, [currentDecision]);

  const activeDecision = draftDecision || currentDecision;
  const isDraft = draftDecision !== null;

  const handleSelect = (next) => {
    setDraftDecision(next);
    setError(null);
    setAck(null);
  };

  const handleSave = async () => {
    if (!draftDecision) return;
    setIsSaving(true);
    setError(null);
    setAck(null);
    try {
      await onSave(draftDecision, reason);
      setAck('Decision saved successfully.');
      setDraftDecision(null);
      setReason('');
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to save decision.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftDecision(null);
    setReason('');
    setError(null);
  };

  return (
    <div className="decision-block">
      <div className="decision-current">
        <span className="decision-label">Current Status</span>
        <span
          className={`decision-status decision-status--${String(currentDecision).toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          {currentDecision}
        </span>
      </div>

      <div className="decision-actions" role="group" aria-label="Investigation decision">
        <button
          type="button"
          className="btn decision-btn"
          onClick={() => handleSelect('MONITOR')}
          aria-pressed={activeDecision === 'MONITOR'}
          disabled={isSaving}
        >
          Monitor
        </button>
        <button
          type="button"
          className="btn decision-btn decision-btn--escalate"
          onClick={() => handleSelect('ESCALATED')}
          aria-pressed={activeDecision === 'ESCALATED'}
          disabled={isSaving}
        >
          Escalate
        </button>
        <button
          type="button"
          className="btn decision-btn decision-btn--clear"
          onClick={() => handleSelect('CLEARED')}
          aria-pressed={activeDecision === 'CLEARED'}
          disabled={isSaving}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn decision-btn decision-btn--reset"
          onClick={() => handleSelect('UNREVIEWED')}
          aria-pressed={activeDecision === 'UNREVIEWED'}
          disabled={isSaving}
        >
          Unreviewed
        </button>
      </div>

      {isDraft && (
        <div className="decision-draft-panel">
          <div className="decision-draft-header">
            <strong>Pending decision: </strong> {DECISION_LABELS[draftDecision]}
          </div>
          <textarea
            className="decision-reason-input"
            placeholder="Enter reason for decision (required for Escalate/Clear)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSaving}
            rows={3}
            style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px' }}
          />
          <div className="decision-draft-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={handleSave} disabled={isSaving} style={{ background: 'var(--accent)', color: 'var(--bg-main)', padding: '4px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {isSaving ? 'Saving...' : 'Save Decision'}
            </button>
            <button className="btn" onClick={handleCancel} disabled={isSaving} style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '4px 12px', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="decision-ack" role="alert" aria-live="assertive" style={{ color: 'var(--status-danger)', marginTop: '8px' }}>
          {error}
        </div>
      )}

      {ack && !isDraft && (
        <div className="decision-ack" role="status" aria-live="polite" style={{ color: 'var(--status-success)', marginTop: '8px' }}>
          {ack}
        </div>
      )}
    </div>
  );
}