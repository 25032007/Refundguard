import React from 'react';

export default function TriageFilters({ decision, riskLevel, inRing, onFilterChange, facets, totalItems }) {
  const isFiltered = decision !== 'ALL' || riskLevel !== 'ALL' || inRing !== 'ALL';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--rg-surface)', borderBottom: '1px solid var(--rg-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)' }}>Filters</span>

        <select
          value={decision}
          onChange={(e) => onFilterChange('decision', e.target.value)}
          style={{ padding: '6px 12px', fontSize: 13, background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, color: 'var(--rg-text-primary)' }}
        >
          <option value="ALL">All Status</option>
          <option value="UNREVIEWED">Unreviewed ({facets.status?.UNREVIEWED || 0})</option>
          <option value="MONITOR">Monitor ({facets.status?.MONITOR || 0})</option>
          <option value="ESCALATED">Escalated ({facets.status?.ESCALATED || 0})</option>
          <option value="CLEARED">Cleared ({facets.status?.CLEARED || 0})</option>
        </select>

        <select
          value={riskLevel}
          onChange={(e) => onFilterChange('riskLevel', e.target.value)}
          style={{ padding: '6px 12px', fontSize: 13, background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, color: 'var(--rg-text-primary)' }}
        >
          <option value="ALL">All Risk Levels</option>
          <option value="CRITICAL">Critical ({facets.riskLevel?.CRITICAL || 0})</option>
          <option value="HIGH">High ({facets.riskLevel?.HIGH || 0})</option>
          <option value="MEDIUM">Medium ({facets.riskLevel?.MEDIUM || 0})</option>
          <option value="LOW">Low ({facets.riskLevel?.LOW || 0})</option>
        </select>

        <select
          value={inRing}
          onChange={(e) => onFilterChange('inRing', e.target.value)}
          style={{ padding: '6px 12px', fontSize: 13, background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, color: 'var(--rg-text-primary)' }}
        >
          <option value="ALL">All Cases</option>
          <option value="IN_RING">Ring Associated ({facets.inRing?.true || 0})</option>
          <option value="NO_RING">Independent ({facets.inRing?.false || 0})</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => {
              onFilterChange('decision', 'ALL');
              onFilterChange('riskLevel', 'ALL');
              onFilterChange('inRing', 'ALL');
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--rg-text-tertiary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 11, color: 'var(--rg-text-secondary)' }}>
        <span style={{ fontWeight: 600, color: 'var(--rg-text-primary)' }}>{totalItems.toLocaleString()} cases</span>
      </div>
    </div>
  );
}
