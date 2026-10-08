import { useState, useEffect } from 'react';
import Button from '../ui/Button.jsx';

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
    <div className="rg-decision-block" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-4)' }}>
      <div className="rg-decision-current" style={{ display: 'flex', alignItems: 'center', gap: 'var(--rg-space-2)' }}>
        <span className="rg-meta">Current Status</span>
        <span
          className={`rg-decision-status`}
          role="status"
          aria-live="polite"
        >
          <span style={{ fontWeight: 600 }}>{currentDecision}</span>
        </span>
      </div>

      <div className="rg-decision-actions" role="group" aria-label="Investigation decision" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rg-space-2)' }}>
        <Button
          variant={activeDecision === 'MONITOR' ? 'primary' : 'secondary'}
          onClick={() => handleSelect('MONITOR')}
          aria-pressed={activeDecision === 'MONITOR'}
          disabled={isSaving}
        >
          Monitor
        </Button>
        <Button
          variant={activeDecision === 'ESCALATED' ? 'primary' : 'secondary'}
          onClick={() => handleSelect('ESCALATED')}
          aria-pressed={activeDecision === 'ESCALATED'}
          disabled={isSaving}
        >
          Escalate
        </Button>
        <Button
          variant={activeDecision === 'CLEARED' ? 'primary' : 'secondary'}
          onClick={() => handleSelect('CLEARED')}
          aria-pressed={activeDecision === 'CLEARED'}
          disabled={isSaving}
        >
          Clear
        </Button>
        <Button
          variant={activeDecision === 'UNREVIEWED' ? 'primary' : 'secondary'}
          onClick={() => handleSelect('UNREVIEWED')}
          aria-pressed={activeDecision === 'UNREVIEWED'}
          disabled={isSaving}
        >
          Unreviewed
        </Button>
      </div>

      {isDraft && (
        <div className="rg-decision-draft-panel" style={{ marginTop: 'var(--rg-space-2)' }}>
          <div className="rg-decision-draft-header" style={{ marginBottom: 'var(--rg-space-2)' }}>
            <span className="rg-meta">Pending decision: </span> <strong>{DECISION_LABELS[draftDecision]}</strong>
          </div>
          <textarea
            className="rg-decision-reason-input"
            placeholder="Enter reason for decision (required for Escalate/Clear)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSaving}
            rows={3}
            style={{ width: '100%', padding: 'var(--rg-space-2)', background: 'var(--rg-surface)', color: 'var(--rg-text-primary)', border: 'var(--rg-border-width) solid var(--rg-border-strong)', borderRadius: 'var(--rg-radius-md)', fontFamily: 'var(--rg-font-sans)', fontSize: 'var(--rg-text-body)' }}
          />
          <div className="rg-decision-draft-actions" style={{ marginTop: 'var(--rg-space-2)', display: 'flex', gap: 'var(--rg-space-2)' }}>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Decision'}
            </Button>
            <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" style={{ color: 'var(--rg-severity-critical)', marginTop: 'var(--rg-space-2)', fontSize: 'var(--rg-text-body-compact)' }}>
          {error}
        </div>
      )}

      {ack && !isDraft && (
        <div role="status" aria-live="polite" style={{ color: 'var(--rg-severity-low)', marginTop: 'var(--rg-space-2)', fontSize: 'var(--rg-text-body-compact)' }}>
          {ack}
        </div>
      )}
    </div>
  );
}