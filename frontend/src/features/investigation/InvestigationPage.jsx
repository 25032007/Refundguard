import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvestigation, getAuditHistory, updateDecision } from '../../services/api.js';

import InvestigationHeader from './components/InvestigationHeader.jsx';
import RiskSummary from './components/RiskSummary.jsx';
import EvidenceLedger from './components/EvidenceLedger.jsx';
import RingRelationship from './components/RingRelationship.jsx';
import TemporalContext from './components/TemporalContext.jsx';
import InvestigationGraph from './components/InvestigationGraph.jsx';
import AnalystPanel from './components/AnalystPanel.jsx';
import ComplaintIntelligence from './components/ComplaintIntelligence.jsx';

export default function InvestigationPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [conflictError, setConflictError] = useState(false);

  const { data: investigation, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['investigation', id],
    queryFn: () => getInvestigation(id),
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit', id],
    queryFn: () => getAuditHistory(id),
  });

  const mutation = useMutation({
    mutationFn: (args) => updateDecision(args),
    onSuccess: (data) => {
      // Invalidate queries to refetch investigation and audit history
      queryClient.invalidateQueries({ queryKey: ['investigation', id] });
      queryClient.invalidateQueries({ queryKey: ['audit', id] });
      setConflictError(false);
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        setConflictError(true);
      }
    }
  });

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ height: 100, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, marginBottom: 24, animation: 'rg-pulse 2s infinite' }} />
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 180, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
            <div style={{ height: 300, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
          </div>
          <div style={{ flex: '0 0 340px' }}>
            <div style={{ height: 400, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !investigation) {
    return (
      <div className="page">
        <Link to="/triage" className="back-link" style={{ marginBottom: 16, display: 'inline-flex' }}>← Back to Triage</Link>
        <div className="rg-error-state">
          <p className="rg-error-state-title">Investigation not found</p>
          <p className="rg-error-state-description">
            {fetchError?.message || 'Investigation data could not be retrieved.'}
          </p>
        </div>
      </div>
    );
  }

  const decision = investigation.decision?.status || 'UNREVIEWED';
  const expectedVersion = investigation.decision?.version || 0;

  const handleSaveDecision = (newDecision, reason) => {
    return mutation.mutateAsync({ customerId: id, decision: newDecision, reason, expectedVersion });
  };

  const handleReload = () => {
    setConflictError(false);
    queryClient.invalidateQueries({ queryKey: ['investigation', id] });
    queryClient.invalidateQueries({ queryKey: ['audit', id] });
  };

  return (
    <div className="page page-transition">
      <Link to="/triage" className="back-link">← Triage Center</Link>

      <InvestigationHeader investigation={investigation} decision={decision} />

      <div className="inv-layout">
        <div className="inv-main">
          <div className="animate-fade-in-up stagger-1"><RiskSummary investigation={investigation} /></div>
          <div className="animate-fade-in-up stagger-2"><EvidenceLedger signals={investigation.evidence || []} customerId={id} /></div>
          <div className="animate-fade-in-up stagger-3"><ComplaintIntelligence nlp={investigation.nlp} /></div>
          <div className="animate-fade-in-up stagger-4"><RingRelationship investigation={investigation} /></div>
          <div className="animate-fade-in-up stagger-5"><TemporalContext investigation={investigation} /></div>
          <div className="animate-fade-in-up stagger-5"><InvestigationGraph investigation={investigation} /></div>
        </div>

        <div className="inv-aside">
          <AnalystPanel
            entityId={id}
            decision={decision}
            onSaveDecision={handleSaveDecision}
            isSaving={mutation.isPending}
            error={conflictError ? null : (mutation.error?.response?.data?.error || mutation.error?.message)}
            auditData={auditData}
          />
        </div>
      </div>

      {conflictError && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--rg-surface)', padding: 32, borderRadius: 8, maxWidth: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--rg-severity-high)' }}>Case Changed</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--rg-text-secondary)', lineHeight: 1.5 }}>
              Another analyst has updated this case since you opened it. Please reload to see the latest decision.
            </p>
            <button onClick={handleReload} style={{ background: 'var(--rg-brand)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', width: '100%' }}>
              Reload Case
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
