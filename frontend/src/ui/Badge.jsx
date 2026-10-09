import React from 'react';

const LIFECYCLE_CONFIG = {
  emerging: { icon: '⦿', patternClass: 'rg-badge--pattern-dotted', label: 'Emerging', variant: 'medium' },
  active: { icon: '▲', patternClass: 'rg-badge--pattern-hatch', label: 'Active', variant: 'critical' },
  dormant: { icon: '◫', patternClass: 'rg-badge--pattern-crosshatch', label: 'Dormant', variant: 'dormant' },
  disbanded: { icon: '✖', patternClass: 'rg-badge--pattern-grid', label: 'Disbanded', variant: 'disbanded' },
};

const SEVERITY_CONFIG = {
  low: { icon: '✓', label: 'Low' },
  medium: { icon: '▲', label: 'Medium' },
  high: { icon: '⚡', label: 'High' },
  critical: { icon: '🚨', label: 'Critical' },
};

const DECISION_CONFIG = {
  cleared: { icon: '✓', label: 'Cleared' },
  monitor: { icon: '◫', label: 'Monitor' },
  escalated: { icon: '⚡', label: 'Escalated' },
  unreviewed: { icon: '○', label: 'Unreviewed' },
};

export default function Badge({ children, severity, lifecycle, decision, className = '', ...props }) {
  let variant = 'low';
  let icon = null;
  let patternClass = '';
  let defaultLabel = '';

  if (severity) {
    const key = String(severity).toLowerCase();
    variant = key;
    const cfg = SEVERITY_CONFIG[key];
    if (cfg) {
      icon = cfg.icon;
      defaultLabel = cfg.label;
    }
  } else if (lifecycle) {
    const key = String(lifecycle).toLowerCase();
    const cfg = LIFECYCLE_CONFIG[key];
    if (cfg) {
      variant = cfg.variant;
      icon = cfg.icon;
      patternClass = cfg.patternClass;
      defaultLabel = cfg.label;
    } else {
      variant = key;
    }
  } else if (decision) {
    const key = String(decision).toLowerCase();
    const cfg = DECISION_CONFIG[key];
    if (key === 'cleared') variant = 'low';
    else if (key === 'monitor') variant = 'medium';
    else if (key === 'escalated') variant = 'high';
    else variant = 'unreviewed';

    if (cfg) {
      icon = cfg.icon;
      defaultLabel = cfg.label;
    }
  }

  const labelText = children || defaultLabel || lifecycle || severity || decision;

  return (
    <span className={`rg-badge rg-badge--${variant} ${patternClass} ${className}`} {...props}>
      {icon && <span className="rg-badge-icon" aria-hidden="true">{icon}</span>}
      <span className="rg-badge-label">{labelText}</span>
    </span>
  );
}
