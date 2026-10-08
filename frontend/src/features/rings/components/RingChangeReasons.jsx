import React from 'react';
import Panel from '../../../ui/Panel.jsx';
import Table from '../../../ui/Table.jsx';
import Badge from '../../../ui/Badge.jsx';

export default function RingChangeReasons({ latestSnapshot }) {
  if (!latestSnapshot) return null;
  const triggers = latestSnapshot.evidenceTriggers || [];
  
  if (triggers.length === 0) {
    return (
      <Panel title="Why This Ring Changed" style={{ marginBottom: 'var(--rg-space-6)' }}>
        <p className="rg-body-compact" style={{ color: 'var(--rg-text-tertiary)' }}>No new change evidence in this snapshot.</p>
      </Panel>
    );
  }

  const REASON_EXPLANATIONS = {
    'NEW_RING': 'Initial detection of coordinated activity',
    'MEMBER_COUNT_INCREASE': 'New members joined the ring',
    'NEW_SHARED_IP': 'New shared IP address identified',
    'NEW_SHARED_DEVICE': 'New shared device identified',
    'RISK_SCORE_INCREASE': 'Behavioral risk score escalated',
    'ACTIVITY_RESUMED': 'Dormant ring resumed activity',
    'NO_QUALIFYING_ACTIVITY': 'No suspicious activity detected in snapshot'
  };

  const columns = [
    { key: 'code', label: 'Reason Code', render: (row) => <span className="rg-mono">{row}</span> },
    { key: 'explanation', label: 'Explanation', render: (row) => <span>{REASON_EXPLANATIONS[row] || row}</span> }
  ];

  return (
    <Panel title="Why This Ring Changed" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <Table columns={columns} data={triggers} rowKey={(row) => row} />
    </Panel>
  );
}
