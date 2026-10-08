import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRingTimeline } from './hooks/useRingTimeline.js';
import RingHeader from './components/RingHeader.jsx';
import RingDetailPage from './RingDetailPage.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import ErrorState from '../../ui/ErrorState.jsx';
import Table from '../../ui/Table.jsx';
import Badge from '../../ui/Badge.jsx';
import Button from '../../ui/Button.jsx';
import EmptyState from '../../ui/EmptyState.jsx';

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function RingListTable({ rings, onSelect }) {
  if (!rings || rings.length === 0) {
    return <EmptyState title="No rings found" description="There are no tracked rings in this snapshot." style={{ margin: 'var(--rg-space-6) 0' }} />;
  }

  const columns = [
    { key: 'ringId', label: 'Ring', render: (row) => <span className="rg-mono" style={{ fontWeight: 600 }}>{row.ringId}</span> },
    { key: 'state', label: 'Lifecycle', render: (row) => <Badge lifecycle={row.state.toLowerCase()}>{row.state}</Badge> },
    { key: 'firstSeen', label: 'First Seen', render: (row) => <span className="rg-meta">{formatDate(row.firstSeenAt)}</span> },
    { key: 'memberCount', label: 'Members', render: (row) => <span className="rg-body-compact">{row.memberCount} members</span> },
    { key: 'score', label: 'Risk Score', render: (row) => <span className="rg-body-compact">{row.score}</span> },
    { key: 'action', label: 'Action', render: (row) => (
      <Button variant="secondary" onClick={() => onSelect(row.ringId)}>View Timeline</Button>
    )}
  ];

  return <Table columns={columns} data={rings} rowKey="ringId" data-density="comfortable" onRowClick={(row) => onSelect(row.ringId)} />;
}

export default function RingsPage() {
  const { ringId: selectedRingId } = useParams();
  const navigate = useNavigate();
  const { loading, error, data, asOf, setAsOf } = useRingTimeline();

  const handleAsOfChange = (e) => {
    setAsOf(e.target.value);
    if (selectedRingId) {
      navigate(`/rings?asOf=${e.target.value}`);
    }
  };

  const setSelectedRing = (id) => {
    if (id) {
      navigate(`/rings/${id}?asOf=${asOf}`);
    } else {
      navigate(`/rings?asOf=${asOf}`);
    }
  };

  const getSelectedRingState = () => {
    if (!selectedRingId || !data) return null;
    const snaps = data.lifecycle?.snapshots || [];
    if (snaps.length === 0) return null;
    const latestSnap = snaps[snaps.length - 1];
    const ring = latestSnap.rings.find(r => r.ringId === selectedRingId);
    return ring ? ring.state : null;
  };

  if (loading && !data) {
    return (
      <div className="rg-app page">
        <Skeleton width="100%" height="200px" style={{ margin: '-32px -32px var(--rg-space-8) -32px', borderRadius: '0 0 var(--rg-radius-md) var(--rg-radius-md)' }} />
        <Skeleton width="100%" height="400px" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rg-app page" style={{ paddingTop: 'var(--rg-space-10)' }}>
        <ErrorState title="Failed to load temporal data" description="Could not retrieve ring intelligence from the backend." />
      </div>
    );
  }

  const { lifecycle } = data;
  const currentTrackedRings = lifecycle?.currentTrackedRings || [];
  const emergingCurrent = lifecycle?.emergingRingsBySnapshot?.[lifecycle.emergingRingsBySnapshot.length - 1]?.rings || [];

  return (
    <div className="rg-app page">
      <RingHeader 
        selectedRingId={selectedRingId} 
        ringState={getSelectedRingState()} 
        onBack={() => setSelectedRing(null)} 
      />

      {/* Snapshot Control (Always visible to maintain context) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rg-space-4)', padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-surface)', borderRadius: 'var(--rg-radius-md)', marginBottom: 'var(--rg-space-6)', border: 'var(--rg-border-width) solid var(--rg-border-subtle)' }}>
        <label htmlFor="asOfInput" className="rg-meta">Temporal Snapshot:</label>
        <input 
          id="asOfInput"
          type="date" 
          value={asOf} 
          onChange={handleAsOfChange}
          max="2011-12-09"
          style={{ padding: 'var(--rg-space-2)', borderRadius: 'var(--rg-radius-sm)', border: 'var(--rg-border-width) solid var(--rg-border-strong)', fontFamily: 'var(--rg-font-sans)', fontSize: 'var(--rg-text-body-compact)' }}
        />
        {loading && <span className="rg-meta" style={{ color: 'var(--rg-text-tertiary)' }}>Updating...</span>}
      </div>

      {selectedRingId ? (
        <RingDetailPage data={data} selectedRingId={selectedRingId} />
      ) : (
        <div>
          {emergingCurrent.length > 0 && (
            <div style={{ marginBottom: 'var(--rg-space-8)' }}>
              <h3 className="rg-meta" style={{ marginBottom: 'var(--rg-space-4)', color: 'var(--rg-severity-critical)', borderBottom: '1px solid var(--rg-border-subtle)', paddingBottom: 'var(--rg-space-2)' }}>
                EMERGING RINGS ({emergingCurrent.length})
              </h3>
              <RingListTable rings={emergingCurrent} onSelect={setSelectedRing} />
            </div>
          )}

          <div>
            <h3 className="rg-meta" style={{ marginBottom: 'var(--rg-space-4)', borderBottom: '1px solid var(--rg-border-subtle)', paddingBottom: 'var(--rg-space-2)' }}>
              ALL TRACKED RINGS ({currentTrackedRings.length})
            </h3>
            <RingListTable rings={currentTrackedRings} onSelect={setSelectedRing} />
          </div>
        </div>
      )}
    </div>
  );
}
