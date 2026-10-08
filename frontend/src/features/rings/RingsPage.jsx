import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRings, getSummary } from '../../services/api.js';
import RingHeader from './components/RingHeader.jsx';
import RingDetailPage from './RingDetailPage.jsx';

function RingListTable({ rings, onSelect }) {
  if (!rings || rings.length === 0) {
    return (
      <div className="rg-empty-state">
        <p className="rg-empty-state-title">No rings found</p>
        <p className="rg-empty-state-description">There are no detected refund rings in the current dataset.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th data-label="Ring ID">Ring ID</th>
            <th data-label="Members">Members</th>
            <th data-label="Risk Score">Risk Score</th>
            <th data-label="Action" style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rings.map((row) => (
            <tr
              key={row.ringId}
              onClick={() => onSelect(row.ringId)}
              style={{ cursor: 'pointer' }}
            >
              <td data-label="Ring ID">
                <span className="mono">{row.ringId}</span>
              </td>
              <td data-label="Members">
                <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {row.memberCount}
                </span>
              </td>
              <td data-label="Risk Score">
                <span style={{ fontSize: 13, fontFamily: 'var(--rg-font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {row.score}
                </span>
              </td>
              <td data-label="Action" style={{ textAlign: 'right' }}>
                <a
                  className="case-table-action"
                  onClick={(e) => { e.stopPropagation(); onSelect(row.ringId); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(row.ringId)}
                >
                  View Detail →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RingsPage() {
  const { ringId: selectedRingId } = useParams();
  const navigate = useNavigate();

  const { data: ringsData, isLoading, isError } = useQuery({
    queryKey: ['rings', { page: 1, pageSize: 100 }],
    queryFn: () => getRings({ page: 1, pageSize: 100 }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['summary'],
    queryFn: () => getSummary(),
  });

  const setSelectedRing = (id) => {
    if (id) {
      navigate(`/rings/${id}`);
    } else {
      navigate(`/rings`);
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ height: 88, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, marginBottom: 20, animation: 'rg-pulse 2s infinite' }} />
        <div style={{ height: 400, background: 'var(--rg-surface)', border: '1px solid var(--rg-border)', borderRadius: 4, animation: 'rg-pulse 2s infinite' }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page">
        <div className="rg-error-state">
          <p className="rg-error-state-title">Failed to load ring intelligence</p>
          <p className="rg-error-state-description">Could not retrieve ring data from the backend.</p>
        </div>
      </div>
    );
  }

  const ringsList = ringsData?.items || [];
  const byLifecycle = summaryData?.rings?.byLifecycle || {};
  const activeRings = byLifecycle.ACTIVE || 0;
  const emergingRings = byLifecycle.EMERGING || 0;
  const dormantRings = byLifecycle.DORMANT || 0;
  const disbandedRings = byLifecycle.DISBANDED || 0;

  return (
    <div className="page page-transition">
      {selectedRingId ? (
        <RingDetailPage selectedRingId={selectedRingId} onBack={() => setSelectedRing(null)} />
      ) : (
        <div>
          <RingHeader />
          <div className="ring-metrics-row" style={{ marginBottom: 24 }}>
            <div className="ring-metric">
              <span className="ring-metric-label">Tracked Rings</span>
              <span className="ring-metric-value">{ringsData?.total || 0}</span>
            </div>
            <div className="ring-metric">
              <span className="ring-metric-label">Lifecycle Status</span>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <span style={{ fontSize: 13 }}><span style={{ color: 'var(--rg-severity-critical)', fontWeight: 600 }}>{activeRings}</span> Active</span>
                <span style={{ fontSize: 13 }}><span style={{ color: 'var(--rg-severity-medium)', fontWeight: 600 }}>{emergingRings}</span> Emerging</span>
                <span style={{ fontSize: 13 }}><span style={{ color: 'var(--rg-text-secondary)', fontWeight: 600 }}>{dormantRings}</span> Dormant</span>
                {disbandedRings > 0 && <span style={{ fontSize: 13 }}><span style={{ color: 'var(--rg-text-tertiary)', fontWeight: 600 }}>{disbandedRings}</span> Disbanded</span>}
              </div>
            </div>
          </div>

          <div>
            <div className="section-header">
              <span className="section-label-mark" />
              <span className="section-label">All Tracked Rings</span>
              <span className="section-count">{ringsData?.total || 0}</span>
            </div>
            <RingListTable rings={ringsList} onSelect={setSelectedRing} />
          </div>
        </div>
      )}
    </div>
  );
}
