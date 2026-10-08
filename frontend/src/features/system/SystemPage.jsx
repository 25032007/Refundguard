import React, { useEffect, useState } from 'react';
import { getSummary, getHealth } from '../../services/api.js';

const SEVERITY_COLORS = {
  CRITICAL: 'var(--rg-severity-critical)',
  HIGH: 'var(--rg-severity-high)',
  MEDIUM: 'var(--rg-severity-medium)',
  LOW: 'var(--rg-severity-low)',
};
const SEVERITY_BG = {
  CRITICAL: 'var(--rg-severity-critical-bg)',
  HIGH: 'var(--rg-severity-high-bg)',
  MEDIUM: 'var(--rg-severity-medium-bg)',
  LOW: 'var(--rg-severity-low-bg)',
};
const SEVERITY_BORDER = {
  CRITICAL: 'var(--rg-severity-critical-border)',
  HIGH: 'var(--rg-severity-high-border)',
  MEDIUM: 'var(--rg-severity-medium-border)',
  LOW: 'var(--rg-severity-low-border)',
};

const DECISION_MAP = {
  UNREVIEWED: { color: 'var(--rg-text-tertiary)', bg: 'var(--rg-surface-hover)', border: 'var(--rg-border-strong)' },
  MONITOR: { color: 'var(--rg-severity-medium)', bg: 'var(--rg-severity-medium-bg)', border: 'var(--rg-severity-medium-border)' },
  ESCALATED: { color: 'var(--rg-severity-high)', bg: 'var(--rg-severity-high-bg)', border: 'var(--rg-severity-high-border)' },
  CLEARED: { color: 'var(--rg-severity-low)', bg: 'var(--rg-severity-low-bg)', border: 'var(--rg-severity-low-border)' },
};

function StatusBadge({ type, value }) {
  let style = { color: 'var(--rg-text-primary)', bg: 'var(--rg-surface)', border: 'var(--rg-border)' };
  if (type === 'risk') {
    style = { color: SEVERITY_COLORS[value] || 'var(--rg-text-tertiary)', bg: SEVERITY_BG[value] || 'var(--rg-surface-hover)', border: SEVERITY_BORDER[value] || 'var(--rg-border)' };
  } else if (type === 'decision') {
    style = DECISION_MAP[value] || DECISION_MAP.UNREVIEWED;
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: style.color,
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 2,
    }}>
      {value}
    </span>
  );
}

export default function SystemPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getSummary(),
      getHealth()
    ])
    .then(([sumData, healthData]) => {
      if (cancelled) return;
      setSummary(sumData);
      setHealth(healthData);
    })
    .catch((err) => {
      if (!cancelled) {
        console.error(err);
        setError(true);
      }
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div style={{ height: 88, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, marginBottom: 24, animation: 'rg-pulse 2s infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={{ height: 120, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
          <div style={{ height: 120, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
          <div style={{ height: 120, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
        </div>
      </div>
    );
  }

  if (error || !summary || !health) {
    return (
      <div className="page">
        <div className="rg-error-state">
          <p className="rg-error-state-title">System Data Unavailable</p>
          <p className="rg-error-state-description">Could not load operational system metrics from the API.</p>
        </div>
      </div>
    );
  }

  const { risk, decisions, rings, dataset } = summary;
  const totalCustomers = dataset?.customerCount || 0;

  return (
    <div className="page page-transition">
      <div className="page-intro">
        <div className="page-intro-content">
          <span className="page-eyebrow">Detection Health</span>
          <h1 className="page-title">System Metrics</h1>
          <p className="page-subtitle">
            Operational detector posture and global investigation state.
          </p>
        </div>
      </div>

      <div className="system-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="system-stat-block">
          <div className="system-stat-eyebrow">
            <span className="system-stat-operational-dot" />
            System Status
          </div>
          <div className="system-stat-primary">Operational</div>
          <div className="system-stat-secondary">Dataset ID: {health.datasetId || 'unknown'} (Build: {health.coldBuildMs}ms)</div>
        </div>

        <div className="system-stat-block">
          <div className="system-stat-eyebrow">Global Customers</div>
          <div className="system-stat-primary">{totalCustomers}</div>
          <div className="system-stat-secondary">Total customers in dataset.</div>
        </div>

        <div className="system-stat-block">
          <div className="system-stat-eyebrow">Ring Intelligence</div>
          <div className="system-stat-primary">{rings?.total || 0}</div>
          <div className="system-stat-secondary">Total detected rings in snapshot.</div>
        </div>
      </div>

      <div className="system-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {/* Risk Distribution */}
        <div>
          <div className="section-header">
            <span className="section-label-mark" />
            <span className="section-label">Risk Distribution</span>
          </div>
          <div className="system-dist-table">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
              <div key={level} className="system-dist-row">
                <StatusBadge type="risk" value={level} />
                <span className="system-dist-count">{risk[level] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Analyst Decisions */}
        <div>
          <div className="section-header">
            <span className="section-label-mark" />
            <span className="section-label">Analyst Decisions</span>
          </div>
          <div className="system-dist-table">
            {['UNREVIEWED', 'ESCALATED', 'MONITOR', 'CLEARED'].map(dec => (
              <div key={dec} className="system-dist-row">
                <StatusBadge type="decision" value={dec} />
                <span className="system-dist-count">{decisions[dec] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
