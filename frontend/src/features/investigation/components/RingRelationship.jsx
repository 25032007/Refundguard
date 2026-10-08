import React from 'react';
import Panel from '../../../ui/Panel.jsx';
import EmptyState from '../../../ui/EmptyState.jsx';
import Field from '../../../ui/Field.jsx';
import Badge from '../../../ui/Badge.jsx';
import { buildGraphModel, buildTextSummary } from '../../../utils/ringGraphModel.js';

export default function RingRelationship({ investigation }) {
  const { graph } = investigation || {};
  const inRing = !!graph && graph.inRing;

  if (!inRing) {
    return (
      <Panel title="Ring Association" style={{ marginBottom: 'var(--rg-space-6)' }}>
        <EmptyState title="No ring detected" description="The entity is not associated with any known fraud ring." />
      </Panel>
    );
  }

  const model = buildGraphModel(investigation);
  const textSummary = buildTextSummary(model);
  const memberCount = (graph.members || []).length;

  // Extract lifecycle if available or use a default string. The backend may or may not provide lifecycle here.
  const lifecycle = graph.lifecycle || 'active';

  return (
    <Panel title="Ring Association" style={{ marginBottom: 'var(--rg-space-6)' }}>
      <div style={{ padding: 'var(--rg-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rg-space-6)' }}>
          <Field label="Ring ID" value={<span className="rg-mono">{graph.ringId}</span>} />
          <Field label="Ring Score" value={<span className="rg-mono">{graph.ringScore}</span>} />
          <Field label="Members" value={<span className="rg-mono">{memberCount}</span>} />
          <Field label="Lifecycle" value={<Badge lifecycle={lifecycle}>{lifecycle}</Badge>} />
        </div>

        {textSummary && (
          <div className="rg-body-compact" style={{ padding: 'var(--rg-space-3)', backgroundColor: 'var(--rg-surface-hover)', borderRadius: 'var(--rg-radius-sm)', border: 'var(--rg-border-width) solid var(--rg-border-subtle)' }}>
            {textSummary}
          </div>
        )}

        {graph.evidence && graph.evidence.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rg-space-2)' }}>
            <span className="rg-meta">Ring Evidence</span>
            <ul style={{ margin: 0, paddingLeft: 'var(--rg-space-4)', fontSize: 'var(--rg-text-body-compact)', color: 'var(--rg-text-secondary)' }}>
              {graph.evidence.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
