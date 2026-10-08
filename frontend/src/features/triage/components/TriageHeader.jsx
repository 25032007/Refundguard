import React from 'react';

export default function TriageHeader({ summary, scope, onScopeChange, searchInput, setSearchInput }) {
  const unreviewedCount = summary?.decisions?.UNREVIEWED || 0;
  const criticalCount = summary?.risk?.CRITICAL || 0;
  const highCount = summary?.risk?.HIGH || 0;
  const activeRingsCount = summary?.rings?.byLifecycle?.ACTIVE || 0;

  return (
    <div className="page-intro">
      <div className="page-intro-content">
        <span className="page-eyebrow">Investigation Console</span>
        <h1 className="page-title">Case Triage</h1>
        <p className="page-subtitle">
          {summary?.dataset?.customerCount?.toLocaleString() || 0} customers — sorted by risk score
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => onScopeChange('all')}
              style={{ padding: '6px 12px', background: scope === 'all' ? 'var(--rg-surface-hover)' : 'transparent', border: 'none', color: scope === 'all' ? 'var(--rg-text-primary)' : 'var(--rg-text-secondary)', cursor: 'pointer', fontWeight: scope === 'all' ? 600 : 400 }}
            >
              All Cases
            </button>
            <div style={{ width: 1, background: 'var(--rg-border)' }} />
            <button
              onClick={() => onScopeChange('flagged')}
              style={{ padding: '6px 12px', background: scope === 'flagged' ? 'var(--rg-surface-hover)' : 'transparent', border: 'none', color: scope === 'flagged' ? 'var(--rg-text-primary)' : 'var(--rg-text-secondary)', cursor: 'pointer', fontWeight: scope === 'flagged' ? 600 : 400 }}
            >
              Flagged Only
            </button>
          </div>
          <input
            type="text"
            placeholder="Search Customer ID..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ padding: '6px 12px', background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, color: 'var(--rg-text-primary)', width: 200 }}
          />
        </div>
      </div>

      <div className="kpi-bar" style={{ marginBottom: 0, alignSelf: 'flex-start' }}>
        <div className="kpi-cell">
          <span className="kpi-label">Unreviewed</span>
          <span className={`kpi-value${unreviewedCount > 0 ? ' kpi-value--alert' : ' kpi-value--ok'}`}>
            {unreviewedCount.toLocaleString()}
          </span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Critical</span>
          <span className={`kpi-value${criticalCount > 0 ? ' kpi-value--alert' : ''}`}>
            {criticalCount.toLocaleString()}
          </span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">High</span>
          <span className={`kpi-value${highCount > 0 ? ' kpi-value--warn' : ''}`}>
            {highCount.toLocaleString()}
          </span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Active Rings</span>
          <span className={`kpi-value${activeRingsCount > 0 ? ' kpi-value--warn' : ''}`}>
            {activeRingsCount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
