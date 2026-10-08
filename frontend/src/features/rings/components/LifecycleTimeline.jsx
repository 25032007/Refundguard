import React from 'react';
import Badge from '../../../ui/Badge.jsx';
import Panel from '../../../ui/Panel.jsx';

const REASON_EXPLANATIONS = {
  'NEW_RING': 'Initial detection of coordinated activity',
  'MEMBER_COUNT_INCREASE': 'New members joined the ring',
  'NEW_SHARED_IP': 'New shared IP address identified',
  'NEW_SHARED_DEVICE': 'New shared device identified',
  'RISK_SCORE_INCREASE': 'Behavioral risk score escalated',
  'ACTIVITY_RESUMED': 'Dormant ring resumed activity',
  'NO_QUALIFYING_ACTIVITY': 'No suspicious activity detected in snapshot'
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function LifecycleTimeline({ ringHist }) {
  if (!ringHist || ringHist.length === 0) return null;

  return (
    <Panel title="Lifecycle Timeline" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <div style={{ position: 'relative', paddingLeft: 'var(--rg-space-5)', margin: 'var(--rg-space-4) 0' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '7px', width: '2px', backgroundColor: 'var(--rg-border-strong)' }}></div>
        
        {ringHist.map((snap, i) => {
          const isLast = i === ringHist.length - 1;
          const isFirst = i === 0;
          return (
            <div key={`${snap.lastSeenAt}-${i}`} style={{ position: 'relative', marginBottom: isLast ? 0 : 'var(--rg-space-6)' }}>
              <div style={{ 
                position: 'absolute', left: 'calc(-1 * var(--rg-space-5) - 3px)', top: '6px', 
                width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--rg-brand-active)',
                border: '2px solid var(--rg-surface)', zIndex: 1
              }}></div>
              
              <div style={{ display: 'flex', gap: 'var(--rg-space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '100px' }}>
                  <span className="rg-meta">{formatDate(snap.lastSeenAt)}</span>
                </div>
                <div>
                  <Badge lifecycle={snap.state.toLowerCase()}>{snap.state}</Badge>
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  {(snap.evidenceTriggers || []).map((trigger, idx) => (
                    <div key={idx} style={{ marginBottom: 'var(--rg-space-2)' }}>
                      <span className="rg-mono" style={{ display: 'block', fontSize: 'var(--rg-text-meta)', color: 'var(--rg-text-secondary)' }}>{trigger}</span>
                      <span className="rg-body-compact">{REASON_EXPLANATIONS[trigger] || trigger}</span>
                    </div>
                  ))}
                  {(!snap.evidenceTriggers || snap.evidenceTriggers.length === 0) && (
                    <span className="rg-body-compact" style={{ color: 'var(--rg-text-tertiary)' }}>No lifecycle changes</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
