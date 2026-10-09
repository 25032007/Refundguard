import React from 'react';

export default function TriageFilters({ decision, riskLevel, inRing, onFilterChange, onClearFilters, facets, totalItems }) {
  const isFiltered = decision !== 'ALL' || riskLevel !== 'ALL' || inRing !== 'ALL';

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '12px 16px', 
      background: 'var(--rg-surface)', 
      borderBottom: '1px solid var(--rg-border)',
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      flexWrap: 'wrap',
      gap: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)' }}>Filter Cases:</span>

        {/* Decision Status Dropdown */}
        <select
          value={decision}
          onChange={(e) => onFilterChange('decision', e.target.value)}
          className="rg-filter-select"
        >
          <option value="ALL">All Statuses ({totalItems.toLocaleString()})</option>
          <option value="UNREVIEWED">Unreviewed ({facets.status?.UNREVIEWED || 0})</option>
          <option value="MONITOR">Monitor ({facets.status?.MONITOR || 0})</option>
          <option value="ESCALATED">Escalated ({facets.status?.ESCALATED || 0})</option>
          <option value="CLEARED">Cleared ({facets.status?.CLEARED || 0})</option>
        </select>

        {/* Risk Level Dropdown */}
        <select
          value={riskLevel}
          onChange={(e) => onFilterChange('riskLevel', e.target.value)}
          className="rg-filter-select"
        >
          <option value="ALL">All Risk Levels</option>
          <option value="CRITICAL">Critical ({facets.riskLevel?.CRITICAL || 0})</option>
          <option value="HIGH">High ({facets.riskLevel?.HIGH || 0})</option>
          <option value="MEDIUM">Medium ({facets.riskLevel?.MEDIUM || 0})</option>
          <option value="LOW">Low ({facets.riskLevel?.LOW || 0})</option>
        </select>

        {/* Association Dropdown */}
        <select
          value={inRing}
          onChange={(e) => onFilterChange('inRing', e.target.value)}
          className="rg-filter-select"
        >
          <option value="ALL">All Networks</option>
          <option value="IN_RING">Ring Associated ({facets.inRing?.true || 0})</option>
          <option value="NO_RING">Independent ({facets.inRing?.false || 0})</option>
        </select>

        {isFiltered && (
          <button
            onClick={onClearFilters}
            className="rg-button rg-button--secondary"
            style={{ fontSize: 11, padding: '4px 10px', height: 32 }}
          >
            Clear Filters ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--rg-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontWeight: 700, color: 'var(--rg-text-primary)' }}>{totalItems.toLocaleString()} cases found</span>
      </div>
    </div>
  );
}
