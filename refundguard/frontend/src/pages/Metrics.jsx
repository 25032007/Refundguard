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
        <h2 className="section-title">Risk Overview</h2>
        <div className="empty-state">
          <p className="empty-state-text">
            Risk metrics will appear here once the risk engine is connected.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Detection Performance</h2>
        <div className="empty-state">
          <p className="empty-state-text">
            Detection performance metrics will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}