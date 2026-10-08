import React from 'react';
import Badge from '../../../ui/Badge.jsx';

export default function RingHeader({ selectedRingId, ringState, onBack }) {
  return (
    <header style={{ 
      backgroundColor: 'var(--rg-brand)', 
      color: 'var(--rg-brand-text)', 
      padding: 'var(--rg-space-10) 32px var(--rg-space-8) 32px',
      margin: '-32px -32px var(--rg-space-8) -32px',
      borderRadius: '0 0 var(--rg-radius-md) var(--rg-radius-md)'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-4)' }}>
        {selectedRingId && (
          <button 
            onClick={onBack} 
            style={{ 
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', 
              cursor: 'pointer', padding: 0, fontSize: 'var(--rg-text-meta)',
              textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, textAlign: 'left'
            }}
          >
            ← Back to Ring Intelligence
          </button>
        )}
        
        {!selectedRingId ? (
          <div>
            <h1 className="rg-display" style={{ color: 'var(--rg-brand-text)', margin: '0 0 var(--rg-space-2) 0' }}>RING INTELLIGENCE</h1>
            <p className="rg-body" style={{ color: 'rgba(255, 255, 255, 0.8)', margin: 0, fontSize: 'var(--rg-text-lg)' }}>
              Track how coordinated refund behavior emerges over time.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rg-space-3)', marginBottom: 'var(--rg-space-2)' }}>
              <h1 className="rg-display" style={{ color: 'var(--rg-brand-text)', margin: 0 }}>{selectedRingId}</h1>
              {ringState && <Badge lifecycle={ringState.toLowerCase()}>{ringState}</Badge>}
            </div>
            <p className="rg-body" style={{ color: 'rgba(255, 255, 255, 0.8)', margin: 0, fontSize: 'var(--rg-text-lg)' }}>
              Temporal investigation of ring evolution.
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
