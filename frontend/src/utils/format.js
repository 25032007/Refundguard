export function formatPercentage(value) {
  if (value === null || value === undefined) return '—';
  // Check if it's a decimal fraction like 0.25 vs 25
  const isFraction = value > 0 && value <= 1;
  const num = isFraction ? value * 100 : value;
  return `${Math.round(num)}%`;
}

export function formatCurrency(value, currency = 'GBP', symbol = '£') {
  if (value === null || value === undefined) return '—';
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function formatSignalType(type) {
  if (!type) return '—';
  const labels = {
    keyword: 'Keyword',
    category: 'Category',
    phrase: 'Phrase'
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}
