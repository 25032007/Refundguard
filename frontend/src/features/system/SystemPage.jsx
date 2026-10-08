import React, { useEffect, useState } from 'react';
import { getInvestigations, getTemporalData } from '../../services/api.js';
import Panel from '../../ui/Panel.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import ErrorState from '../../ui/ErrorState.jsx';
import Badge from '../../ui/Badge.jsx';

const INITIAL_RISK = { critical: 0, high: 0, medium: 0, low: 0 };
const INITIAL_DECISIONS = { unreviewed: 0, monitor: 0, escalated: 0, cleared: 0 };

export default function SystemPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [investigations, setInvestigations] = useState([]);
  const [temporalData, setTemporalData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getInvestigations(),
      getTemporalData()
    ])
    .then(([invData, tempData]) => {
      if (cancelled) return;
      setInvestigations(Array.isArray(invData) ? invData : []);
      setTemporalData(tempData);
    })
    .catch((err) => {
      if (!cancelled) {
        console.error(err);
        setError(true);
      }
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rg-app page">
        <Skeleton width="100%" height="150px" style={{ marginBottom: 'var(--rg-space-6)' }} />
        <Skeleton width="100%" height="300px" style={{ marginBottom: 'var(--rg-space-6)' }} />
        <Skeleton width="100%" height="300px" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rg-app page" style={{ paddingTop: 'var(--rg-space-10)' }}>
        <ErrorState title="System Data Unavailable" description="Could not load operational system metrics from the API." />
      </div>
    );
  }

  // Calculate stats
  const riskDist = { ...INITIAL_RISK };
  const decisionDist = { ...INITIAL_DECISIONS };
  let ringInvolvedCount = 0;

  investigations.forEach(inv => {
    const riskLevel = (inv.summary?.overallRisk || 'low').toLowerCase();
    if (riskDist[riskLevel] !== undefined) riskDist[riskLevel]++;

    const decision = (inv.decision || 'unreviewed').toLowerCase();
    if (decisionDist[decision] !== undefined) decisionDist[decision]++;

    if (inv.graph?.inRing) ringInvolvedCount++;
  });

  const totalInvestigations = investigations.length;

  // Ring intelligence stats
  const currentTrackedRings = temporalData?.lifecycle?.currentTrackedRings || [];
  const emergingCurrent = temporalData?.lifecycle?.emergingRingsBySnapshot?.[temporalData.lifecycle.emergingRingsBySnapshot.length - 1]?.rings || [];

  const ringStates = { active: 0, emerging: 0, dormant: 0, disbanded: 0 };
  currentTrackedRings.forEach(r => {
    const s = r.state.toLowerCase();
    if (ringStates[s] !== undefined) ringStates[s]++;
  });

  return (
    <div className="rg-app page">
      <header style={{ marginBottom: 'var(--rg-space-8)' }}>
        <h1 className="rg-display" style={{ marginBottom: 'var(--rg-space-2)' }}>System Metrics</h1>
        <p className="rg-body" style={{ color: 'var(--rg-text-secondary)', margin: 0 }}>
          Operational detector posture and global investigation state.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--rg-space-6)', marginBottom: 'var(--rg-space-8)' }}>
        <Panel title="System Status" style={{ padding: 'var(--rg-space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rg-space-3)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--rg-severity-low)' }}></div>
            <span className="rg-body-strong">All detectors operational</span>
          </div>
          <p className="rg-meta" style={{ marginTop: 'var(--rg-space-4)', color: 'var(--rg-text-tertiary)' }}>
            Connected to risk engine, NLP module, and graph processor.
          </p>
        </Panel>

        <Panel title="Global Investigations" style={{ padding: 'var(--rg-space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="rg-meta">Total Customers</span>
            <span className="rg-display" style={{ fontSize: '2rem' }}>{totalInvestigations}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--rg-space-3)' }}>
            <span className="rg-meta">Ring Involved</span>
            <span className="rg-display" style={{ fontSize: '1.5rem', color: 'var(--rg-severity-critical)' }}>{ringInvolvedCount}</span>
          </div>
        </Panel>

        <Panel title="Ring Intelligence" style={{ padding: 'var(--rg-space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="rg-meta">Tracked Rings</span>
            <span className="rg-display" style={{ fontSize: '2rem' }}>{currentTrackedRings.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--rg-space-3)' }}>
            <span className="rg-meta">Emerging Targets</span>
            <span className="rg-display" style={{ fontSize: '1.5rem', color: 'var(--rg-severity-high)' }}>{emergingCurrent.length}</span>
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--rg-space-6)' }}>
        <Panel title="Risk Distribution">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['critical', 'high', 'medium', 'low'].map(level => (
              <li key={level} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--rg-space-3) 0', borderBottom: '1px solid var(--rg-border-subtle)' }}>
                <Badge severity={level}>{level.toUpperCase()}</Badge>
                <span className="rg-mono">{riskDist[level]}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Analyst Decisions">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['unreviewed', 'escalated', 'monitor', 'cleared'].map(dec => (
              <li key={dec} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--rg-space-3) 0', borderBottom: '1px solid var(--rg-border-subtle)' }}>
                <Badge decision={dec}>{dec.toUpperCase()}</Badge>
                <span className="rg-mono">{decisionDist[dec]}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Ring Lifecycle States">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['emerging', 'active', 'dormant', 'disbanded'].map(state => (
              <li key={state} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--rg-space-3) 0', borderBottom: '1px solid var(--rg-border-subtle)' }}>
                <Badge lifecycle={state}>{state.toUpperCase()}</Badge>
                <span className="rg-mono">{ringStates[state]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
