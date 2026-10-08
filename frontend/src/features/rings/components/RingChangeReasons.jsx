import React from 'react';

const REASON_EXPLANATIONS = {
  'NEW_RING': 'Initial detection of coordinated activity',
  'MEMBER_COUNT_INCREASE': 'New members joined the ring',
  'NEW_SHARED_IP': 'New shared IP address identified',
  'NEW_SHARED_DEVICE': 'New shared device identified',
  'RISK_SCORE_INCREASE': 'Behavioral risk score escalated',
  'ACTIVITY_RESUMED': 'Dormant ring resumed activity',
  'NO_QUALIFYING_ACTIVITY': 'No suspicious activity detected in snapshot',
};

export default function RingChangeReasons({ latestSnapshot }) {
  if (!latestSnapshot) return null;
  const triggers = latestSnapshot.evidenceTriggers || [];

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-header">
        <span className="section-label-mark" />
        <span className="section-label">Change Triggers</span>
      </div>

      {triggers.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--rg-text-tertiary)', padding: '10px 0' }}>
          No new change evidence in this snapshot.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {triggers.map((trigger, idx) => (
            <div key={idx} style={{
              padding: '10px 14px',
              background: 'var(--rg-surface)',
              border: '1px solid var(--rg-border)',
              borderRadius: 3,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              <span style={{
                fontFamily: 'var(--rg-font-mono)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--rg-text-tertiary)',
                background: 'var(--rg-surface-hover)',
                border: '1px solid var(--rg-border)',
                borderRadius: 2,
                padding: '1px 5px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                alignSelf: 'flex-start',
              }}>
                {trigger}
              </span>
              <span style={{ fontSize: 13, color: 'var(--rg-text-primary)' }}>
                {REASON_EXPLANATIONS[trigger] || trigger}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
