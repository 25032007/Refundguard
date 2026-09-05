import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInvestigation } from '../services/api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import CaseHeader from '../components/CaseHeader.jsx';
import InvestigationDecision from '../components/InvestigationDecision.jsx';
import { buildKeyEvidence } from '../components/EvidenceList.jsx';
import EvidenceList from '../components/EvidenceList.jsx';
import RefundRingGraph from '../components/RefundRingGraph.jsx';
import { buildGraphModel, buildTextSummary } from '../utils/ringGraphModel.js';

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
      {!loading && !error && investigation && (
        <InvestigationBody investigation={investigation} />
      )}

      {loading && <div className="state-message">Loading...</div>}

      {!loading && error && (
        <div className="state-message state-message--error">
          Unable to load investigation data.
        </div>
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
  const inRing = !!graph && graph.inRing;

  const [decision, setDecision] = useState('UNREVIEWED');

  const riskSignalCount = (risk && risk.signals ? risk.signals : []).length;
  const complaintCount = nlp && typeof nlp.complaintCount === 'number' ? nlp.complaintCount : 0;

  const ringSummary = inRing
    ? buildTextSummary(buildGraphModel(investigation))
    : '';

  const topEvidence = buildKeyEvidence(investigation);
  const strongest = topEvidence[0];
  const recommendation = summary ? summary.recommendation : '';
  const explanation = summary ? summary.explanation : '';

  return (
    <>
      {/* 1. Case Header */}
      <CaseHeader investigation={investigation} />

      {/* 2. Investigation Status / Analyst Decision */}
      <Section title="Investigation Status">
        <InvestigationDecision value={decision} onChange={setDecision} />
      </Section>

      {/* 3. Risk Overview */}
      <Section title="Risk Overview">
        <div className="overview-grid">
          <div className="detail-card overview-score">
            <span className="detail-label">Risk Score</span>
            <span className="overview-score-value">{risk.score}</span>
            <span className="overview-score-badge">
              <RiskBadge level={risk.level} />
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Risk Signals</span>
            <span className="detail-value mono">{riskSignalCount}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Ring Involvement</span>
            <span className="detail-value mono">{inRing ? graph.ringId : 'No ring'}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Complaints</span>
            <span className="detail-value mono">{complaintCount}</span>
          </div>
        </div>
      </Section>

      {/* 4. Risk Signals */}
      <Section title="Risk Signals">
        <div className="signal-grid">
          {(risk.signals || []).map((signal, index) => (
            <div key={`${signal.type}-${index}`} className="signal-card">
              <div className="signal-head">
                <span className="mono signal-type">{signal.type}</span>
                <span className="signal-contribution">{signal.contribution}</span>
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

      {/* 5. Key Evidence */}
      <Section title="Key Evidence">
        {strongest ? (
          <div className="detail-panel key-evidence-strongest">
            <div className="evidence-row-body">
              <div className="evidence-row-head">
                <span className="evidence-type">{strongest.title}</span>
                {strongest.score !== null && (
                  <span className="evidence-score mono">{strongest.score}</span>
                )}
              </div>
              {strongest.cap && <span className="evidence-cap">{strongest.cap}</span>}
              <p className="evidence-detail">{strongest.detail}</p>
              <span className="evidence-source">{strongest.source}</span>
            </div>
          </div>
        ) : (
          <div className="detail-muted">No evidence available for this investigation.</div>
        )}
        <EvidenceList investigation={investigation} />
      </Section>

      {/* 6. Complaint Evidence */}
      <Section title="Complaint Evidence">
        <div className="detail-grid">
          <div className="detail-card">
            <span className="detail-label">Complaint Count</span>
            <span className="detail-value mono">{complaintCount}</span>
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

        <div className="detail-grid">
          <div className="detail-panel">
            <span className="detail-label">Repeated Templates</span>
            {(nlp.repeatedTemplates || []).map((template) => (
              <div key={template.templateKey} className="list-item">
                <div className="mono">{template.representativeText}</div>
                <div className="list-meta">
                  count {template.count} · customers {template.customerIds.join(', ')}
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
                <div className="list-meta">similarity {similar.similarity}</div>
              </div>
            ))}
            {!(nlp.similarComplaints || []).length && (
              <div className="detail-muted">None detected.</div>
            )}
          </div>
        </div>
      </Section>

      {/* 7. Graph Analysis */}
      <Section title="Graph Analysis">
        <div className="detail-grid">
          <div className="detail-card">
            <span className="detail-label">Ring ID</span>
            <span className="detail-value mono">{inRing ? graph.ringId : '\u2014'}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Ring Score</span>
            <span className="detail-value mono">
              {inRing ? graph.ringScore : '\u2014'}
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Member Count</span>
            <span className="detail-value mono">
              {inRing ? (graph.members || []).length : '\u2014'}
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Ring Summary</span>
            <span className="detail-value">{inRing ? ringSummary : '\u2014'}</span>
          </div>
        </div>

        <div className="detail-panel">
          <span className="detail-label">Evidence</span>
          {inRing ? (
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

      {/* 8. Refund Ring Network */}
      <Section title="Refund Ring Network">
        <RefundRingGraph investigation={investigation} />
      </Section>

      {/* 9. Investigation Evidence Summary */}
      <Section title="Investigation Evidence Summary">
        <p className="summary-text">{explanation}</p>
      </Section>

      {/* 10. Recommended Action */}
      <Section title="Recommended Action">
        <p className="summary-text summary-text--recommendation">{recommendation}</p>
      </Section>

      {/* 11. Analyst Decision */}
      <Section title="Analyst Decision">
        <InvestigationDecision value={decision} onChange={setDecision} />
      </Section>
    </>
  );
}