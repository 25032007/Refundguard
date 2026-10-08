import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSummary, getInvestigations } from '../../services/api.js';

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

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: summary, isLoading: isLoadingSummary, isError: isErrorSummary } = useQuery({
    queryKey: ['summary'],
    queryFn: getSummary,
  });

  const { data: listData, isLoading: isLoadingList, isError: isErrorList } = useQuery({
    queryKey: ['investigations', { scope: 'all', sort: '-score', pageSize: 10, status: 'UNREVIEWED' }],
    queryFn: () => getInvestigations({ scope: 'all', sort: '-score', pageSize: 10, status: 'UNREVIEWED' }),
  });

  if (isLoadingSummary || isLoadingList) {
    return (
      <div className="page">
        <div style={{ height: 160, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite', marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ height: 300, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
          <div style={{ height: 300, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
        </div>
      </div>
    );
  }

  if (isErrorSummary || isErrorList || !summary) {
    return (
      <div className="page">
        <div className="rg-error-state">
          <p className="rg-error-state-title">Data Unavailable</p>
          <p className="rg-error-state-description">Could not load dashboard metrics from the API.</p>
        </div>
      </div>
    );
  }

  const { dataset, risk, decisions, rings, topSignals } = summary;
  const total = dataset?.customerCount || 0;
  const unreviewedList = listData?.items || [];

  return (
    <div className="page page-transition" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* HERO */}
      <div className="animate-fade-in-up stagger-1" style={{
        padding: '32px 32px',
        background: 'var(--rg-surface)',
        border: '1px solid var(--rg-border)',
        borderRadius: 4,
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 300, color: 'var(--rg-brand)' }}>RefundGuard</h1>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rg-text-primary)' }}>
              Refund Fraud Intelligence
            </h2>
          </div>
          {dataset && (
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--rg-text-secondary)', background: 'var(--rg-surface-hover)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--rg-border-subtle)' }}>
              <div style={{ fontWeight: 600, color: 'var(--rg-text-primary)', marginBottom: 2 }}>Dataset: {dataset.source} (seed: {dataset.seed})</div>
              <div>{total.toLocaleString()} customers • synthetic IP/device/complaints</div>
            </div>
          )}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--rg-text-secondary)', maxWidth: 600, lineHeight: 1.5 }}>
          Current detection posture across customer risk, refund behavior, complaints and refund rings.
        </p>
      </div>

      {/* KPI STRIP */}
      <div className="animate-fade-in-up stagger-2" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 8 }}>Total Tracked</div>
          <div style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 600 }}>{total.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: '16px 20px', borderLeft: '3px solid var(--rg-severity-medium)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 8 }}>Unreviewed Cases</div>
          <div style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 600 }}>{decisions.UNREVIEWED.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: '16px 20px', borderLeft: '3px solid var(--rg-severity-critical)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 8 }}>Critical Risk</div>
          <div style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 600 }}>{risk.CRITICAL.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 8 }}>Detected Rings</div>
          <div style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 600 }}>{rings?.total || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* RISK POSTURE */}
        <div className="animate-fade-in-up stagger-3" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Risk Posture</h3>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => {
            const count = risk[level] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={level} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase', color: SEVERITY_COLORS[level] }}>{level}</span>
                  <span className="mono">{count.toLocaleString()} <span style={{ color: 'var(--rg-text-tertiary)', marginLeft: 8 }}>{pct}%</span></span>
                </div>
                <div style={{ height: 6, background: 'var(--rg-surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: SEVERITY_COLORS[level], width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ANALYST WORKLOAD */}
        <div className="animate-fade-in-up stagger-3" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Analyst Workload</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--rg-severity-medium-bg)', border: '1px solid var(--rg-severity-medium-border)', borderRadius: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--rg-text-primary)' }}>Unreviewed</span>
              <span className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{decisions.UNREVIEWED.toLocaleString()}</span>
            </div>
            {['MONITOR', 'ESCALATED', 'CLEARED'].map(dec => (
              <div key={dec} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--rg-border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--rg-text-secondary)', textTransform: 'capitalize' }}>{dec.toLowerCase()}</span>
                <span className="mono" style={{ fontSize: 13 }}>{decisions[dec].toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/triage')}
            style={{
              marginTop: 20, padding: '10px 16px', background: 'var(--rg-brand)', color: 'white',
              border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Review unreviewed cases &rarr;
          </button>
        </div>

        {/* REFUND RING POSTURE */}
        <div className="animate-fade-in-up stagger-4" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Refund Ring Posture</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--rg-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Tracked</div>
              <div className="mono">{rings?.total || 0}</div>
            </div>
          </div>
          {!rings?.byLifecycle && <div style={{ fontSize: 12, color: 'var(--rg-text-secondary)' }}>Lifecycle data not available yet.</div>}
        </div>

        {/* TOP SIGNALS */}
        <div className="animate-fade-in-up stagger-4" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Most Common Risk Signals</h3>
          {topSignals && topSignals.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {topSignals.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--rg-border-subtle)' }}>
                    <td style={{ padding: '10px 0', fontSize: 13 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginRight: 8 }}>{s.type}</span>
                      {s.label}
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'var(--rg-font-mono)', fontSize: 13, color: 'var(--rg-text-secondary)' }}>{s.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--rg-text-secondary)' }}>No signals available.</div>
          )}
        </div>
      </div>

      {/* TOP 10 UNREVIEWED */}
      <div className="animate-fade-in-up stagger-5" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, padding: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Priority Unreviewed Investigations</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Risk</th>
                <th>Score</th>
                <th>Strongest Signal</th>
                <th>Ring</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {unreviewedList.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--rg-text-secondary)' }}>No unreviewed cases.</td></tr>
              ) : unreviewedList.map(c => {
                const rl = c.riskLevel;
                const topSig = c.topSignal;
                return (
                  <tr key={c.customerId} onClick={() => navigate(`/investigations/${c.customerId}`)} style={{ cursor: 'pointer' }}>
                    <td className="mono" style={{ fontWeight: 600 }}>{c.customerId}</td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: SEVERITY_COLORS[rl], background: SEVERITY_BG[rl], padding: '2px 6px', borderRadius: 2, border: `1px solid ${SEVERITY_BORDER[rl]}` }}>
                        {rl}
                      </span>
                    </td>
                    <td className="mono">{c.riskScore}</td>
                    <td style={{ fontSize: 12 }}>{topSig ? `${topSig.label} (${topSig.contribution}pts)` : '—'}</td>
                    <td>{c.ring ? <span className="mono" style={{ fontSize: 11, color: 'var(--rg-brand)' }}>{c.ring.ringId}</span> : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--rg-text-secondary)' }}>UNREVIEWED</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
