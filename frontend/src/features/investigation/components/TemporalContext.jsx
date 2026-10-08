import React from 'react';

export default function TemporalContext({ investigation }) {
  const { temporal } = investigation || {};

  if (!temporal || Object.keys(temporal).length === 0) {
    return null;
  }

  const fields = [
    { label: 'As Of', value: temporal.asOf },
    { label: 'First Seen', value: temporal.firstSeen },
    { label: 'Last Seen', value: temporal.lastSeen },
  ].filter(f => f.value);

  if (!fields.length) return null;

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Temporal Context
      </div>
      <div className="temporal-fields">
        {fields.map(f => (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)' }}>
              {f.label}
            </span>
            <span style={{ fontFamily: 'var(--rg-font-mono)', fontSize: 13, color: 'var(--rg-text-primary)', fontWeight: 500 }}>
              {f.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
