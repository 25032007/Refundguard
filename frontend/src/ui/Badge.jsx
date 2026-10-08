import React from 'react';

export default function Badge({ children, severity, lifecycle, decision, className = '', ...props }) {
  let variant = 'low';

  if (severity) {
    variant = severity; // low, medium, high, critical
  } else if (lifecycle) {
    // emerging, active, dormant, disbanded
    if (lifecycle === 'active') variant = 'critical';
    else if (lifecycle === 'emerging') variant = 'medium';
    else variant = lifecycle; // dormant, disbanded have explicit classes
  } else if (decision) {
    // unreviewed, monitor, escalated, cleared
    if (decision === 'cleared') variant = 'low';
    else if (decision === 'monitor') variant = 'medium';
    else if (decision === 'escalated') variant = 'high';
    else variant = 'unreviewed'; // will fall back to default styling if no class exists
  }

  return (
    <span className={`rg-badge rg-badge--${variant} ${className}`} {...props}>
      {children}
    </span>
  );
}
