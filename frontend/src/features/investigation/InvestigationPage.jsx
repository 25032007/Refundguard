import React from 'react';
import { useParams } from 'react-router-dom';
import { useInvestigation } from './hooks/useInvestigation.js';

import InvestigationHeader from './components/InvestigationHeader.jsx';
import RiskSummary from './components/RiskSummary.jsx';
import EvidenceLedger from './components/EvidenceLedger.jsx';
import RingRelationship from './components/RingRelationship.jsx';
import TemporalContext from './components/TemporalContext.jsx';
import InvestigationGraph from './components/InvestigationGraph.jsx';
import AnalystPanel from './components/AnalystPanel.jsx';

import Skeleton from '../../ui/Skeleton.jsx';
import ErrorState from '../../ui/ErrorState.jsx';

export default function InvestigationPage() {
  const { id } = useParams();
  const { loading, error, investigation, decision, auditTrigger, saveDecision } = useInvestigation(id);

  if (loading) {
    return (
      <div className="rg-app page">
        <Skeleton width="300px" height="40px" style={{ marginBottom: 'var(--rg-space-6)' }} />
        <div style={{ display: 'flex', gap: 'var(--rg-space-6)', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 60%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-6)' }}>
            <Skeleton width="100%" height="200px" />
            <Skeleton width="100%" height="400px" />
          </div>
          <div style={{ flex: '1 1 35%', minWidth: '320px' }}>
            <Skeleton width="100%" height="600px" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !investigation) {
    return (
      <div className="rg-app page" style={{ paddingTop: 'var(--rg-space-10)' }}>
        <ErrorState title="Failed to load investigation" description={error?.message || 'Investigation data could not be retrieved.'} />
      </div>
    );
  }

  return (
    <div className="rg-app page">
      <InvestigationHeader investigation={investigation} decision={decision} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rg-space-6)', alignItems: 'flex-start' }}>
        {/* Left Column - System Evidence */}
        <div style={{ flex: '1 1 60%', minWidth: '320px', display: 'flex', flexDirection: 'column' }}>
          <TemporalContext investigation={investigation} />
          <RiskSummary investigation={investigation} />
          <EvidenceLedger signals={investigation.risk?.signals || []} />
          <RingRelationship investigation={investigation} />
          <InvestigationGraph investigation={investigation} />
        </div>

        {/* Right Column - Analyst Action */}
        <div style={{ flex: '1 1 35%', minWidth: '320px' }}>
          <AnalystPanel
            entityId={id}
            decision={decision}
            onSaveDecision={saveDecision}
            auditTrigger={auditTrigger}
          />
        </div>
      </div>
    </div>
  );
}
