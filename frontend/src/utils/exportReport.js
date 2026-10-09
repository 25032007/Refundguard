/**
 * Helper to export PDF / Executive print report for investigation detail or ring summary
 */
export function exportToPdfReport({ title, subtitle, details, signals, decision, auditHistory }) {
  window.print();
}

export function generateCsvReport(filename, dataRows, headers) {
  if (!dataRows || !dataRows.length) return;
  const keys = headers || Object.keys(dataRows[0]);
  const csvContent = [
    keys.join(','),
    ...dataRows.map((row) => keys.map((k) => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename || 'refundguard_report'}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
