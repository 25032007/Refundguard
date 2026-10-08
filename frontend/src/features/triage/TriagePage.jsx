import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getInvestigations, getSummary } from '../../services/api.js';
import TriageHeader from './components/TriageHeader.jsx';
import TriageFilters from './components/TriageFilters.jsx';
import CaseTable from './components/CaseTable.jsx';

export default function TriagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL state
  const scope = searchParams.get('scope') || 'flagged'; // all | flagged
  const page = parseInt(searchParams.get('page') || '1', 10);
  const decision = searchParams.get('decision') || 'ALL';
  const riskLevel = searchParams.get('riskLevel') || 'ALL';
  const inRing = searchParams.get('inRing') || 'ALL';
  const search = searchParams.get('search') || '';

  // Debounced search
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== searchInput) {
        setSearchParams(prev => {
          if (searchInput) prev.set('search', searchInput);
          else prev.delete('search');
          prev.set('page', '1');
          return prev;
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, search, setSearchParams]);

  // Build API params
  const apiParams = {
    scope,
    pageSize: 50,
    page,
    sort: '-score'
  };
  if (decision !== 'ALL') apiParams.status = decision;
  if (riskLevel !== 'ALL') apiParams.riskLevel = riskLevel;
  if (inRing === 'IN_RING') apiParams.inRing = true;
  if (inRing === 'NO_RING') apiParams.inRing = false;
  if (search) apiParams.search = search;

  const { data: listData, isLoading, isError, refetch } = useQuery({
    queryKey: ['investigations', apiParams],
    queryFn: () => getInvestigations(apiParams),
    keepPreviousData: true
  });

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: getSummary,
  });

  const handleFilterChange = (key, value) => {
    setSearchParams(prev => {
      if (value === 'ALL' || !value) prev.delete(key);
      else prev.set(key, value);
      prev.set('page', '1');
      return prev;
    });
  };

  const handleScopeToggle = (newScope) => {
    setSearchParams(prev => {
      prev.set('scope', newScope);
      prev.set('page', '1');
      return prev;
    });
  };

  if (isError) {
    return (
      <div className="page">
        <div className="rg-error-state">
          <p className="rg-error-state-title">Failed to load triage data</p>
          <p className="rg-error-state-description">Could not retrieve cases from the API.</p>
        </div>
        <button
          onClick={refetch}
          style={{ marginTop: 16, padding: '8px 16px', background: 'var(--rg-brand)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          Retry
        </button>
      </div>
    );
  }

  const items = listData?.items || [];
  const facets = listData?.facets || { status: {}, riskLevel: {}, inRing: { true: 0, false: 0 } };
  const totalItems = listData?.total || 0;
  const totalPages = listData?.pages || 1;
  const hasNext = listData?.hasNext;
  const hasPrev = listData?.hasPrev;

  return (
    <div className="page page-transition">
      <TriageHeader summary={summary} scope={scope} onScopeChange={handleScopeToggle} searchInput={searchInput} setSearchInput={setSearchInput} />

      <div className="case-queue">
        <TriageFilters
          decision={decision}
          riskLevel={riskLevel}
          inRing={inRing}
          onFilterChange={handleFilterChange}
          facets={facets}
          totalItems={totalItems}
        />
        <CaseTable
          cases={items}
          isLoading={isLoading}
          onClear={() => setSearchParams(prev => {
            prev.delete('decision');
            prev.delete('riskLevel');
            prev.delete('inRing');
            prev.delete('search');
            prev.set('page', '1');
            setSearchInput('');
            return prev;
          })}
          hasFilters={decision !== 'ALL' || riskLevel !== 'ALL' || inRing !== 'ALL' || search}
        />

        {/* PAGINATION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--rg-surface)', borderTop: '1px solid var(--rg-border)', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--rg-text-secondary)' }}>
            Showing page {page} of {totalPages} ({totalItems.toLocaleString()} cases)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={!hasPrev || isLoading}
              onClick={() => setSearchParams(prev => { prev.set('page', page - 1); return prev; })}
              style={{ padding: '6px 12px', background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, cursor: hasPrev ? 'pointer' : 'not-allowed', opacity: hasPrev ? 1 : 0.5 }}
            >
              Previous
            </button>
            <button
              disabled={!hasNext || isLoading}
              onClick={() => setSearchParams(prev => { prev.set('page', page + 1); return prev; })}
              style={{ padding: '6px 12px', background: 'var(--rg-canvas)', border: '1px solid var(--rg-border)', borderRadius: 4, cursor: hasNext ? 'pointer' : 'not-allowed', opacity: hasNext ? 1 : 0.5 }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
