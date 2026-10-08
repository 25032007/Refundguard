import { useState, useEffect } from 'react';

export const DECISION_STATES = ['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'];

const DECISION_LABELS = {
  UNREVIEWED: 'Unreviewed',
  MONITOR: 'Mark for Monitoring',
  ESCALATED: 'Escalate Case',
  CLEARED: 'Clear Case',
};

export default function InvestigationDecision({ currentDecision = 'UNREVIEWED', onSave, isSaving, externalError }) {
  const [draftDecision, setDraftDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    setDraftDecision(null);
    setReason('');
    setLocalError(null);
  }, [currentDecision]);

  const activeDecision = draftDecision || currentDecision;
  const isDraft = draftDecision !== null;
  const error = externalError || localError;

  const handleSelect = (next) => {
    setDraftDecision(next);
    setLocalError(null);
  };

  const handleSave = async () => {
    if (!draftDecision) return;

    // Validation matching the API
    if (['ESCALATED', 'CLEARED'].includes(draftDecision) && !reason.trim()) {
      setLocalError('Reason is required for Escalated or Cleared decisions.');
      return;
    }

    setLocalError(null);
    try {
      await onSave(draftDecision, reason);
      // parent handles success by invalidating query
    } catch (e) {
      // Parent handles the error display or 409
    }
  };

  const handleCancel = () => {
    setDraftDecision(null);
    setReason('');
    setLocalError(null);
  };

  const DECISION_STATUS_COLORS = {
    UNREVIEWED: { color: 'var(--rg-text-tertiary)', bg: 'var(--rg-surface-hover)', border: 'var(--rg-border-strong)' },
    MONITOR: { color: 'var(--rg-severity-medium)', bg: 'var(--rg-severity-medium-bg)', border: 'var(--rg-severity-medium-border)' },
    ESCALATED: { color: 'var(--rg-severity-high)', bg: 'var(--rg-severity-high-bg)', border: 'var(--rg-severity-high-border)' },
    CLEARED: { color: 'var(--rg-severity-low)', bg: 'var(--rg-severity-low-bg)', border: 'var(--rg-severity-low-border)' },
  };

  const currentStyle = DECISION_STATUS_COLORS[currentDecision] || DECISION_STATUS_COLORS.UNREVIEWED;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Current status */}
      <div className="decision-current-status">
        <span className="decision-status-label">Current:</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 10px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: currentStyle.color,
          background: currentStyle.bg,
          border: `1px solid ${currentStyle.border}`,
          borderRadius: 2,
        }}>
          {currentDecision}
        </span>
      </div>

      {/* Decision buttons */}
      <div className="decision-actions-row">
        {(['MONITOR', 'ESCALATED', 'CLEARED']).map(d => {
          const isActive = activeDecision === d;
          let extraClass = '';
          if (d === 'ESCALATED') extraClass = ' decision-btn--escalate';
          if (d === 'CLEARED') extraClass = ' decision-btn--clear';
          return (
            <button
              key={d}
              className={`decision-btn${extraClass}`}
              onClick={() => handleSelect(d)}
              aria-pressed={isActive}
              disabled={isSaving}
            >
              {DECISION_LABELS[d]}
            </button>
          );
        })}
      </div>

      {/* Draft confirmation area */}
      {isDraft && (
        <div className="animate-fade-in">
          <div className="decision-draft-notice">
            Pending decision: <strong>{DECISION_LABELS[draftDecision]}</strong>
          </div>
          <textarea
            className="decision-reason-textarea"
            placeholder="Enter reason for decision (required for Escalate / Clear)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSaving}
            rows={3}
            aria-label="Decision reason"
          />
          <div className="decision-save-row">
            <button
              className="rg-button rg-button--primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save Decision'}
            </button>
            <button
              className="rg-button rg-button--secondary"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="decision-err animate-fade-in" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
    </div>
  );
}