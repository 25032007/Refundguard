export default function RingDetail() {
  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">Ring Investigation</h1>
        <p className="page-subtitle">Detailed investigation workspace</p>
      </div>

      <section className="section">
        <h2 className="section-title">Investigation</h2>
        <div className="empty-state empty-state-large">
          <span className="empty-state-mark" aria-hidden="true" />
          <p className="empty-state-title">No investigation selected</p>
          <p className="empty-state-text">
            Select a detected refund ring to inspect its entities, behavioral
            connections, evidence, and risk signals.
          </p>
        </div>
      </section>
    </div>
  );
}