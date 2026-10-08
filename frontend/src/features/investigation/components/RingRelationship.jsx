import React from 'react';
import { Link } from 'react-router-dom';
import { buildGraphModel, buildTextSummary } from '../../../utils/ringGraphModel.js';

const LIFECYCLE_COLORS = {
  active: 'var(--rg-severity-critical)',
  emerging: 'var(--rg-severity-medium)',
  dormant: 'var(--rg-text-secondary)',
  disbanded: 'var(--rg-text-tertiary)',
};

export default function RingRelationship({ investigation }) {
  const { graph } = investigation || {};
  const inRing = !!graph && graph.inRing;

  if (!inRing) {
    return (
      <div className="inv-section">
        <div className="inv-section-title">
          <span className="inv-section-title-bar" />
          Ring Association
        </div>
        <div style={{
          padding: '12px 14px',
          background: 'var(--rg-surface-hover)',
          border: '1px solid var(--rg-border)',
          borderRadius: 3,
          fontSize: 13,
          color: 'var(--rg-text-tertiary)',
        }}>
          No ring association detected — this entity is not linked to any known fraud ring.
        </div>
      </div>
    );
  }

  const model = buildGraphModel(investigation);
  const textSummary = buildTextSummary(model);
  const memberCount = (graph.members || []).length;
  const lifecycle = graph.lifecycle || 'active';
  const lifecycleColor = LIFECYCLE_COLORS[lifecycle] || 'var(--rg-text-secondary)';

  return (
    <div className="inv-section">
      <div className="inv-section-title">
        <span className="inv-section-title-bar" />
        Ring Association
        <span style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--rg-severity-critical)',
          background: 'var(--rg-severity-critical-bg)',
          border: '1px solid var(--rg-severity-critical-border)',
          borderRadius: 2,
          padding: '1px 6px',
        }}>DETECTED</span>
      </div>

      <div className="ring-assoc-block" style={{ marginBottom: 14 }}>
        <div className="ring-field">
          <span className="ring-field-label">Ring ID</span>
          <Link
            to={`/rings/${graph.ringId}`}
            style={{ fontFamily: 'var(--rg-font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--rg-brand)', textDecoration: 'none' }}
            title="View ring intelligence"
          >
            {graph.ringId} →
          </Link>
        </div>
        <div className="ring-field">
          <span className="ring-field-label">Ring Score</span>
          <span className="ring-field-value" style={{ fontFamily: 'var(--rg-font-mono)' }}>{graph.ringScore}</span>
        </div>
        <div className="ring-field">
          <span className="ring-field-label">Members</span>
          <span className="ring-field-value">{memberCount}</span>
        </div>
        <div className="ring-field">
          <span className="ring-field-label">Lifecycle</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: lifecycleColor,
            background: 'var(--rg-surface)',
            border: `1px solid ${lifecycleColor}`,
            borderRadius: 2,
          }}>
            {lifecycle}
          </span>
        </div>
      </div>

      {textSummary && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--rg-surface-hover)',
          borderRadius: 3,
          border: '1px solid var(--rg-border-subtle)',
          fontSize: 13,
          color: 'var(--rg-text-secondary)',
          lineHeight: 1.6,
          marginBottom: 10,
        }}>
          {textSummary}
        </div>
      )}

      {graph.evidence && graph.evidence.length > 0 && (
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rg-text-tertiary)', marginBottom: 6 }}>
            Ring Evidence
          </div>
          <ul className="ring-evidence-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {graph.evidence.map((item, idx) => {
              let content = item;
              if (typeof item === 'string') {
                const rateMatch = item.match(/(\d+(?:\.\d+)?)%/);
                if (rateMatch && parseFloat(rateMatch[1]) > 100) {
                  content = (
                    <>
                      {item}
                      <span
                        style={{ marginLeft: 6, fontSize: 10, cursor: 'help', color: 'var(--rg-text-tertiary)', borderBottom: '1px dotted var(--rg-text-tertiary)' }}
                        title="Data note: The refund rate exceeds 100% due to the detection engine's counting definitions. This is a known engine behavior."
                      >
                        (data note)
                      </span>
                    </>
                  );
                }
              }
              return (
                <li key={idx} style={{ background: 'var(--rg-surface-hover)', padding: '6px 10px', borderRadius: 4, fontSize: 12, border: '1px solid var(--rg-border-subtle)', fontFamily: 'var(--rg-font-mono)', color: 'var(--rg-text-secondary)' }}>
                  {content}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
