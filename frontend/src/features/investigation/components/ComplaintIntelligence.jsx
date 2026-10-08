import React from 'react';

export default function ComplaintIntelligence({ nlp }) {
  if (!nlp || !nlp.complaints || nlp.complaints.length === 0) {
    return (
      <div className="inv-section">
        <div className="inv-section-title">
          <span className="inv-section-title-bar" />
          Complaint Intelligence
        </div>
        <div style={{ fontSize: 13, color: 'var(--rg-text-tertiary)' }}>No complaints found for this entity.</div>
      </div>
    );
  }

  const { complaints, similarCount, repeatedTemplatesCount, riskTopics } = nlp;

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Complaint Intelligence
        <span className="section-count">{complaints.length}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--rg-surface-hover)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--rg-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 4 }}>Similar Cases</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{similarCount || 0}</div>
        </div>
        <div style={{ background: 'var(--rg-surface-hover)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--rg-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 4 }}>Repeated Templates</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{repeatedTemplatesCount || 0}</div>
        </div>
        <div style={{ background: 'var(--rg-surface-hover)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--rg-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 4 }}>Risk Topics</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {riskTopics && riskTopics.length > 0 ? riskTopics.join(', ') : 'None'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rg-text-secondary)', borderBottom: '1px solid var(--rg-border)', paddingBottom: 6 }}>
          Recent Complaints
        </div>
        {complaints.slice(0, 3).map((comp, idx) => (
          <div key={idx} style={{ background: 'var(--rg-canvas)', padding: '12px 16px', borderRadius: 4, border: '1px solid var(--rg-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, color: 'var(--rg-text-secondary)' }}>
              <span className="mono">{comp.date}</span>
              <span style={{ fontWeight: 600, color: 'var(--rg-text-primary)' }}>{comp.category}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--rg-text-primary)' }}>
              "{comp.text}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
