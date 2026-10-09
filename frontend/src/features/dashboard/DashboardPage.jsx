import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Badge from '../../ui/Badge';
import { getSummary, getInvestigations } from '../../services/api.js';

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
        <div style={{ height: 140, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, animation: 'rg-pulse 1.8s infinite', marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ height: 280, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, animation: 'rg-pulse 1.8s infinite' }} />
          <div style={{ height: 280, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, animation: 'rg-pulse 1.8s infinite' }} />
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
      {/* HERO BANNER */}
      <div className="animate-fade-in-up stagger-1" style={{
        padding: '28px 32px',
        background: 'var(--rg-surface)',
        border: '1px solid var(--rg-border)',
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: 'var(--rg-shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--rg-brand)', letterSpacing: '-0.02em' }}>RefundGuard Intelligence</h1>
            <h2 style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--rg-text-secondary)' }}>
              Real-time refund fraud, ring network & risk posture analytics
            </h2>
          </div>
          {dataset && (
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--rg-text-secondary)', background: 'var(--rg-surface-sidebar)', padding: '8px 14px', borderRadius: 6, border: '1px solid var(--rg-border)' }}>
              <div style={{ fontWeight: 700, color: 'var(--rg-text-primary)', marginBottom: 2 }}>Dataset: {dataset.source} (seed: {dataset.seed})</div>
              <div className="tabular-nums">{total.toLocaleString()} customers • graph network engine active</div>
            </div>
          )}
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="animate-fade-in-up stagger-2" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: '16px 20px', boxShadow: 'var(--rg-shadow-sm)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 6 }}>Total Tracked</div>
          <div className="tabular-nums" style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 700 }}>{total.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: '16px 20px', borderLeft: '4px solid var(--risk-med)', boxShadow: 'var(--rg-shadow-sm)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 6 }}>Unreviewed Cases</div>
          <div className="tabular-nums" style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 700, color: 'var(--risk-med)' }}>{decisions.UNREVIEWED.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: '16px 20px', borderLeft: '4px solid var(--risk-crit)', boxShadow: 'var(--rg-shadow-sm)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 6 }}>Critical Risk</div>
          <div className="tabular-nums" style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 700, color: 'var(--risk-crit)' }}>{risk.CRITICAL.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: '16px 20px', boxShadow: 'var(--rg-shadow-sm)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 6 }}>Detected Rings</div>
          <div className="tabular-nums" style={{ fontSize: 24, fontFamily: 'var(--rg-font-mono)', fontWeight: 700 }}>{rings?.total || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* RISK POSTURE */}
        <div className="animate-fade-in-up stagger-3" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: 24, boxShadow: 'var(--rg-shadow-sm)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Risk Posture</h3>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => {
            const count = risk[level] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={level} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                  <Badge severity={level.toLowerCase()}>{level}</Badge>
                  <span className="mono tabular-nums" style={{ fontWeight: 600 }}>{count.toLocaleString()} <span style={{ color: 'var(--rg-text-tertiary)', marginLeft: 8 }}>{pct}%</span></span>
                </div>
                <div style={{ height: 6, background: 'var(--rg-surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: `var(--risk-${level.toLowerCase() === 'medium' ? 'med' : level.toLowerCase() === 'critical' ? 'crit' : level.toLowerCase()})`, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ANALYST WORKLOAD */}
        <div className="animate-fade-in-up stagger-3" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: 24, display: 'flex', flexDirection: 'column', boxShadow: 'var(--rg-shadow-sm)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Analyst Workload</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--rg-surface-sidebar)', border: '1px solid var(--rg-border-strong)', borderRadius: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rg-text-primary)' }}>Unreviewed Queue</span>
              <Badge decision="unreviewed">{decisions.UNREVIEWED.toLocaleString()}</Badge>
            </div>
            {['MONITOR', 'ESCALATED', 'CLEARED'].map(dec => (
              <div key={dec} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--rg-border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--rg-text-secondary)', textTransform: 'capitalize', fontWeight: 500 }}>{dec.toLowerCase()}</span>
                <span className="mono tabular-nums" style={{ fontSize: 13, fontWeight: 600 }}>{decisions[dec].toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/triage')}
            className="rg-button rg-button--primary"
            style={{ marginTop: 20, width: '100%' }}
          >
            Review Unreviewed Cases &rarr;
          </button>
        </div>

        {/* TOP SIGNALS */}
        <div className="animate-fade-in-up stagger-4" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: 24, boxShadow: 'var(--rg-shadow-sm)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Most Common Risk Signals</h3>
          {topSignals && topSignals.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {topSignals.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--rg-border-subtle)' }}>
                    <td style={{ padding: '10px 0', fontSize: 13 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginRight: 8 }}>{s.type}</span>
                      {s.label}
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'var(--rg-font-mono)', fontSize: 13, color: 'var(--rg-text-secondary)' }} className="tabular-nums">{s.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--rg-text-secondary)' }}>No signals available.</div>
          )}
        </div>
      </div>

      {/* PRIORITY UNREVIEWED INVESTIGATIONS */}
      <div className="animate-fade-in-up stagger-5" style={{ background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 6, padding: 24, boxShadow: 'var(--rg-shadow-sm)' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Priority Unreviewed Investigations</h3>
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
                const rl = (c.riskLevel || 'LOW').toLowerCase();
                const topSig = c.topSignal;
                return (
                  <tr key={c.customerId} onClick={() => navigate(`/investigations/${c.customerId}`)} style={{ cursor: 'pointer' }}>
                    <td className="mono" style={{ fontWeight: 600 }}>{c.customerId}</td>
                    <td>
                      <Badge severity={rl}>{c.riskLevel}</Badge>
                    </td>
                    <td className="mono tabular-nums">{c.riskScore}</td>
                    <td style={{ fontSize: 12 }}>{topSig ? `${topSig.label} (${topSig.contribution}pts)` : '—'}</td>
                    <td>{c.ring ? <span className="mono" style={{ fontSize: 11, color: 'var(--rg-brand)' }}>{c.ring.ringId}</span> : '—'}</td>
                    <td>
                      <Badge decision="unreviewed">UNREVIEWED</Badge>
                    </td>
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
