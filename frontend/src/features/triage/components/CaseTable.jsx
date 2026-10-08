import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatSignalType } from '../../../utils/format';

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

const DECISION_COLORS = {
  UNREVIEWED: { color: 'var(--rg-text-tertiary)', bg: 'var(--rg-surface-hover)', border: 'var(--rg-border-strong)' },
  MONITOR: { color: 'var(--rg-severity-medium)', bg: 'var(--rg-severity-medium-bg)', border: 'var(--rg-severity-medium-border)' },
  ESCALATED: { color: 'var(--rg-severity-high)', bg: 'var(--rg-severity-high-bg)', border: 'var(--rg-severity-high-border)' },
  CLEARED: { color: 'var(--rg-severity-low)', bg: 'var(--rg-severity-low-bg)', border: 'var(--rg-severity-low-border)' },
};

function RiskBadge({ level, score }) {
  const color = SEVERITY_COLORS[level] || 'var(--rg-text-tertiary)';
  const bg = SEVERITY_BG[level] || 'var(--rg-surface-hover)';
  const border = SEVERITY_BORDER[level] || 'var(--rg-border)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color, background: bg, border: `1px solid ${border}`, borderRadius: 2, whiteSpace: 'nowrap',
    }}>
      {level} {score != null && <span style={{ fontFamily: 'var(--rg-font-mono)', fontWeight: 600, fontSize: 11, borderLeft: `1px solid ${color}`, paddingLeft: 6 }}>{score}</span>}
    </span>
  );
}

function DecisionBadge({ decision }) {
  const d = DECISION_COLORS[decision] || DECISION_COLORS.UNREVIEWED;
  const isUnreviewed = decision === 'UNREVIEWED';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: d.color, background: d.bg, border: `1px solid ${d.border}`, borderRadius: 2, whiteSpace: 'nowrap',
      outline: isUnreviewed ? '1px solid var(--rg-severity-critical)' : 'none', outlineOffset: '1px',
    }}>
      {decision}
    </span>
  );
}

function ExpandableRow({ row, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const level = row.riskLevel || 'LOW';
  const isHighPriority = level === 'CRITICAL' || level === 'HIGH';
  const topSignal = row.topSignal;
  const complaintCount = row.complaintCount || 0;

  return (
    <React.Fragment>
      <tr
        className="case-row"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', borderLeft: isHighPriority ? `3px solid ${SEVERITY_COLORS[level]}` : 'none', background: expanded ? 'var(--rg-surface-hover)' : 'inherit' }}
      >
        <td style={{ width: 40, textAlign: 'center', color: 'var(--rg-text-tertiary)', transition: 'transform var(--rg-transition-fast)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </td>
        <td data-label="Customer">
          <span className="mono" style={{ fontWeight: 600 }}>{row.customerId}</span>
        </td>
        <td data-label="Risk">
          <RiskBadge level={level} score={row.riskScore} />
        </td>
        <td data-label="Top Signal">
          {topSignal ? (
            <span style={{ fontSize: 12 }}>{formatSignalType(topSignal.type)}: {topSignal.label}</span>
          ) : <span style={{ color: 'var(--rg-text-tertiary)' }}>—</span>}
        </td>
        <td data-label="Complaints">
          <span className="mono">{complaintCount}</span>
        </td>
        <td data-label="Ring">
          {row.ring ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="mono">{row.ring.ringId}</span>
              <span style={{ fontSize: 10, color: 'var(--rg-text-secondary)' }}>Score: <span className="mono">{row.ring.score || '—'}</span></span>
            </div>
          ) : <span style={{ fontSize: 12, color: 'var(--rg-text-tertiary)' }}>—</span>}
        </td>
        <td data-label="Status">
          <DecisionBadge decision={row.status || 'UNREVIEWED'} />
        </td>
        <td data-label="Action" style={{ textAlign: 'right' }}>
          <button
            className="case-table-action"
            onClick={(e) => { e.stopPropagation(); navigate(`/investigations/${row.customerId}`); }}
            style={{ background: 'var(--rg-brand)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
          >
            Investigate →
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: 'var(--rg-surface-hover)', borderLeft: isHighPriority ? `3px solid ${SEVERITY_COLORS[level]}` : 'none' }}>
          <td colSpan={8} style={{ padding: 0 }}>
            <div className="animate-fade-in-up" style={{ padding: '16px 48px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {/* Evidence Ledger summary here? Or keep it light? */}
              <div style={{ flex: '1 1 200px' }}>
                <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', borderBottom: '1px solid var(--rg-border)', paddingBottom: 6, marginBottom: 12 }}>Summary Note</h4>
                <div style={{ fontSize: 12, color: 'var(--rg-text-primary)' }}>
                  Click Investigate to see full details, related rings, and submit a decision.
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

export default function CaseTable({ cases, isLoading, isFiltered, onClear, hasFilters }) {
  const navigate = useNavigate();

  return (
    <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
      <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--rg-surface)', borderBottom: '2px solid var(--rg-border)' }}>
            <th style={{ width: 40 }}></th>
            <th data-label="Customer">Customer</th>
            <th data-label="Risk">Risk</th>
            <th data-label="Top Signal">Top Signal</th>
            <th data-label="Complaints">Complaints</th>
            <th data-label="Ring">Ring Association</th>
            <th data-label="Status">Status</th>
            <th data-label="Action" style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--rg-border-subtle)' }}>
                <td><div style={{ width: 16, height: 16, background: 'var(--rg-surface-hover)', borderRadius: 2, animation: 'rg-pulse 1.5s infinite' }} /></td>
                <td><div style={{ width: 100, height: 14, background: 'var(--rg-surface-hover)', borderRadius: 2, animation: 'rg-pulse 1.5s infinite' }} /></td>
                <td><div style={{ width: 60, height: 20, background: 'var(--rg-surface-hover)', borderRadius: 2, animation: 'rg-pulse 1.5s infinite' }} /></td>
                <td><div style={{ width: 150, height: 14, background: 'var(--rg-surface-hover)', borderRadius: 2, animation: 'rg-pulse 1.5s infinite' }} /></td>
                <td><div style={{ width: 30, height: 14, background: 'var(--rg-surface-hover)', borderRadius: 2, animation: 'rg-pulse 1.5s infinite' }} /></td>
                <td><div style={{ width: 80, height: 24, background: 'var(--rg-surface-hover)', borderRadius: 2, animation: 'rg-pulse 1.5s infinite' }} /></td>
                <td><div style={{ width: 80, height: 20, background: 'var(--rg-surface-hover)', borderRadius: 2, animation: 'rg-pulse 1.5s infinite' }} /></td>
                <td style={{ textAlign: 'right' }}><div style={{ width: 100, height: 28, background: 'var(--rg-surface-hover)', borderRadius: 4, display: 'inline-block', animation: 'rg-pulse 1.5s infinite' }} /></td>
              </tr>
            ))
          ) : cases.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <div style={{ padding: 48, textAlign: 'center', background: 'var(--rg-surface)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>No cases match these filters</p>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--rg-text-secondary)' }}>Try another risk level, search term, or clear the filters.</p>
                  {hasFilters && (
                    <button onClick={onClear} style={{ padding: '6px 12px', background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, cursor: 'pointer' }}>
                      Clear Filters
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            cases.map((row) => (
              <ExpandableRow key={row.customerId} row={row} navigate={navigate} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
