import React from 'react';
import Badge from '../../../ui/Badge.jsx';

export default function InvestigationHeader({ investigation, decision }) {
  const { customer, risk, graph, temporal } = investigation;
  const inRing = !!graph && graph.inRing;

  return (
    <header className="rg-investigation-header" style={{ paddingBottom: 'var(--rg-space-4)', borderBottom: 'var(--rg-border-width) solid var(--rg-border)', marginBottom: 'var(--rg-space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h1 className="rg-page-title" style={{ margin: '0 0 var(--rg-space-2) 0', display: 'flex', alignItems: 'center', gap: 'var(--rg-space-3)' }}>
          <span className="rg-mono">{customer?.id}</span>
          <Badge decision={decision}>{decision}</Badge>
          {inRing && <Badge className="rg-mono">RING: {graph.ringId}</Badge>}
        </h1>
        <div className="rg-meta" style={{ display: 'flex', gap: 'var(--rg-space-4)' }}>
          <span>Risk Score: {risk?.score}</span>
          <span>Level: {risk?.level}</span>
          {temporal?.asOf && <span>As of: {temporal.asOf}</span>}
        </div>
      </div>
    </header>
  );
}
