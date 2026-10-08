import React from 'react';

export default function RingOverview({ previous, current }) {
  if (!current) return null;
  const prevMembers = previous?.memberCount || 0;
  const currMembers = current.memberCount || 0;
  const prevIps = previous?.ips?.length || 0;
  const currIps = current.ips?.length || 0;
  const prevDevices = previous?.devices?.length || 0;
  const currDevices = current.devices?.length || 0;

  return (
    <div style={{ display: 'flex', gap: 'var(--rg-space-4)', flexWrap: 'wrap', marginBottom: 'var(--rg-space-8)' }}>
      <div style={{ padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-surface)', border: 'var(--rg-border-width) solid var(--rg-border-subtle)', borderRadius: 'var(--rg-radius-md)', minWidth: '180px' }}>
        <span className="rg-meta" style={{ display: 'block', marginBottom: 'var(--rg-space-2)' }}>Members</span>
        <span className="rg-body-strong" style={{ fontSize: 'var(--rg-text-xl)' }}>
          {prevMembers !== currMembers ? `${prevMembers} → ${currMembers}` : currMembers}
        </span>
      </div>
      <div style={{ padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-surface)', border: 'var(--rg-border-width) solid var(--rg-border-subtle)', borderRadius: 'var(--rg-radius-md)', minWidth: '180px' }}>
        <span className="rg-meta" style={{ display: 'block', marginBottom: 'var(--rg-space-2)' }}>Shared IPs</span>
        <span className="rg-body-strong" style={{ fontSize: 'var(--rg-text-xl)' }}>
          {prevIps !== currIps ? `${prevIps} → ${currIps}` : currIps}
        </span>
      </div>
      <div style={{ padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-surface)', border: 'var(--rg-border-width) solid var(--rg-border-subtle)', borderRadius: 'var(--rg-radius-md)', minWidth: '180px' }}>
        <span className="rg-meta" style={{ display: 'block', marginBottom: 'var(--rg-space-2)' }}>Shared Devices</span>
        <span className="rg-body-strong" style={{ fontSize: 'var(--rg-text-xl)' }}>
          {prevDevices !== currDevices ? `${prevDevices} → ${currDevices}` : currDevices}
        </span>
      </div>
    </div>
  );
}
