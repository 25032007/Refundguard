import React from 'react';
import Panel from '../../../ui/Panel.jsx';
import Field from '../../../ui/Field.jsx';
import Badge from '../../../ui/Badge.jsx';

export default function RiskSummary({ investigation }) {
  const { risk, nlp, graph, summary } = investigation || {};
  const riskSignalCount = (risk?.signals || []).length;
  const complaintCount = nlp?.complaintCount || 0;
  const inRing = !!graph?.inRing;

  return (
    <Panel title="Risk Overview" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--rg-space-4)', padding: 'var(--rg-space-4)' }}>
        <Field
          label="Risk Score"
          value={<span className="rg-display" style={{ color: 'var(--rg-text-primary)' }}>{risk?.score}</span>}
        />
        <Field
          label="Risk Level"
          value={<Badge severity={risk?.level?.toLowerCase()}>{risk?.level}</Badge>}
        />
        <Field
          label="Risk Signals"
          value={<span className="rg-mono" style={{ fontSize: '1.25rem' }}>{riskSignalCount}</span>}
        />
        <Field
          label="Complaints"
          value={<span className="rg-mono" style={{ fontSize: '1.25rem' }}>{complaintCount}</span>}
        />
      </div>

      {summary?.recommendation && (
        <div style={{ padding: 'var(--rg-space-4)', borderTop: 'var(--rg-border-width) solid var(--rg-border-subtle)', backgroundColor: 'var(--rg-surface-hover)' }}>
          <span className="rg-meta" style={{ display: 'block', marginBottom: 'var(--rg-space-2)' }}>Recommendation</span>
          <p className="rg-body-compact" style={{ margin: 0, fontWeight: 500 }}>{summary.recommendation}</p>
        </div>
      )}
    </Panel>
  );
}
