import React from 'react';

export default function RingResources({ current }) {
  if (!current || !current.evidence) return null;

  const { sharedIps = [], sharedDevices = [] } = current.evidence;

  if (sharedIps.length === 0 && sharedDevices.length === 0) return null;

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Shared Resources
      </div>

      {sharedIps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)' }}>Shared IPs</h4>
          {sharedIps.map(ip => (
            <div key={ip.ip} style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', background: 'var(--rg-surface-hover)', borderRadius: 4, border: '1px solid var(--rg-border-subtle)', marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--rg-text-primary)' }}>{ip.ip}</span>
              <span style={{ fontSize: 12, color: 'var(--rg-text-secondary)' }}>Used by {ip.customers?.length} members</span>
            </div>
          ))}
        </div>
      )}

      {sharedDevices.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rg-text-tertiary)' }}>Shared Devices</h4>
          {sharedDevices.map(device => (
            <div key={device.deviceId} style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', background: 'var(--rg-surface-hover)', borderRadius: 4, border: '1px solid var(--rg-border-subtle)', marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--rg-text-primary)' }}>{device.deviceId}</span>
              <span style={{ fontSize: 12, color: 'var(--rg-text-secondary)' }}>Used by {device.customers?.length} members</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
