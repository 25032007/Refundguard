import React from 'react';
import { useNavigate } from 'react-router-dom';
import Table from '../../../ui/Table.jsx';
import Badge from '../../../ui/Badge.jsx';
import Button from '../../../ui/Button.jsx';
import EmptyState from '../../../ui/EmptyState.jsx';
import Panel from '../../../ui/Panel.jsx';

export default function CaseTable({ cases }) {
  const navigate = useNavigate();

  if (!cases || cases.length === 0) {
    return (
      <EmptyState 
        title="No cases match these filters." 
        description="Try adjusting your filter criteria to see more cases." 
        style={{ marginTop: 'var(--rg-space-6)' }}
      />
    );
  }

  const columns = [
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => <span className="rg-mono">{row.customer.customerId}</span>
    },
    {
      key: 'risk',
      label: 'Risk',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rg-space-2)' }}>
          <Badge severity={row.summary?.overallRisk?.toLowerCase()}>
            {row.summary?.overallRisk} {row.risk?.score}
          </Badge>
        </div>
      )
    },
    {
      key: 'ring',
      label: 'Ring',
      render: (row) => row.graph?.inRing ? <span className="rg-mono">{row.graph.ringId}</span> : <span className="rg-meta" style={{ color: 'var(--rg-text-tertiary)' }}>NONE</span>
    },
    {
      key: 'decision',
      label: 'Decision',
      render: (row) => {
        // UNREVIEWED visually requires analyst attention
        const isActionable = row.decision === 'UNREVIEWED';
        return (
          <Badge decision={row.decision} style={isActionable ? { border: '1px solid var(--rg-severity-critical)', fontWeight: 700 } : {}}>
            {row.decision}
          </Badge>
        );
      }
    },
    {
      key: 'signals',
      label: 'Key Signals',
      render: (row) => <span className="rg-body-compact" style={{ color: 'var(--rg-text-secondary)' }}>{(row.risk?.signals || []).map(s => s.type).slice(0, 2).join(', ')}{row.risk?.signals?.length > 2 ? '...' : ''}</span>
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <Button 
          variant="secondary" 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/investigations/${row.customer.customerId}`);
          }}
        >
          Investigate
        </Button>
      )
    }
  ];

  return (
    <Panel className="triage-case-table" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
      <div className="table-responsive-wrapper">
        <Table 
          columns={columns} 
          data={cases} 
          data-density="compact"
          onRowClick={(row) => navigate(`/investigations/${row.customer.customerId}`)} 
        />
      </div>
    </Panel>
  );
}
