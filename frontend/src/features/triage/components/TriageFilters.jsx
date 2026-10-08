import React from 'react';

export default function TriageFilters({ filter, setFilter }) {
  const handleChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--rg-space-4)', padding: 'var(--rg-space-4)', backgroundColor: 'var(--rg-surface)', borderBottom: 'var(--rg-border-width) solid var(--rg-border-subtle)', alignItems: 'center' }}>
      <span className="rg-meta">Filters:</span>

      <select
        name="decision"
        value={filter.decision}
        onChange={handleChange}
        aria-label="Filter by decision"
        style={{ padding: 'var(--rg-space-2)', borderRadius: 'var(--rg-radius-sm)', border: 'var(--rg-border-width) solid var(--rg-border-strong)', fontFamily: 'var(--rg-font-sans)', fontSize: 'var(--rg-text-body-compact)' }}
      >
        <option value="ALL">All Status</option>
        <option value="UNREVIEWED">Unreviewed</option>
        <option value="MONITOR">Monitor</option>
        <option value="ESCALATED">Escalated</option>
        <option value="CLEARED">Cleared</option>
      </select>

      <select
        name="level"
        value={filter.level}
        onChange={handleChange}
        aria-label="Filter by risk level"
        style={{ padding: 'var(--rg-space-2)', borderRadius: 'var(--rg-radius-sm)', border: 'var(--rg-border-width) solid var(--rg-border-strong)', fontFamily: 'var(--rg-font-sans)', fontSize: 'var(--rg-text-body-compact)' }}
      >
        <option value="ALL">All Risk Levels</option>
        <option value="CRITICAL">Critical</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>

      <select
        name="ring"
        value={filter.ring}
        onChange={handleChange}
        aria-label="Filter by ring association"
        style={{ padding: 'var(--rg-space-2)', borderRadius: 'var(--rg-radius-sm)', border: 'var(--rg-border-width) solid var(--rg-border-strong)', fontFamily: 'var(--rg-font-sans)', fontSize: 'var(--rg-text-body-compact)' }}
      >
        <option value="ALL">All Cases</option>
        <option value="IN_RING">Ring Associated</option>
        <option value="NO_RING">Independent</option>
      </select>
    </div>
  );
}
