import React from 'react';
import { Link } from 'react-router-dom';

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

export default function InvestigationHeader({ investigation, decision }) {
  const { customer, risk, graph, temporal } = investigation;
  const inRing = !!graph && graph.inRing;
  const level = risk?.level?.toUpperCase();
  const decisionStyle = DECISION_MAP[decision] || DECISION_MAP.UNREVIEWED;
  const severityColor = SEVERITY_COLORS[level] || 'var(--rg-text-primary)';
  const severityBg = SEVERITY_BG[level] || 'var(--rg-surface-hover)';
  const severityBorder = SEVERITY_BORDER[level] || 'var(--rg-border)';

  return (
    <div className="inv-header">
      <div className="inv-eyebrow">Customer Investigation</div>

      <div className="inv-identity">
        <div>
          <h1 className="inv-id">{customer?.id || customer?.customerId}</h1>
          <div className="inv-meta-row">
            {/* Decision status */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: decisionStyle.color,
              background: decisionStyle.bg,
              border: `1px solid ${decisionStyle.border}`,
              borderRadius: 2,
            }}>
              {decision}
            </span>

            {/* Ring association pill */}
            {inRing && (
              <Link
                to={`/rings/${graph.ringId}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--rg-severity-critical)',
                  background: 'var(--rg-severity-critical-bg)',
                  border: '1px solid var(--rg-severity-critical-border)',
                  borderRadius: 2,
                  textDecoration: 'none',
                }}
                title={`View ring ${graph.ringId}`}
              >
                ⬡ Ring: {graph.ringId} →
              </Link>
            )}

            {temporal?.asOf && (
              <span className="inv-meta-item" style={{ fontFamily: 'var(--rg-font-mono)', fontSize: 11 }}>
                as of {temporal.asOf}
              </span>
            )}
          </div>
        </div>

        {/* Risk posture */}
        <div className="risk-posture">
          <div className="risk-score-context" style={{ textAlign: 'right' }}>
            <span className="risk-score-label">Risk Score</span>
            <span className="risk-score-large" style={{ color: severityColor }}>
              {risk?.score ?? '—'}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: severityColor,
              background: severityBg,
              border: `1px solid ${severityBorder}`,
              borderRadius: 2,
              marginTop: 4,
              alignSelf: 'flex-end',
            }}>
              {level || '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
