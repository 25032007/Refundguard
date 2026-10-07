import { useState, useEffect } from 'react';
import { getTemporalData } from '../services/api';

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

export default function RingList() {
  const [asOf, setAsOf] = useState('2011-12-09');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState(null);
  const [selectedRing, setSelectedRing] = useState(null);

  const fetchData = (date) => {
    setLoading(true);
    setError(false);
    getTemporalData(date ? new Date(date).toISOString() : '')
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(asOf);
  }, []);

  const handleApplyAsOf = () => {
    fetchData(asOf);
    setSelectedRing(null);
  };

  if (loading && !data) return <div className="temporal-view">Loading temporal data...</div>;
  if (error && !data) return <div className="temporal-view">Error loading temporal investigation data.</div>;
  if (!data) return null;

  const { lifecycle, activity } = data;
  const currentSnapshot = lifecycle.snapshots[lifecycle.snapshots.length - 1];
  const emergingCurrent = lifecycle.emergingRingsBySnapshot[lifecycle.emergingRingsBySnapshot.length - 1]?.rings || [];
  
  const activeCount = lifecycle.currentTrackedRings.filter(r => r.state === 'ACTIVE').length;
  const dormantCount = lifecycle.currentTrackedRings.filter(r => r.state === 'DORMANT').length;

  const renderTimeline = (ringId) => {
    return (
      <div className="temporal-timeline-container">
        <div className="temporal-timeline-line"></div>
        {lifecycle.snapshots.map((snap) => {
          const r = snap.rings.find(x => x.ringId === ringId);
          const state = r ? r.state : 'NONE';
          const cssClass = state === 'NONE' ? '' : state.toLowerCase();
          return (
            <div className="temporal-snapshot-node" key={snap.timestamp}>
              <span className="temporal-snapshot-date">{formatDate(snap.timestamp).substring(0, 6)}</span>
              <div className={`temporal-snapshot-marker ${cssClass}`}></div>
              <span className="temporal-snapshot-state">{state !== 'NONE' ? state : ''}</span>
              <span className="temporal-snapshot-meta">{r ? `${r.memberCount} members` : ''}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (selectedRing) {
    const ringHist = lifecycle.snapshots.map(s => s.rings.find(r => r.ringId === selectedRing.ringId)).filter(Boolean);
    const latest = ringHist[ringHist.length - 1];

    return (
      <div className="temporal-view">
        <div className="temporal-controls">
          <button className="temporal-button" onClick={() => setSelectedRing(null)}>← Back to Investigation</button>
        </div>

        <section className="temporal-section">
          <h2 className="temporal-section-header">RING DETAIL / INVESTIGATION</h2>
          <div className="temporal-ring-header">
            <span className="temporal-ring-id">{selectedRing.ringId}</span>
            <span className={`temporal-ring-state temporal-state-${latest.state.toLowerCase()}`}>{latest.state}</span>
          </div>

          <div style={{ margin: 'var(--space-6) 0' }}>
            {renderTimeline(selectedRing.ringId)}
          </div>

          <table className="temporal-table" style={{ marginTop: 'var(--space-6)' }}>
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Members</th>
                <th>Ring Score</th>
                <th>Evidence Changes</th>
              </tr>
            </thead>
            <tbody>
              {ringHist.map(h => (
                <tr key={h.firstSeenAt + h.memberCount + Math.random()}>
                  <td>{formatDate(h.firstSeenAt)}</td>
                  <td>{h.memberCount}</td>
                  <td>{h.score || 0}</td>
                  <td>
                    <div className="temporal-ring-changes">
                      {h.evidenceTriggers?.map(e => <span key={e}>{e}</span>)}
                      {h.evidenceTriggers?.length === 0 && <span className="muted">No new evidence</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  return (
    <div className="temporal-view">
      <div className="temporal-hero">
        <h1>Refund intelligence,<br/><span className="hero-accent">built for investigation.</span></h1>
        <p>Analyze emerging fraud networks, track their evolution across temporal snapshots, and act on concrete relationships before they scale.</p>
        
        <div className="hero-activity-chart">
          {activity.slice(-60).map((a, i) => (
            <div 
              key={a.date} 
              className="hero-activity-bar" 
              style={{ height: `${Math.max(4, (a.count / 20) * 80)}%` }}
              title={`${a.date}: ${a.count} refunds`}
            ></div>
          ))}
        </div>
      </div>

      <div className="temporal-controls">
        <label>AS OF</label>
        <input 
          type="date" 
          className="temporal-date-input" 
          value={asOf} 
          onChange={e => setAsOf(e.target.value)} 
          max="2011-12-09"
        />
        <button className="temporal-button" onClick={handleApplyAsOf}>Apply Snapshot</button>
        {loading && <span style={{fontSize: '0.875rem'}}>Updating...</span>}
      </div>

      <div className="temporal-stats-grid">
        <div className="temporal-stat-card">
          <div className="temporal-stat-value">{emergingCurrent.length}</div>
          <div className="temporal-stat-label">Emerging Rings</div>
        </div>
        <div className="temporal-stat-card">
          <div className="temporal-stat-value">{activeCount}</div>
          <div className="temporal-stat-label">Active Rings</div>
        </div>
        <div className="temporal-stat-card">
          <div className="temporal-stat-value">{dormantCount}</div>
          <div className="temporal-stat-label">Dormant Rings</div>
        </div>
      </div>

      <section className="temporal-section" style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="temporal-section-header">EMERGING RINGS</h2>
        {emergingCurrent.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No emerging rings in this snapshot.</p>
        ) : (
          <div className="temporal-rings-list">
            {emergingCurrent.map(ring => (
              <div className="temporal-ring-item" key={ring.ringId} onClick={() => setSelectedRing(ring)}>
                <div>
                  <div className="temporal-ring-header">
                    <span className="temporal-ring-id">{ring.ringId}</span>
                    <span className={`temporal-ring-state temporal-state-${ring.state.toLowerCase()}`}>{ring.state}</span>
                  </div>
                  <p className="temporal-ring-meta">First seen · {formatDate(ring.firstSeenAt)}</p>
                </div>
                <div className="temporal-ring-changes">
                  <span>{ring.previousMemberCount} → {ring.memberCount} members</span>
                  <span>Ring score: {ring.ringScore}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="temporal-section">
        <h2 className="temporal-section-header">ALL TRACKED RINGS</h2>
        <div className="temporal-rings-list">
          {lifecycle.currentTrackedRings.map(ring => (
            <div className="temporal-ring-item" key={ring.ringId} onClick={() => setSelectedRing(ring)}>
              <div>
                <div className="temporal-ring-header">
                  <span className="temporal-ring-id">{ring.ringId}</span>
                  <span className={`temporal-ring-state temporal-state-${ring.state.toLowerCase()}`}>{ring.state}</span>
                </div>
                <p className="temporal-ring-meta">{ring.memberCount} members · Score: {ring.score}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}