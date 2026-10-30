// Shared data semantics for controls, legends, and downloads.
export function calendarMonths(first, last) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(first || '') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(last || '') || first > last) return [];
  const result = [];
  let [year, month] = first.split('-').map(Number);
  while (`${year}-${String(month).padStart(2, '0')}` <= last) {
    result.push(`${year}-${String(month).padStart(2, '0')}`);
    if (++month > 12) { month = 1; year++; }
  }
  return result;
}

export function clampMonth(value, first, last) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) return first;
  return value < first ? first : value > last ? last : value;
}

export function latestYearRange(months) {
  const last = months[months.length - 1];
  return last ? [`${last.slice(0, 4)}-01`, last] : ['', ''];
}

export function legendBreaks(maximum, bins = 5) {
  if (!(maximum > 0)) return [];
  return Array.from({ length: bins }, (_, index) => ({ low: index * maximum / bins, high: (index + 1) * maximum / bins }));
}

export function colorIndex(value, maximum, bins = 5) {
  if (!(value > 0) || !(maximum > 0)) return 0;
  return Math.min(bins, Math.max(1, Math.ceil(value / maximum * bins)));
}

export function csvCell(value) {
  let text = String(value ?? '');
  // Spreadsheet applications may execute formula-looking cells.
  if (/^[=+@\t\r]/.test(text) || /^-\D/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows) {
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// Date-only strings parse as UTC midnight, so they must be formatted in UTC;
// re-rendering them in the viewer's local zone shifts the label a day west of UTC.
// Absolute timestamps keep viewer-local rendering of the original instant.
export function formatFullDate(value, language = 'en') {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const locale = language === 'id' ? 'id-ID' : 'en-US';
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, day))
    );
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat(locale, options).format(parsed);
}
