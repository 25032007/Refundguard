import React, { useState, useEffect } from 'react';
import RingOverview from './components/RingOverview.jsx';
import LifecycleTimeline from './components/LifecycleTimeline.jsx';
import RingChangeReasons from './components/RingChangeReasons.jsx';
import RingMembers from './components/RingMembers.jsx';
import RingResources from './components/RingResources.jsx';
import RingGraph from './components/RingGraph.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import ErrorState from '../../ui/ErrorState.jsx';
import { getInvestigation } from '../../services/api.js';

export default function RingDetailPage({ data, selectedRingId }) {
  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const snapshots = data?.lifecycle?.snapshots || [];
  
  const ringHist = snapshots
    .map(s => s.rings.find(r => r.ringId === selectedRingId))
    .filter(Boolean);

  const latestSnapshot = ringHist[ringHist.length - 1];
  const previousSnapshot = ringHist.length > 1 ? ringHist[ringHist.length - 2] : null;

  useEffect(() => {
    let cancelled = false;
    if (!latestSnapshot || !latestSnapshot.customerIds || latestSnapshot.customerIds.length === 0) {
      setLoading(false);
      return;
    }
    
    // Fetch investigation for the first member to power the graph
    getInvestigation(latestSnapshot.customerIds[0])
      .then(res => {
        if (!cancelled) {
          setInvestigation(res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
      
    return () => { cancelled = true; };
  }, [latestSnapshot]);

  if (!latestSnapshot) {
    return (
      <div style={{ paddingTop: 'var(--rg-space-8)' }}>
        <ErrorState title="Ring not found" description={`Could not find data for ${selectedRingId} in this snapshot.`} />
      </div>
    );
  }

  return (
    <div className="ring-detail-page">
      <RingOverview previous={previousSnapshot} current={latestSnapshot} />
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rg-space-6)', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 60%', minWidth: '320px', display: 'flex', flexDirection: 'column' }}>
          <LifecycleTimeline ringHist={ringHist} />
          <RingChangeReasons latestSnapshot={latestSnapshot} />
          <RingResources latestSnapshot={latestSnapshot} />
          <RingMembers latestSnapshot={latestSnapshot} />
        </div>
        
        <div style={{ flex: '1 1 35%', minWidth: '320px' }}>
          {loading ? (
            <Skeleton width="100%" height="400px" />
          ) : error || !investigation ? (
            <ErrorState title="Graph unavailable" description="Could not load underlying customer investigation to render graph." />
          ) : (
            <RingGraph investigation={investigation} />
          )}
        </div>
      </div>
    </div>
  );
}
