/**
 * Date helpers used by the risk engine.
 *
 * All parsing is applied to ISO-8601 strings (or Date/number inputs) so the
 * engine remains deterministic and independent of any external clock.
 */

function parseDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      throw new Error(`Invalid date string: ${value}`);
    }
    return date;
  }
  throw new Error(`Cannot parse date from value of type ${typeof value}`);
}

function toMs(value) {
  return parseDate(value).getTime();
}

function daysBetween(a, b) {
  return (toMs(b) - toMs(a)) / 86400000;
}

module.exports = { parseDate, toMs, daysBetween };