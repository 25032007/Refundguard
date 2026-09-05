import { buildGraphModel, buildTextSummary } from '../utils/ringGraphModel.js';

const SOURCE = {
  RISK: 'RISK ENGINE',
  NLP: 'COMPLAINT NLP',
  GRAPH: 'GRAPH ANALYSIS',
};

/**
 * Builds the KEY EVIDENCE list for an investigation from real API fields only.
 *
 * Prioritization (frontend presentation only — backend scoring is untouched):
 *   - risk signals are ranked by their actual `contribution`
 *   - refund-ring involvement is ranked by `graph.ringScore`
 *   - complaint-NLP evidence is ranked by actual counts (repeated templates,
 *     similar complaints)
 *
 * Returns [{ type, title, detail, score, source, cap }] sorted strongest first.
 */
export function buildKeyEvidence(investigation) {
  const items = [];
  const { risk, nlp, graph } = investigation;

  // Risk engine signals -> strongest contribution first.
  for (const signal of risk && risk.signals ? risk.signals : []) {
    items.push({
      type: signal.type,
      title: signal.type.replace(/_/g, ' ').toUpperCase(),
      detail: signal.description || '',
      score: signal.contribution,
      source: SOURCE.RISK,
      cap: (signal.severity || '').toUpperCase(),
    });
  }

  // Graph / refund ring -> single strong item using the ring score.
  if (graph && graph.inRing) {
    const model = buildGraphModel(investigation);
    const summary = buildTextSummary(model);
    items.push({
      type: 'refund_ring',
      title: 'REFUND RING',
      detail: summary,
      score: graph.ringScore,
      source: SOURCE.GRAPH,
      cap: 'RING DETECTED',
    });
  }

  // Complaint NLP -> counts as the available quantity.
  if (nlp) {
    const templateCount = (nlp.repeatedTemplates || []).length;
    const similarCount = (nlp.similarComplaints || []).length;
    if (templateCount > 0) {
      items.push({
        type: 'repeated_templates',
        title: 'REUSED WORDING TEMPLATES',
        detail: `${templateCount} template${templateCount === 1 ? '' : 's'} reused with identical wording across customers.`,
        score: templateCount,
        source: SOURCE.NLP,
        cap: 'REPEATED',
      });
    }
    if (similarCount > 0) {
      items.push({
        type: 'similar_complaints',
        title: 'SIMILAR COMPLAINTS',
        detail: `${similarCount} complaint${similarCount === 1 ? '' : 's'} nearly identical to other customers.`,
        score: similarCount,
        source: SOURCE.NLP,
        cap: 'SIMILAR',
      });
    }
  }

  return items
    .sort((a, b) => {
      const sa = typeof a.score === 'number' ? a.score : 0;
      const sb = typeof b.score === 'number' ? b.score : 0;
      return sb - sa;
    })
    .map((item) => ({ ...item, score: typeof item.score === 'number' ? item.score : null }));
}

/**
 * Presentational list of the prioritized key evidence items.
 */
export default function EvidenceList({ investigation }) {
  const items = buildKeyEvidence(investigation);

  if (!items.length) {
    return <div className="detail-muted">No evidence available for this investigation.</div>;
  }

  return (
    <ol className="evidence-list-sorted">
      {items.map((item, index) => (
        <li key={`${item.source}-${item.type}-${index}`} className="evidence-row">
          <span className="evidence-rank mono">{String(index + 1).padStart(2, '0')}</span>
          <div className="evidence-row-body">
            <div className="evidence-row-head">
              <span className="evidence-type">{item.title}</span>
              {item.score !== null && (
                <span className="evidence-score mono">{item.score}</span>
              )}
            </div>
            {item.cap && (
              <span className="evidence-cap">{item.cap}</span>
            )}
            <p className="evidence-detail">{item.detail}</p>
            <span className="evidence-source">{item.source}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
