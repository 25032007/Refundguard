import React from 'react';

export default function RingHeader({ selectedRingId, ring, onBack }) {
  return (
    <div className="ring-intel-header">
      {selectedRingId && (
        <button className="back-link" onClick={onBack} type="button">
          ← Ring Intelligence
        </button>
      )}

      <div className="page-intro" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
        <div className="page-intro-content">
          <span className="page-eyebrow">
            {selectedRingId ? 'Ring Detail' : 'Ring Intelligence'}
          </span>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedRingId ? (
              <>
                <span style={{ fontFamily: 'var(--rg-font-mono)', fontSize: 18, marginRight: 12 }}>
                  {selectedRingId}
                </span>
                {ring && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 500, color: 'var(--rg-text-secondary)' }}>
                    {ring.severity && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--rg-severity-critical)',
                        background: 'var(--rg-severity-critical-bg)',
                        border: '1px solid var(--rg-severity-critical-border)',
                        borderRadius: 2,
                      }}>
                        {ring.severity}
                      </span>
                    )}
                    <span>Score {ring.score}</span>
                    <span>&middot;</span>
                    <span>{ring.memberCount} members</span>
                  </div>
                )}
              </>
            ) : (
              'Ring Intelligence'
            )}
          </h1>
          <p className="page-subtitle">
            {selectedRingId
              ? 'Temporal investigation of ring evolution and membership.'
              : 'Track coordinated refund behavior across the customer network.'}
          </p>
        </div>
      </div>
    </div>
  );
}
