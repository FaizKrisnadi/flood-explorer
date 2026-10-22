import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarMonths, clampMonth, latestYearRange, legendBreaks, colorIndex, toCsv } from '../site/explorer-utils.mjs';

test('calendar preserves months without source shards and crosses year boundaries', () => {
  assert.deepEqual(calendarMonths('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(calendarMonths('2026-02', '2025-11'), []);
  assert.deepEqual(calendarMonths('2026-13', '2027-01'), []);
});
test('date input clamps coverage while allowing months with no source records', () => {
  assert.equal(clampMonth('2000-06', '2000-04', '2026-02'), '2000-06');
  assert.equal(clampMonth('1999-01', '2000-04', '2026-02'), '2000-04');
  assert.equal(clampMonth('2027-01', '2000-04', '2026-02'), '2026-02');
  assert.equal(clampMonth('bad', '2000-04', '2026-02'), '2000-04');
});
test('latest year means the calendar year actually present in the dataset', () => {
  assert.deepEqual(latestYearRange(['2025-12', '2026-02']), ['2026-01', '2026-02']);
  assert.deepEqual(latestYearRange([]), ['', '']);
});
test('legend intervals and colours agree at boundaries and distinguish zero', () => {
  const ranges = legendBreaks(100);
  assert.equal(colorIndex(0,100), 0);
  for (let i=0;i<ranges.length;i++) {
    assert.equal(colorIndex(ranges[i].high,100), i+1);
    assert.equal(colorIndex(ranges[i].low + .001,100), i+1);
  }
  assert.deepEqual(legendBreaks(0), []);
  assert.equal(colorIndex(100,100),5);
});
test('CSV preserves commas, quotes, newlines and prevents formula injection', () => {
  const csv = toCsv([['=SUM(A1)', 'a,b', 'a"b', 'line\nbreak', '+cmd', '32.73', 4215]]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"\'=SUM(A1)"'));
  assert.ok(csv.includes('"a,b"'));
  assert.ok(csv.includes('"a""b"'));
  assert.ok(csv.includes('"line\nbreak"'));
  assert.ok(csv.includes('"\'+cmd"'));
  assert.ok(csv.includes('"32.73","4215"'));
});
