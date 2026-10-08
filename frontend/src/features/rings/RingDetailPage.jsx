import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import RingOverview from './components/RingOverview.jsx';
import RingMembers from './components/RingMembers.jsx';
import RingResources from './components/RingResources.jsx';
import RingGraph from './components/RingGraph.jsx';
import { getRing, getInvestigation, getRingLifecycle } from '../../services/api.js';
import RingHeader from './components/RingHeader.jsx';
import LifecycleTimeline from './components/LifecycleTimeline.jsx';
import RingChangeReasons from './components/RingChangeReasons.jsx';

export default function RingDetailPage({ selectedRingId, onBack }) {
  const { data: ring, isLoading: isRingLoading, isError: isRingError } = useQuery({
    queryKey: ['ring', selectedRingId],
    queryFn: () => getRing(selectedRingId),
    enabled: !!selectedRingId,
  });

  const { data: investigation, isLoading: isGraphLoading, isError: isGraphError } = useQuery({
    queryKey: ['investigation', ring?.customerIds?.[0]],
    queryFn: () => getInvestigation(ring.customerIds[0]),
    enabled: !!ring?.customerIds?.length,
  });

  const { data: lifecycle, isLoading: isLifecycleLoading, isError: isLifecycleError } = useQuery({
    queryKey: ['ringLifecycle', selectedRingId],
    queryFn: () => getRingLifecycle(selectedRingId),
    enabled: !!selectedRingId,
  });

  if (isRingLoading) {
    return (
      <div style={{ height: 400, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
    );
  }

  if (isRingError || !ring) {
    return (
      <div className="rg-error-state" style={{ marginTop: 32 }}>
        <p className="rg-error-state-title">Ring not found</p>
        <p className="rg-error-state-description">
          Could not find data for {selectedRingId}.
        </p>
      </div>
    );
  }

  return (
    <div className="page-transition">
      <RingHeader selectedRingId={selectedRingId} ring={ring} onBack={onBack} />
      <div className="animate-fade-in-up stagger-1">
        <RingOverview current={ring} />
      </div>

      <div className="inv-layout" style={{ marginTop: 32 }}>
        <div className="inv-main">
          {isLifecycleLoading ? (
             <div style={{ height: 100, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite', marginBottom: 20 }} />
          ) : isLifecycleError || !lifecycle || !lifecycle.history || lifecycle.history.length === 0 ? (
             <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--rg-text-tertiary)' }}>No lifecycle history available for this ring.</div>
          ) : (
            <div className="animate-fade-in-up stagger-3">
              <LifecycleTimeline ringHist={lifecycle.history} />
              <RingChangeReasons latestSnapshot={lifecycle.history[lifecycle.history.length - 1]} />
            </div>
          )}
          <div className="animate-fade-in-up stagger-4"><RingResources current={ring} /></div>
          <div className="animate-fade-in-up stagger-5"><RingMembers current={ring} /></div>
        </div>

        <div className="inv-aside" style={{ flex: '1 1 400px', minWidth: 320 }}>
          {isGraphLoading ? (
            <div style={{
              height: 400,
              background: 'var(--rg-surface)',
              border: '1px solid var(--rg-border)',
              borderRadius: 4,
              animation: 'rg-pulse 2s infinite',
            }} />
          ) : isGraphError || !investigation ? (
            <div className="rg-error-state">
              <p className="rg-error-state-title">Graph unavailable</p>
              <p className="rg-error-state-description">
                Could not load underlying customer investigation to render the network graph.
              </p>
            </div>
          ) : (
            <div className="animate-fade-in"><RingGraph investigation={investigation} /></div>
          )}
        </div>
      </div>
    </div>
  );
}
