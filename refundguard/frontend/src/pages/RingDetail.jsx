export default function RingDetail() {
  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">Ring Investigation</h1>
        <p className="page-subtitle">Detailed investigation workspace</p>
      </div>

      <section className="section">
        <h2 className="section-title">Investigation Overview</h2>
        <div className="empty-state">
          <p className="empty-state-text">
            Investigation details will appear here.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Connected Entities</h2>
        <div className="empty-state">
          <p className="empty-state-text">
            Entity relationships will appear here once graph data is connected.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Evidence</h2>
        <div className="empty-state">
          <p className="empty-state-text">
            Evidence and explainability signals will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}