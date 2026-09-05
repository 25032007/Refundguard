export default function Dashboard() {
  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">RefundGuard Dashboard</h1>
        <p className="page-subtitle">
          Monitor refund abuse investigations and coordinated risk activity.
        </p>
      </div>

      <section className="section">
        <h2 className="section-title">Investigation Overview</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-value" aria-label="No value yet">
              &mdash;
            </span>
            <span className="stat-label">Active Investigations</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" aria-label="No value yet">
              &mdash;
            </span>
            <span className="stat-label">High-Risk Rings</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" aria-label="No value yet">
              &mdash;
            </span>
            <span className="stat-label">Pending Reviews</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" aria-label="No value yet">
              &mdash;
            </span>
            <span className="stat-label">Cases Resolved</span>
          </div>
        </div>
      </section>

      <div className="section-grid">
        <section className="section">
          <h2 className="section-title">Investigation Activity</h2>
          <div className="empty-state">
            <span className="empty-state-mark" aria-hidden="true" />
            <p className="empty-state-title">No investigation activity yet</p>
            <p className="empty-state-text">
              Activity from refund investigations will appear here once
              transaction and case data are connected.
            </p>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Risk Distribution</h2>
          <div className="empty-state">
            <span className="empty-state-mark" aria-hidden="true" />
            <p className="empty-state-title">Awaiting risk intelligence</p>
            <p className="empty-state-text">
              Risk distribution will populate when the RefundGuard risk engine
              begins processing refund behavior.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}