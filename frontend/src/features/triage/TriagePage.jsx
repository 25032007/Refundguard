import React, { useState, useMemo } from 'react';
import { useTriageCases } from './hooks/useTriageCases.js';
import TriageHeader from './components/TriageHeader.jsx';
import TriageFilters from './components/TriageFilters.jsx';
import CaseTable from './components/CaseTable.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import ErrorState from '../../ui/ErrorState.jsx';
import Button from '../../ui/Button.jsx';

const SEVERITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const DECISION_RANK = { UNREVIEWED: 4, ESCALATED: 3, MONITOR: 2, CLEARED: 1 };

export default function TriagePage() {
  const { loading, error, cases, retry } = useTriageCases();
  const [filter, setFilter] = useState({ decision: 'ALL', level: 'ALL', ring: 'ALL' });

  const filteredAndSortedCases = useMemo(() => {
    let filtered = cases;

    // Filters
    if (filter.decision !== 'ALL') {
      filtered = filtered.filter(c => c.decision === filter.decision);
    }
    if (filter.level !== 'ALL') {
      filtered = filtered.filter(c => c.summary?.overallRisk === filter.level);
    }
    if (filter.ring !== 'ALL') {
      if (filter.ring === 'IN_RING') filtered = filtered.filter(c => !!c.graph?.inRing);
      if (filter.ring === 'NO_RING') filtered = filtered.filter(c => !c.graph?.inRing);
    }

    // Sorting
    return [...filtered].sort((a, b) => {
      // 1. Risk score descending
      const scoreA = a.risk?.score || 0;
      const scoreB = b.risk?.score || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      // 2. Severity
      const sevA = SEVERITY_RANK[a.summary?.overallRisk] || 0;
      const sevB = SEVERITY_RANK[b.summary?.overallRisk] || 0;
      if (sevA !== sevB) return sevB - sevA;

      // 3. Decision state
      const decA = DECISION_RANK[a.decision] || 0;
      const decB = DECISION_RANK[b.decision] || 0;
      if (decA !== decB) return decB - decA;

      // 4. Stable identifier tie-breaker
      const idA = String(a.customer?.customerId || '');
      const idB = String(b.customer?.customerId || '');
      return idA.localeCompare(idB);
    });
  }, [cases, filter]);

  if (loading) {
    return (
      <div className="rg-app page">
        <Skeleton width="100%" height="200px" style={{ margin: '-32px -32px var(--rg-space-8) -32px', borderRadius: '0 0 var(--rg-radius-md) var(--rg-radius-md)' }} />
        <Skeleton width="100%" height="40px" style={{ marginBottom: 'var(--rg-space-6)' }} />
        <Skeleton width="100%" height="400px" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rg-app page" style={{ paddingTop: 'var(--rg-space-10)' }}>
        <ErrorState
          title="Failed to load triage data"
          description="Could not retrieve cases from the risk engine."
        />
        <Button onClick={retry} style={{ marginTop: 'var(--rg-space-4)' }}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="rg-app page">
      <TriageHeader cases={cases} />
      <div style={{ backgroundColor: 'var(--rg-surface)', borderRadius: 'var(--rg-radius-md)', boxShadow: 'var(--rg-shadow-sm)' }}>
        <TriageFilters filter={filter} setFilter={setFilter} />
        <CaseTable cases={filteredAndSortedCases} />
      </div>
    </div>
  );
}
