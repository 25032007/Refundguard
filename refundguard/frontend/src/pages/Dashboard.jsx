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
            <p className="empty-state-text">
              Investigation activity will appear here once risk data is
              connected.
            </p>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Risk Distribution</h2>
          <div className="empty-state">
            <p className="empty-state-text">
              Risk distribution will appear here once the risk engine is
              connected.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}