import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvestigations } from '../services/api.js';
import RiskBadge from '../components/RiskBadge.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [investigations, setInvestigations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getInvestigations()
      .then((data) => {
        if (!cancelled) setInvestigations(Array.isArray(data) ? data : []);
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

  const topCustomers = investigations.slice(0, 10);

  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">RefundGuard Dashboard</h1>
        <p className="page-subtitle">
          Monitor refund abuse investigations and coordinated risk activity.
        </p>
      </div>

      <section className="section">
        <h2 className="section-title">Top Risk Customers</h2>

        {loading && <div className="state-message">Loading...</div>}

        {!loading && error && (
          <div className="state-message state-message--error">
            Unable to load investigation data.
          </div>
        )}

        {!loading && !error && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Overall Risk</th>
                  <th>Risk Score</th>
                  <th>Ring</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((investigation) => (
                  <tr
                    key={investigation.customer.customerId}
                    className="data-row"
                    onClick={() =>
                      navigate(`/rings/${investigation.customer.customerId}`)
                    }
                  >
                    <td className="mono">
                      {investigation.customer.customerId}
                    </td>
                    <td>
                      <RiskBadge level={investigation.summary.overallRisk} />
                    </td>
                    <td>{investigation.risk.score}</td>
                    <td className="mono">
                      {investigation.graph.inRing
                        ? investigation.graph.ringId
                        : '\u2014'}
                    </td>
                    <td>{investigation.summary.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
