import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInvestigation } from '../services/api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import RefundRingGraph from '../components/RefundRingGraph.jsx';

export default function RingDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [investigation, setInvestigation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getInvestigation(id)
      .then((data) => {
        if (!cancelled) setInvestigation(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">Investigation</h1>
        <p className="page-subtitle mono">
          {investigation ? investigation.customer.customerId : 'Detailed investigation workspace'}
        </p>
      </div>

      {loading && <div className="state-message">Loading...</div>}

      {!loading && error && (
        <div className="state-message state-message--error">
          Unable to load investigation data.
        </div>
      )}

      {!loading && !error && investigation && (
        <InvestigationBody investigation={investigation} />
      )}
    </div>
  );
}

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

function InvestigationBody({ investigation }) {
  const { customer, risk, nlp, graph, summary } = investigation;

  return (
    <>
      <Section title="Customer">
        <div className="detail-grid">
          <div className="detail-card">
            <span className="detail-label">Customer ID</span>
            <span className="detail-value mono">{customer.customerId}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Overall Risk</span>
            <span className="detail-value">
              <RiskBadge level={summary.overallRisk} />
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Recommendation</span>
            <span className="detail-value">{summary.recommendation}</span>
          </div>
        </div>
      </Section>

      <Section title="Risk Engine">
        <div className="detail-grid">
          <div className="detail-card">
            <span className="detail-label">Score</span>
            <span className="detail-value">{risk.score}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Level</span>
            <span className="detail-value">
              <RiskBadge level={risk.level} />
            </span>
          </div>
        </div>
        <div className="signal-grid">
          {(risk.signals || []).map((signal, index) => (
            <div key={`${signal.type}-${index}`} className="signal-card">
              <div className="signal-head">
                <span className="mono signal-type">{signal.type}</span>
                <span className="signal-contribution">
                  {signal.contribution}
                </span>
              </div>
              <div className="signal-desc">{signal.description || ''}</div>
              {signal.evidence && (
                <div className="signal-evidence">
                  <span className="signal-evidence-label">Evidence</span>
                  <pre className="signal-evidence-json mono">
                    {JSON.stringify(signal.evidence, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Complaint NLP">
        <div className="detail-grid">
          <div className="detail-card">
            <span className="detail-label">Complaint Count</span>
            <span className="detail-value mono">{nlp.complaintCount}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Repeated Templates</span>
            <span className="detail-value mono">
              {(nlp.repeatedTemplates || []).length}
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Similar Complaints</span>
            <span className="detail-value mono">
              {(nlp.similarComplaints || []).length}
            </span>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-panel">
            <span className="detail-label">Repeated Templates</span>
            {(nlp.repeatedTemplates || []).map((template) => (
              <div key={template.templateKey} className="list-item">
                <div className="mono">{template.representativeText}</div>
                <div className="list-meta">
                  count {template.count} · customers{' '}
                  {template.customerIds.join(', ')}
                </div>
              </div>
            ))}
            {!(nlp.repeatedTemplates || []).length && (
              <div className="detail-muted">None detected.</div>
            )}
          </div>

          <div className="detail-panel">
            <span className="detail-label">Similar Complaints</span>
            {(nlp.similarComplaints || []).map((similar, index) => (
              <div key={`${similar.complaintId}-${index}`} className="list-item">
                <div className="mono">
                  {similar.complaintId} ↔ {similar.similarComplaintId}
                  <span className="list-meta"> (customer {similar.similarCustomerId})</span>
                </div>
                <div className="list-meta">
                  similarity {similar.similarity}
                </div>
              </div>
            ))}
            {!(nlp.similarComplaints || []).length && (
              <div className="detail-muted">None detected.</div>
            )}
          </div>
        </div>

        <div className="detail-panel">
          <span className="detail-label">Evidence</span>
          {(nlp.evidence || []).map((evidenceItem) => (
            <div key={`${evidenceItem.type}-${evidenceItem.value}`} className="list-item">
              <div className="mono">
                [{evidenceItem.type}] {evidenceItem.value}
              </div>
            </div>
          ))}
          {!(nlp.evidence || []).length && (
            <div className="detail-muted">None detected.</div>
          )}
        </div>
      </Section>

      <Section title="Graph Analysis">
        <div className="detail-grid">
          <div className="detail-card">
            <span className="detail-label">Ring ID</span>
            <span className="detail-value mono">
              {graph.inRing ? graph.ringId : '\u2014'}
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Ring Score</span>
            <span className="detail-value mono">
              {graph.inRing ? graph.ringScore : '\u2014'}
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Member Count</span>
            <span className="detail-value mono">
              {graph.inRing ? (graph.members || []).length : '\u2014'}
            </span>
          </div>
        </div>

        <div className="detail-panel">
          <span className="detail-label">Evidence</span>
          {graph.inRing ? (
            <ul className="evidence-list">
              {(graph.evidence || []).map((evidenceItem, index) => (
                <li key={index} className="evidence-item">
                  {evidenceItem}
                </li>
              ))}
            </ul>
          ) : (
            <div className="detail-muted">
              Customer is not part of a detected refund ring.
            </div>
          )}
        </div>
      </Section>

      <Section title="Refund Ring Network">
        <RefundRingGraph investigation={investigation} />
      </Section>

      <Section title="Summary">
        <p className="summary-text">{summary.explanation}</p>
      </Section>
    </>
  );
}
