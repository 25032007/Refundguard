import React from 'react';

export default function RingOverview({ current }) {
  if (!current) return null;

  const currMembers = current.memberCount || 0;
  const currIps = current.evidence?.sharedIps?.length || 0;
  const currDevices = current.evidence?.sharedDevices?.length || 0;
  const currScore = current.score;

  const metrics = [
    { label: 'Members', curr: currMembers },
    { label: 'Shared IPs', curr: currIps },
    { label: 'Shared Devices', curr: currDevices },
    ...(currScore != null ? [{ label: 'Risk Score', curr: currScore }] : []),
  ];

  return (
    <div className="ring-metrics-row" style={{ marginBottom: 24 }}>
      {metrics.map((m) => (
        <div key={m.label} className="ring-metric">
          <span className="ring-metric-label">{m.label}</span>
          <span className="ring-metric-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {m.curr ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
