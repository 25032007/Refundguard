import React from 'react';
import { Link } from 'react-router-dom';

export default function RingMembers({ current }) {
  if (!current || !current.customerIds) return null;

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Ring Members ({current.customerIds.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {current.customerIds.map(id => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--rg-surface-hover)', borderRadius: 4, border: '1px solid var(--rg-border-subtle)' }}>
            <span className="mono" style={{ fontSize: 13 }}>{id}</span>
            <Link to={`/investigations/${id}`} style={{ fontSize: 12, color: 'var(--rg-brand)', textDecoration: 'none', fontWeight: 600 }}>
              View Case →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
