import React from 'react';

export default function RiskSummary({ investigation }) {
  const { risk, summary } = investigation || {};
  const signals = [...(risk?.signals || [])].sort((a, b) => b.contribution - a.contribution).slice(0, 3); // top 3 for narrative

  if (!signals.length) {
    return (
      <div className="inv-section">
        <div className="inv-section-title">
          <span className="inv-section-title-bar" />
          Why this case is flagged
        </div>
        <div style={{ fontSize: 13, color: 'var(--rg-text-tertiary)' }}>No significant risk signals detected.</div>
      </div>
    );
  }

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Why this case is flagged
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {signals.map((sig, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--rg-text-primary)' }}>
                {sig.title || (sig.type ? sig.type.replace(/_/g, ' ') : 'Risk Signal')}
              </h4>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: sig.contribution > 10 ? 'var(--rg-severity-critical)' : 'var(--rg-text-secondary)' }}>
                Contribution +{sig.contribution}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--rg-text-secondary)', lineHeight: 1.5 }}>
              {sig.description || 'No description provided by the risk engine.'}
            </p>
          </div>
        ))}
      </div>

      {summary?.recommendation && (
        <div style={{
          marginTop: 20,
          padding: '12px 16px',
          background: 'var(--rg-surface-hover)',
          borderLeft: '3px solid var(--rg-border-brand)',
          borderRadius: '0 3px 3px 0',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--rg-text-primary)',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', display: 'block', marginBottom: 4 }}>
            System Recommendation
          </span>
          {summary.recommendation}
        </div>
      )}
    </div>
  );
}
