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
          const next = new URLSearchParams(prev);
          if (searchInput) next.set('search', searchInput);
          else next.delete('search');
          next.set('page', '1');
          return next;
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, search, setSearchParams]);

  // Build API params
  const apiParams = {
    scope,
    pageSize: 50,
    page,
    sort: '-score'
  };
  if (decision !== 'ALL') apiParams.decision = decision;
  if (riskLevel !== 'ALL') apiParams.riskLevel = riskLevel;
  if (inRing !== 'ALL') apiParams.inRing = inRing;
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
      const next = new URLSearchParams(prev);
      if (value === 'ALL' || !value) next.delete(key);
      else next.set(key, value);
      next.set('page', '1');
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('decision');
      next.delete('riskLevel');
      next.delete('inRing');
      next.delete('search');
      next.set('page', '1');
      return next;
    });
    setSearchInput('');
  };

  const handleScopeToggle = (newScope) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('scope', newScope);
      next.set('page', '1');
      return next;
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
          onClearFilters={handleClearFilters}
          facets={facets}
          totalItems={totalItems}
        />
        <CaseTable
          cases={items}
          isLoading={isLoading}
          onClear={handleClearFilters}
          hasFilters={decision !== 'ALL' || riskLevel !== 'ALL' || inRing !== 'ALL' || search !== ''}
        />

        {/* PAGINATION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--rg-surface)', borderTop: '1px solid var(--rg-border)', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--rg-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            Showing page {page} of {totalPages} ({totalItems.toLocaleString()} cases)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={!hasPrev || isLoading}
              onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('page', String(page - 1)); return next; })}
              className="rg-button rg-button--secondary"
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              Previous
            </button>
            <button
              disabled={!hasNext || isLoading}
              onClick={() => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('page', String(page + 1)); return next; })}
              className="rg-button rg-button--secondary"
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
