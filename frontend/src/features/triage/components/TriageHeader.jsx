import React from 'react';
import KpiRow from './KpiRow.jsx';

export default function TriageHeader({ cases }) {
  // KPI Derivation
  const unreviewedCount = cases.filter(c => c.decision === 'UNREVIEWED').length;
  const criticalCount = cases.filter(c => c.summary?.overallRisk === 'CRITICAL').length;
  const activeRingsCount = new Set(
    cases
      .filter(c => c.graph?.inRing && c.graph?.lifecycle !== 'disbanded' && c.graph?.lifecycle !== 'dormant')
      .map(c => c.graph?.ringId)
  ).size;

  return (
    <header style={{
      backgroundColor: 'var(--rg-brand)',
      color: 'var(--rg-brand-text)',
      padding: 'var(--rg-space-10) 32px var(--rg-space-8) 32px',
      margin: '-32px -32px var(--rg-space-8) -32px',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-6)' }}>
        <div>
          <h1 className="rg-display" style={{ color: 'var(--rg-brand-text)', margin: '0 0 var(--rg-space-2) 0' }}>RefundGuard</h1>
          <h2 className="rg-page-title" style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 var(--rg-space-4) 0' }}>TRIAGE CENTER</h2>
          <p className="rg-body" style={{ color: 'rgba(255, 255, 255, 0.8)', margin: 0, fontSize: 'var(--rg-text-lg)' }}>
            Prioritize the cases that need investigation.
          </p>
        </div>
        <KpiRow unreviewed={unreviewedCount} critical={criticalCount} activeRings={activeRingsCount} />
      </div>
    </header>
  );
}
