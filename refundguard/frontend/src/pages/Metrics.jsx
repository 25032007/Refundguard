import { useEffect, useState } from 'react';
import { getInvestigations } from '../services/api.js';

const INITIAL = { critical: 0, high: 0, medium: 0, low: 0 };

export default function Metrics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [totals, setTotals] = useState(INITIAL);

  useEffect(() => {
    let cancelled = false;
    getInvestigations()
      .then((data) => {
        if (cancelled) return;
        const distribution = { ...INITIAL };
        for (const investigation of Array.isArray(data) ? data : []) {
          const level = (investigation.summary.overallRisk || '').toLowerCase();
          if (distribution[level] !== undefined) distribution[level] += 1;
        }
        setTotals(distribution);
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
  }, []);

  const totalCustomers = Object.values(totals).reduce((sum, count) => sum + count, 0);

  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">Risk Metrics</h1>
        <p className="page-subtitle">
          Monitor investigation and risk-engine performance.
        </p>
      </div>

      <section className="section">
        <h2 className="section-title">Investigation Overview</h2>

        {loading && <div className="state-message">Loading...</div>}

        {!loading && error && (
          <div className="state-message state-message--error">
            Unable to load investigation data.
          </div>
        )}

        {!loading && !error && (
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value stat-value--accent">
                {totalCustomers}
              </span>
              <span className="stat-label">Total Customers</span>
            </div>
            <div className="stat-card">
              <span className="stat-value stat-value--critical">
                {totals.critical}
              </span>
              <span className="stat-label">Critical</span>
            </div>
            <div className="stat-card">
              <span className="stat-value stat-value--high">
                {totals.high}
              </span>
              <span className="stat-label">High</span>
            </div>
            <div className="stat-card">
              <span className="stat-value stat-value--medium">
                {totals.medium}
              </span>
              <span className="stat-label">Medium</span>
            </div>
            <div className="stat-card">
              <span className="stat-value stat-value--low">
                {totals.low}
              </span>
              <span className="stat-label">Low</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
