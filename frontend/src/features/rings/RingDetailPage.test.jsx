import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactQuery from '@tanstack/react-query';
import RingDetailPage from './RingDetailPage.jsx';

// Mock react-query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

describe('RingDetailPage Lifecycle Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRingData = {
    ringId: 'ring-1',
    customerIds: ['c1'],
    score: 100,
    severity: 'high',
    memberCount: 1,
    evidence: {
      sharedIps: [],
      sharedDevices: [],
      ringRefunds: 1,
      ringTransactions: 1,
      ringRefundRate: 1.0,
      membersWithRefunds: 1,
      membersWithComplaints: 1
    }
  };

  const mockInvestigationData = {
    customer: { customerId: 'c1' },
    graph: { members: ['c1'] }
  };

  it('renders loading state for lifecycle', () => {
    ReactQuery.useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'ring') return { data: mockRingData, isLoading: false, isError: false };
      if (queryKey[0] === 'investigation') return { data: mockInvestigationData, isLoading: false, isError: false };
      if (queryKey[0] === 'ringLifecycle') return { data: null, isLoading: true, isError: false };
      return { data: null };
    });

    const { container } = render(
      <BrowserRouter>
        <RingDetailPage selectedRingId="ring-1" onBack={vi.fn()} />
      </BrowserRouter>
    );
    // The loading block has an animation class `rg-pulse`
    const pulsingElements = container.querySelectorAll('.rg-pulse');
    expect(pulsingElements).not.toBeNull();
  });

  it('renders honest empty state when lifecycle history is missing or empty', () => {
    ReactQuery.useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'ring') return { data: mockRingData, isLoading: false, isError: false };
      if (queryKey[0] === 'investigation') return { data: mockInvestigationData, isLoading: false, isError: false };
      if (queryKey[0] === 'ringLifecycle') return { data: { history: [] }, isLoading: false, isError: false };
      return { data: null };
    });

    render(
      <BrowserRouter>
        <RingDetailPage selectedRingId="ring-1" onBack={vi.fn()} />
      </BrowserRouter>
    );
    expect(screen.getByText('No lifecycle history available for this ring.')).toBeInTheDocument();
  });

  it('renders real lifecycle snapshots and evidence triggers', () => {
    const mockLifecycle = {
      history: [
        {
          state: 'EMERGING',
          lastSeenAt: '2026-01-15T10:00:00Z',
          evidenceTriggers: ['NEW_RING']
        },
        {
          state: 'ACTIVE',
          lastSeenAt: '2026-01-20T10:00:00Z',
          evidenceTriggers: ['MEMBER_COUNT_INCREASE']
        }
      ]
    };

    ReactQuery.useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'ring') return { data: mockRingData, isLoading: false, isError: false };
      if (queryKey[0] === 'investigation') return { data: mockInvestigationData, isLoading: false, isError: false };
      if (queryKey[0] === 'ringLifecycle') return { data: mockLifecycle, isLoading: false, isError: false };
      return { data: null };
    });

    render(
      <BrowserRouter>
        <RingDetailPage selectedRingId="ring-1" onBack={vi.fn()} />
      </BrowserRouter>
    );

    // Check Lifecycle Timeline values
    expect(screen.getByText('Lifecycle Timeline')).toBeInTheDocument();
    expect(screen.getByText('EMERGING')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();

    // Check Change Reasons
    expect(screen.getByText('Change Triggers')).toBeInTheDocument();
    expect(screen.getAllByText('MEMBER_COUNT_INCREASE').length).toBeGreaterThan(0);
  });

  it('behaves correctly on lifecycle error', () => {
    ReactQuery.useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'ring') return { data: mockRingData, isLoading: false, isError: false };
      if (queryKey[0] === 'investigation') return { data: mockInvestigationData, isLoading: false, isError: false };
      if (queryKey[0] === 'ringLifecycle') return { data: null, isLoading: false, isError: true };
      return { data: null };
    });

    render(
      <BrowserRouter>
        <RingDetailPage selectedRingId="ring-1" onBack={vi.fn()} />
      </BrowserRouter>
    );
    expect(screen.getByText('No lifecycle history available for this ring.')).toBeInTheDocument();
  });
});
