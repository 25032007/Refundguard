import React from 'react';

export default function KpiRow({ unreviewed, critical, activeRings }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--rg-space-4)', flexWrap: 'wrap' }}>
      <div style={{ padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-brand-active)', border: 'var(--rg-border-width) solid var(--rg-brand-hover)', borderRadius: 'var(--rg-radius-md)', minWidth: '160px' }}>
        <span className="rg-meta" style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 'var(--rg-space-2)' }}>Unreviewed Cases</span>
        <span className="rg-display" style={{ color: 'var(--rg-text-inverse)' }}>{unreviewed}</span>
      </div>
      <div style={{ padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-brand-active)', border: 'var(--rg-border-width) solid var(--rg-brand-hover)', borderRadius: 'var(--rg-radius-md)', minWidth: '160px' }}>
        <span className="rg-meta" style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 'var(--rg-space-2)' }}>Critical Cases</span>
        <span className="rg-display" style={{ color: 'var(--rg-severity-critical-border)' }}>{critical}</span>
      </div>
      <div style={{ padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-brand-active)', border: 'var(--rg-border-width) solid var(--rg-brand-hover)', borderRadius: 'var(--rg-radius-md)', minWidth: '160px' }}>
        <span className="rg-meta" style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: 'var(--rg-space-2)' }}>Active Rings</span>
        <span className="rg-display" style={{ color: 'var(--rg-text-inverse)' }}>{activeRings}</span>
      </div>
    </div>
  );
}
