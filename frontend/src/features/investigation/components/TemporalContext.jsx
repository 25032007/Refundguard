import React from 'react';
import Panel from '../../../ui/Panel.jsx';
import Field from '../../../ui/Field.jsx';

export default function TemporalContext({ investigation }) {
  const { temporal } = investigation || {};

  if (!temporal || Object.keys(temporal).length === 0) {
    return null;
  }

  return (
    <Panel title="Temporal Context" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <div style={{ padding: 'var(--rg-space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--rg-space-6)' }}>
        {temporal.asOf && <Field label="As Of" value={<span className="rg-mono">{temporal.asOf}</span>} />}
        {temporal.firstSeen && <Field label="First Seen" value={<span className="rg-mono">{temporal.firstSeen}</span>} />}
        {temporal.lastSeen && <Field label="Last Seen" value={<span className="rg-mono">{temporal.lastSeen}</span>} />}
      </div>
    </Panel>
  );
}
