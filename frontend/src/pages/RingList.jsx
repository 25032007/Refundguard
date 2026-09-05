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
        <h2 className="section-title">Investigation Queue</h2>
        <div className="empty-state empty-state-large">
          <span className="empty-state-mark" aria-hidden="true" />
          <p className="empty-state-title">
            No coordinated refund rings detected yet
          </p>
          <p className="empty-state-text">
            RefundGuard will surface connected accounts, devices, complaints,
            and refund behavior here.
          </p>
        </div>
      </section>
    </div>
  );
}