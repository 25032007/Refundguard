import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import InvestigationDecision from './InvestigationDecision.jsx';

describe('InvestigationDecision Dialogs', () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires reason for ESCALATED decision', async () => {
    render(<InvestigationDecision currentDecision="UNREVIEWED" onSave={mockOnSave} />);

    // Select ESCALATED
    const escalateBtn = screen.getByText('Escalate Case');
    fireEvent.click(escalateBtn);

    // Click submit
    const submitBtn = screen.getByText('Save Decision');
    fireEvent.click(submitBtn);

    // Should show error and NOT call onSave
    expect(screen.getByText('Reason is required for Escalated or Cleared decisions.')).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();

    // Enter reason
    const reasonInput = screen.getByLabelText('Decision reason');
    fireEvent.change(reasonInput, { target: { value: 'Looks very suspicious' } });
    fireEvent.click(submitBtn);

    expect(screen.queryByText('Reason is required for Escalated or Cleared decisions.')).not.toBeInTheDocument();
    expect(mockOnSave).toHaveBeenCalledWith('ESCALATED', 'Looks very suspicious');
  });

  it('requires reason for CLEARED decision', async () => {
    render(<InvestigationDecision currentDecision="UNREVIEWED" onSave={mockOnSave} />);

    const clearBtn = screen.getByText('Clear Case');
    fireEvent.click(clearBtn);

    const submitBtn = screen.getByText('Save Decision');
    fireEvent.click(submitBtn);

    expect(screen.getByText('Reason is required for Escalated or Cleared decisions.')).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('does not require reason for MONITOR decision', async () => {
    render(<InvestigationDecision currentDecision="UNREVIEWED" onSave={mockOnSave} />);

    const monitorBtn = screen.getByText('Mark for Monitoring');
    fireEvent.click(monitorBtn);

    const submitBtn = screen.getByText('Save Decision');
    fireEvent.click(submitBtn);

    expect(screen.queryByText(/Reason is required/)).not.toBeInTheDocument();
    expect(mockOnSave).toHaveBeenCalledWith('MONITOR', '');
  });

  it('verifies 409 case changed dialog handling', async () => {
    // The component itself doesn't show the 409 dialog, it relies on externalError prop
    render(<InvestigationDecision currentDecision="UNREVIEWED" onSave={mockOnSave} externalError="Version mismatch. Case was updated by another analyst." />);

    expect(screen.getByText('Version mismatch. Case was updated by another analyst.')).toBeInTheDocument();
  });
});
