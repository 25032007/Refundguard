import React from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../../../ui/Panel.jsx';
import Table from '../../../ui/Table.jsx';
import Button from '../../../ui/Button.jsx';
import Badge from '../../../ui/Badge.jsx';

export default function RingMembers({ latestSnapshot }) {
  const navigate = useNavigate();
  if (!latestSnapshot) return null;

  const newMembers = new Set(latestSnapshot.newMembers || []);
  const data = (latestSnapshot.customerIds || []).map(id => ({
    customerId: id,
    isNew: newMembers.has(id)
  }));

  const columns = [
    { key: 'customerId', label: 'Customer ID', render: (row) => <span className="rg-mono">{row.customerId}</span> },
    { key: 'status', label: 'Status', render: (row) => row.isNew ? <Badge severity="warning">NEWLY ADDED</Badge> : <span className="rg-meta">EXISTING</span> },
    { key: 'action', label: 'Action', render: (row) => (
        <Button variant="secondary" onClick={() => navigate(`/investigations/${row.customerId}`)}>
          Investigate Customer
        </Button>
      )
    }
  ];

  return (
    <Panel title="Current Members" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <Table columns={columns} data={data} rowKey="customerId" data-density="compact" />
    </Panel>
  );
}
