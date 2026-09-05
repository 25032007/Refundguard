export default function RingList() {
  return (
    <div className="page">
      <div className="page-intro">
        <h1 className="page-title">Refund Rings</h1>
        <p className="page-subtitle">
          Investigate coordinated refund-abuse networks.
        </p>
      </div>

      <section className="section">
        <div className="empty-state empty-state-large">
          <p className="empty-state-title">No investigations loaded</p>
          <p className="empty-state-text">
            Refund-abuse ring investigations will appear here when risk data is
            connected.
          </p>
        </div>
      </section>
    </div>
  );
}