import React from 'react';
import RefundRingGraph from '../../../components/RefundRingGraph.jsx';
import ErrorBoundary from '../../../components/ErrorBoundary.jsx';

export default function InvestigationGraph({ investigation }) {
  const { graph } = investigation || {};
  const inRing = !!graph && graph.inRing;

  if (!inRing) {
    // RingRelationship already handles the no-ring empty state
    return null;
  }

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Refund Ring Network Graph
      </div>
      <ErrorBoundary
        fallback={
          <div style={{
            padding: '16px',
            background: 'var(--rg-severity-critical-bg)',
            border: '1px solid var(--rg-severity-critical-border)',
            borderRadius: 3,
            fontSize: 13,
            color: 'var(--rg-severity-critical)',
          }}>
            Graph rendering failed — ring textual evidence remains available in the section above.
          </div>
        }
      >
        <RefundRingGraph investigation={investigation} />
      </ErrorBoundary>
    </div>
  );
}
