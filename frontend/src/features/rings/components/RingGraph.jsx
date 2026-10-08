import React from 'react';
import Panel from '../../../ui/Panel.jsx';
import ErrorBoundary from '../../../components/ErrorBoundary.jsx';
import ErrorState from '../../../ui/ErrorState.jsx';
import RefundRingGraph from '../../../components/RefundRingGraph.jsx';

export default function RingGraph({ investigation }) {
  return (
    <Panel title="Network View" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <ErrorBoundary fallback={
        <div style={{ padding: 'var(--rg-space-4)' }}>
          <ErrorState title="Graph Rendering Failed" description="The network visualization could not be loaded. Please rely on the textual evidence above." />
        </div>
      }>
        <RefundRingGraph investigation={investigation} />
      </ErrorBoundary>
    </Panel>
  );
}
