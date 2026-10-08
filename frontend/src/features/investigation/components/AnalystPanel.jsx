import React from 'react';
import InvestigationDecision from '../../../components/InvestigationDecision.jsx';
import AuditHistory from '../../../components/AuditHistory.jsx';
import Panel from '../../../ui/Panel.jsx';

export default function AnalystPanel({ entityId, decision, onSaveDecision, auditTrigger }) {
  return (
    <div style={{ position: 'sticky', top: 'var(--rg-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-6)' }}>
      <Panel title="Analyst Decision" style={{ borderColor: 'var(--rg-border-brand)' }}>
        <div style={{ padding: 'var(--rg-space-4)' }}>
          <InvestigationDecision currentDecision={decision} onSave={onSaveDecision} />
        </div>
      </Panel>

      <Panel title="Audit History">
        <div style={{ padding: 'var(--rg-space-4)' }}>
          <AuditHistory entityId={entityId} refreshTrigger={auditTrigger} />
        </div>
      </Panel>
    </div>
  );
}
