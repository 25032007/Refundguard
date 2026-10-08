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

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const LIFECYCLE_COLORS = {
  active: 'var(--rg-severity-critical)',
  emerging: 'var(--rg-severity-medium)',
  dormant: 'var(--rg-text-secondary)',
  disbanded: 'var(--rg-text-tertiary)',
};

export default function LifecycleTimeline({ ringHist }) {
  if (!ringHist || ringHist.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-header">
        <span className="section-label-mark" />
        <span className="section-label">Lifecycle Timeline</span>
        <span className="section-count">{ringHist.length} snapshots</span>
      </div>

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {/* Vertical timeline line */}
        <div style={{
          position: 'absolute', top: 6, bottom: 6, left: 7, width: 2,
          background: 'var(--rg-border-strong)', borderRadius: 1,
        }} />

        {ringHist.map((snap, i) => {
          const isLast = i === ringHist.length - 1;
          const lc = snap.state?.toLowerCase();
          const dotColor = LIFECYCLE_COLORS[lc] || 'var(--rg-border-strong)';

          return (
            <div key={`${snap.lastSeenAt}-${i}`} style={{ position: 'relative', marginBottom: isLast ? 0 : 20 }}>
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: -17, top: 5,
                width: 10, height: 10, borderRadius: '50%',
                background: dotColor,
                border: '2px solid var(--rg-surface)',
                zIndex: 1,
              }} />

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 100 }}>
                  <span style={{ fontFamily: 'var(--rg-font-mono)', fontSize: 11, color: 'var(--rg-text-tertiary)' }}>
                    {formatDate(snap.lastSeenAt)}
                  </span>
                </div>
                <div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '1px 7px', fontSize: 9.5, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: dotColor,
                    border: `1px solid ${dotColor}`,
                    borderRadius: 2,
                    background: 'var(--rg-surface)',
                  }}>
                    {snap.state}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  {(snap.evidenceTriggers || []).map((trigger, idx) => (
                    <div key={idx} style={{ marginBottom: 4 }}>
                      <span style={{
                        fontFamily: 'var(--rg-font-mono)', fontSize: 10,
                        color: 'var(--rg-text-secondary)', display: 'block',
                        marginBottom: 1,
                      }}>
                        {trigger}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--rg-text-primary)' }}>
                        {REASON_EXPLANATIONS[trigger] || trigger}
                      </span>
                    </div>
                  ))}
                  {(!snap.evidenceTriggers || snap.evidenceTriggers.length === 0) && (
                    <span style={{ fontSize: 12, color: 'var(--rg-text-tertiary)' }}>No lifecycle changes</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
