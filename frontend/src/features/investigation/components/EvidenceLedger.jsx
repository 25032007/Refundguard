import React from 'react';
import Panel from '../../../ui/Panel.jsx';
import Table from '../../../ui/Table.jsx';
import EmptyState from '../../../ui/EmptyState.jsx';
import Badge from '../../../ui/Badge.jsx';

export default function EvidenceLedger({ signals = [] }) {
  if (!signals.length) {
    return <EmptyState title="No risk signals" description="The system did not flag any suspicious behavior for this entity." />;
  }

  const columns = [
    {
      key: 'type',
      label: 'Signal',
      render: (row) => <span className="rg-meta" style={{ color: 'var(--rg-brand)' }}>{row.type.replace(/_/g, ' ')}</span>
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row) => row.severity ? <Badge severity={row.severity.toLowerCase()}>{row.severity}</Badge> : null
    },
    {
      key: 'contribution',
      label: 'Contribution',
      render: (row) => <strong style={{ color: 'var(--rg-text-primary)' }}>{row.contribution}</strong>
    },
    {
      key: 'value',
      label: 'Evidence Details',
      render: (row) => {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-1)' }}>
            <span className="rg-body-compact">{row.description}</span>
            {row.evidence && (
              <pre className="rg-mono" style={{ margin: 0, maxHeight: '100px', overflow: 'auto', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(row.evidence, null, 2)}
              </pre>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <Panel title="Evidence Ledger" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <Table data={signals} columns={columns} data-density="compact" />
    </Panel>
  );
}
