import React from 'react';
import RefundRingGraph from '../../../components/RefundRingGraph.jsx';
import Panel from '../../../ui/Panel.jsx';
import EmptyState from '../../../ui/EmptyState.jsx';
import ErrorBoundary from '../../../components/ErrorBoundary.jsx';
import ErrorState from '../../../ui/ErrorState.jsx';

export default function InvestigationGraph({ investigation }) {
  const { graph } = investigation || {};
  const inRing = !!graph && graph.inRing;

  if (!inRing) {
    return null; // The RingRelationship handles empty state. Graph shouldn't show an empty container.
  }

  return (
    <Panel title="Refund Ring Network" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <ErrorBoundary fallback={<div style={{ padding: 'var(--rg-space-4)' }}><ErrorState title="Graph Rendering Failed" description="The graph visualization could not be loaded, but textual evidence remains available in the Ring Association section." /></div>}>
        <RefundRingGraph investigation={investigation} />
      </ErrorBoundary>
    </Panel>
  );
}
