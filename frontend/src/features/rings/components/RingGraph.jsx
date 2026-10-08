import React from 'react';
import ErrorBoundary from '../../../components/ErrorBoundary.jsx';
import RefundRingGraph from '../../../components/RefundRingGraph.jsx';

export default function RingGraph({ investigation }) {
  return (
    <div style={{ position: 'sticky', top: 76 }}>
      <div className="section-header">
        <span className="section-label-mark" />
        <span className="section-label">Network View</span>
      </div>
      <ErrorBoundary fallback={
        <div style={{
          padding: 16,
          background: 'var(--rg-severity-critical-bg)',
          border: '1px solid var(--rg-severity-critical-border)',
          borderRadius: 4,
          fontSize: 13,
          color: 'var(--rg-severity-critical)',
        }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>Graph Rendering Failed</h4>
          <p style={{ margin: 0, opacity: 0.9 }}>The network visualization could not be loaded. Please rely on the textual evidence.</p>
        </div>
      }>
        <RefundRingGraph investigation={investigation} />
      </ErrorBoundary>
    </div>
  );
}
