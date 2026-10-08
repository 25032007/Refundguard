import React from 'react';
import Panel from '../../../ui/Panel.jsx';

export default function RingResources({ latestSnapshot }) {
  if (!latestSnapshot) return null;
  const { ips = [], devices = [] } = latestSnapshot;

  if (ips.length === 0 && devices.length === 0) {
    return (
      <Panel title="Shared Resources" style={{ marginBottom: 'var(--rg-space-6)' }}>
        <p className="rg-body-compact" style={{ color: 'var(--rg-text-tertiary)' }}>No shared IPs or devices identified.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Shared Resources" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--rg-space-4)' }}>
        <div>
          <h4 className="rg-meta" style={{ marginBottom: 'var(--rg-space-2)' }}>Shared IPs</h4>
          {ips.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ips.map(ip => <li key={ip} className="rg-mono" style={{ marginBottom: 'var(--rg-space-1)' }}>{ip}</li>)}
            </ul>
          ) : (
            <span className="rg-meta" style={{ color: 'var(--rg-text-tertiary)' }}>None</span>
          )}
        </div>
        <div>
          <h4 className="rg-meta" style={{ marginBottom: 'var(--rg-space-2)' }}>Shared Devices</h4>
          {devices.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {devices.map(dev => <li key={dev} className="rg-mono" style={{ marginBottom: 'var(--rg-space-1)' }}>{dev}</li>)}
            </ul>
          ) : (
            <span className="rg-meta" style={{ color: 'var(--rg-text-tertiary)' }}>None</span>
          )}
        </div>
      </div>
    </Panel>
  );
}
