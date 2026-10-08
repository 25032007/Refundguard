import React from 'react';
import InvestigationDecision from '../../../components/InvestigationDecision.jsx';
import AuditHistory from '../../../components/AuditHistory.jsx';

export default function AnalystPanel({ entityId, decision, onSaveDecision, isSaving, error, auditData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="analyst-panel">
        <div className="analyst-panel-header">
          <h3 className="analyst-panel-title">Analyst Decision</h3>
        </div>
        <div className="analyst-panel-body">
          <InvestigationDecision
            currentDecision={decision}
            onSave={onSaveDecision}
            isSaving={isSaving}
            externalError={error}
          />
        </div>
      </div>

      <div className="analyst-panel">
        <div className="analyst-panel-header">
          <h3 className="analyst-panel-title">Audit History</h3>
        </div>
        <div className="analyst-panel-body">
          <AuditHistory history={auditData || []} />
        </div>
      </div>
    </div>
  );
}
