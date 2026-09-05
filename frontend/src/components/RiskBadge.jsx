const LEVELS = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

export default function RiskBadge({ level }) {
  const normalized = String(level || '').toLowerCase();
  const label = LEVELS[normalized] || String(level || '').toUpperCase();

  return (
    <span className={`risk-badge risk-badge--${normalized}`}>{label}</span>
  );
}
