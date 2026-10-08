import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactQuery from '@tanstack/react-query';
import InvestigationPage from './InvestigationPage.jsx';

// Mock react-query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'C001' }),
  };
});

describe('InvestigationPage 409 Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows 409 conflict dialog when mutation errors with 409', () => {
    ReactQuery.useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'investigation') {
        return { data: { decision: { status: 'UNREVIEWED', version: 0 } }, isLoading: false, isError: false };
      }
      if (queryKey[0] === 'audit') {
        return { data: [], isLoading: false, isError: false };
      }
      return { data: null };
    });

    // Mock useMutation to simulate a 409 error having occurred
    ReactQuery.useMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: {
        response: { status: 409, data: { error: 'Version mismatch' } }
      }
    });

    // We need to render and then force the conflictError state, but conflictError is set in onError.
    // Let's just mock useState? No, we can trigger onError if we provide a mock mutate that calls onError.
    // Actually, a better way is to capture the mutation config and call onError directly.
    let mutationOptions;
    ReactQuery.useMutation.mockImplementation((options) => {
      mutationOptions = options;
      return { mutateAsync: vi.fn(), isPending: false };
    });

    render(
      <BrowserRouter>
        <InvestigationPage />
      </BrowserRouter>
    );

    // Now trigger the onError handler that would be called by react-query
    if (mutationOptions && mutationOptions.onError) {
      React.act(() => {
        mutationOptions.onError({ response: { status: 409 } });
      });
    }

    // Now the 409 dialog should be visible
    expect(screen.getByText('Case Changed')).toBeInTheDocument();
    expect(screen.getByText(/Another analyst has updated this case since you opened it/)).toBeInTheDocument();
  });
});
