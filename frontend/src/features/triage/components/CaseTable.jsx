import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../../ui/Badge';
import { formatSignalType } from '../../../utils/format';
import { usePii } from '../../../context/PiiContext';

function ExpandableRow({ row, navigate }) {
  const { maskPii } = usePii();
  const [expanded, setExpanded] = useState(false);
  const level = row.riskLevel || 'LOW';
  const topSignal = row.topSignal;
  const complaintCount = row.complaintCount || 0;
  const status = row.status || 'UNREVIEWED';

  // Generate dynamic explanation sentence
  const explanationParts = [];
  if (level === 'CRITICAL' || level === 'HIGH') {
    explanationParts.push(`Flagged as ${level} risk with a behavioral score of ${row.riskScore || 0}/100`);
  } else {
    explanationParts.push(`Observed with ${level} risk score (${row.riskScore || 0}/100)`);
  }

  if (topSignal) {
    explanationParts.push(`Primary signal: ${formatSignalType(topSignal.type)} (${topSignal.label})`);
  }

  if (row.ring) {
    explanationParts.push(`Associated with Fraud Ring ${row.ring.ringId} (Ring Score: ${row.ring.score || '—'})`);
  }

  if (complaintCount > 0) {
    explanationParts.push(`${complaintCount} customer complaint${complaintCount > 1 ? 's' : ''} logged`);
  }

  const executiveExplanation = explanationParts.join('; ') + '.';

  return (
    <React.Fragment>
      <tr
        className="case-row"
        onClick={() => setExpanded(!expanded)}
        style={{
          cursor: 'pointer',
          background: expanded ? 'var(--rg-surface-hover)' : 'inherit',
          transition: 'background var(--rg-transition-fast)',
        }}
      >
        <td style={{ width: 40, textAlign: 'center', color: 'var(--rg-text-tertiary)', transition: 'transform var(--rg-transition-fast)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </td>
        <td data-label="Customer">
          <span className="mono" style={{ fontWeight: 600 }}>{maskPii(row.customerId, 'name')}</span>
        </td>
        <td data-label="Risk">
          <Badge severity={level.toLowerCase()}>
            {level} {row.riskScore != null ? `(${row.riskScore})` : ''}
          </Badge>
        </td>
        <td data-label="Top Signal">
          {topSignal ? (
            <span style={{ fontSize: 12 }}>{formatSignalType(topSignal.type)}: {topSignal.label}</span>
          ) : <span style={{ color: 'var(--rg-text-tertiary)' }}>—</span>}
        </td>
        <td data-label="Complaints">
          <span className="mono tabular-nums">{complaintCount}</span>
        </td>
        <td data-label="Ring">
          {row.ring ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="mono">{row.ring.ringId}</span>
              <span style={{ fontSize: 10, color: 'var(--rg-text-secondary)' }}>Score: <span className="mono tabular-nums">{row.ring.score || '—'}</span></span>
            </div>
          ) : <span style={{ fontSize: 12, color: 'var(--rg-text-tertiary)' }}>—</span>}
        </td>
        <td data-label="Status">
          <Badge decision={status.toLowerCase()}>
            {status}
          </Badge>
        </td>
        <td data-label="Action" style={{ textAlign: 'right' }}>
          <button
            className="case-table-action"
            onClick={(e) => { e.stopPropagation(); navigate(`/investigations/${row.customerId}`); }}
            style={{ 
              background: 'var(--rg-brand)', color: 'white', border: 'none', 
              padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
              fontSize: 12, transition: 'all var(--rg-transition-fast)'
            }}
          >
            Investigate &rarr;
          </button>
        </td>
      </tr>

      {/* EXPANDED CUSTOMER QUICK SUMMARY CARD */}
      {expanded && (
        <tr style={{ background: 'var(--rg-surface-hover)' }}>
          <td colSpan={8} style={{ padding: 0 }}>
            <div
              className="animate-fade-in-up"
              style={{
                padding: '16px 24px',
                background: 'var(--rg-surface)',
                borderBottom: '2px solid var(--rg-border-brand)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Executive Summary Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rg-border)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-brand)' }}>
                    Customer Quick Risk Summary
                  </span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                    {maskPii(row.customerId, 'name')}
                  </span>
                  <Badge severity={level.toLowerCase()}>{level} ({row.riskScore || 0})</Badge>
                  <Badge decision={status.toLowerCase()}>{status}</Badge>
                </div>
                <span style={{ fontSize: 11, color: 'var(--rg-text-tertiary)' }}>Click row again to collapse</span>
              </div>

              {/* Behavioral Highlights Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ padding: '10px 12px', background: 'var(--rg-surface-hover)', borderRadius: 6, border: '1px solid var(--rg-border)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', display: 'block', marginBottom: 4 }}>
                    Behavioral Risk Score
                  </span>
                  <span className="mono tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: level === 'CRITICAL' ? 'var(--risk-critical)' : 'var(--rg-text-primary)' }}>
                    {row.riskScore || 0} / 100
                  </span>
                </div>

                <div style={{ padding: '10px 12px', background: 'var(--rg-surface-hover)', borderRadius: 6, border: '1px solid var(--rg-border)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', display: 'block', marginBottom: 4 }}>
                    Top Risk Driver
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {topSignal ? `${topSignal.label} (${topSignal.contribution} pts)` : 'None'}
                  </span>
                </div>

                <div style={{ padding: '10px 12px', background: 'var(--rg-surface-hover)', borderRadius: 6, border: '1px solid var(--rg-border)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', display: 'block', marginBottom: 4 }}>
                    Ring Association
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {row.ring ? `${row.ring.ringId} (Score: ${row.ring.score})` : 'Independent Account'}
                  </span>
                </div>

                <div style={{ padding: '10px 12px', background: 'var(--rg-surface-hover)', borderRadius: 6, border: '1px solid var(--rg-border)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', display: 'block', marginBottom: 4 }}>
                    Complaints Logged
                  </span>
                  <span className="mono tabular-nums" style={{ fontSize: 13, fontWeight: 700 }}>
                    {complaintCount} complaint{complaintCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Executive Explanation */}
              <div style={{ fontSize: 12.5, color: 'var(--rg-text-primary)', lineHeight: 1.5, background: 'var(--rg-surface-hover)', padding: '10px 14px', borderRadius: 6, borderLeft: '3px solid var(--rg-brand)' }}>
                <strong>Executive Assessment:</strong> {executiveExplanation}
              </div>

              {/* Call To Action Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'rgba(110, 28, 36, 0.06)',
                  border: '1px solid var(--rg-border-strong)',
                  borderRadius: 6,
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--rg-brand)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>For full deep-dive evidence, interactive graph visualizer & analyst decision submission:</span>
                </div>

                <button
                  onClick={() => navigate(`/investigations/${row.customerId}`)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor: 'var(--rg-brand)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: 'var(--rg-shadow-sm)',
                    flexShrink: 0,
                  }}
                >
                  Open Full Investigation &rarr;
                </button>
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
