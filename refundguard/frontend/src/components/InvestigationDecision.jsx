import { useState } from 'react';

export const DECISION_STATES = ['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'];

const DECISION_LABELS = {
  UNREVIEWED: 'Not yet reviewed',
  MONITOR: 'CASE MARKED FOR MONITORING',
  ESCALATED: 'CASE ESCALATED',
  CLEARED: 'CASE CLEARED',
};

/**
 * Local analyst decision workflow. Controlled component: `value`/`onChange`
 * come from the page so multiple surfaces (status + final decision) share one
 * in-session state. The decision is explicitly local React state only — it is
 * never persisted to a server, and the current state is always rendered as
 * readable text for accessibility.
 */
export default function InvestigationDecision({ value = 'UNREVIEWED', onChange }) {
  const [ack, setAck] = useState(null);

  const choose = (next) => {
    if (onChange) onChange(next);
    setAck(DECISION_LABELS[next]);
  };

  return (
    <div className="decision-block">
      <div className="decision-current">
        <span className="decision-label">Status</span>
        <span
          className={`decision-status decision-status--${String(value).toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          {value}
        </span>
        <span className="decision-note">LOCAL ANALYST DECISION</span>
      </div>

      <div className="decision-actions" role="group" aria-label="Investigation decision">
        <button
          type="button"
          className="btn decision-btn"
          onClick={() => choose('MONITOR')}
          aria-pressed={value === 'MONITOR'}
        >
          Monitor
        </button>
        <button
          type="button"
          className="btn decision-btn decision-btn--escalate"
          onClick={() => choose('ESCALATED')}
          aria-pressed={value === 'ESCALATED'}
        >
          Escalate
        </button>
        <button
          type="button"
          className="btn decision-btn decision-btn--clear"
          onClick={() => choose('CLEARED')}
          aria-pressed={value === 'CLEARED'}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn decision-btn decision-btn--reset"
          onClick={() => choose('UNREVIEWED')}
          aria-pressed={value === 'UNREVIEWED'}
        >
          Unreviewed
        </button>
      </div>

      {ack && (
        <div className="decision-ack" role="status" aria-live="polite">
          {ack}
        </div>
      )}
    </div>
  );
}