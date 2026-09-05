import RiskBadge from './RiskBadge.jsx';

/**
 * Investigation case header. Presents the customer ID, overall risk, behavior
 * risk score, and refund-ring status at a glance so an analyst can orient
 * before reviewing the detailed sections below.
 */
export default function CaseHeader({ investigation }) {
  const { customer, risk, graph, summary } = investigation;
  const inRing = !!graph && graph.inRing;

  return (
    <div className="case-header">
      <div className="case-header-identity">
        <div className="case-eyebrow">INVESTIGATION / CUSTOMER</div>
        <h1 className="case-id mono">{customer.customerId}</h1>
        <div className="case-risk">
          <RiskBadge level={summary.overallRisk} />
          <span className="case-risk-score">
            Risk Score <strong>{risk.score}</strong>
          </span>
        </div>
      </div>

      <div className="case-header-ring">
        {inRing ? (
          <>
            <span className="case-ring-flag case-ring-flag--detected" role="status">
              REFUND RING DETECTED
            </span>
            <div className="case-ring-meta">
              <span className="mono">{graph.ringId}</span>
              <span className="case-ring-score">Ring Score {graph.ringScore}</span>
            </div>
          </>
        ) : (
          <span className="case-ring-flag case-ring-flag--none" role="status">
            NO REFUND RING
          </span>
        )}
      </div>
    </div>
  );
}
