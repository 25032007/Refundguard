export default function Metrics() {
  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">Risk Metrics</h1>
        <p className="page-subtitle">
          Monitor investigation and risk-engine performance.
        </p>
      </div>

      <section className="section">
        <h2 className="section-title">Risk Analysis</h2>
        <div className="empty-state empty-state-large">
          <span className="empty-state-mark" aria-hidden="true" />
          <p className="empty-state-title">Risk intelligence unavailable</p>
          <p className="empty-state-text">
            Metrics will appear once RefundGuard begins processing refund
            behavior and investigation signals.
          </p>
        </div>
      </section>
    </div>
  );
}