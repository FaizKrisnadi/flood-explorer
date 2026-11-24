/* Link eligibility screening is not editorial verification. */
(function (root) {
  'use strict';
  const blocked = ['example.com', 'example.org', 'example.net', 'localhost'];
  const generic = new Set(['', 'index.html', 'index.htm', 'index.php', 'home', 'news', 'berita', 'en', 'id']);
  function validSource(value) {
    if (typeof value !== 'string' || !value.trim() || /\s/.test(value)) return false;
    try {
      // Require an absolute URL, matching the offline audit.
      if (!/^https?:\/\//i.test(value)) return false;
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return false;
      if (blocked.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) return false;
      if (/^(127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0$)/.test(url.hostname)) return false;
      return !generic.has(url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase());
    } catch (_) { return false; }
  }
  function isPublishable(record, visited) {
   const seen = visited instanceof Set ? visited : new Set(); if (!record || typeof record !== 'object' || Array.isArray(record) || seen.has(record) || !validSource(record.source_url)) return false; const supporting = record.supporting_records === undefined ? [] : record.supporting_records; if (!Array.isArray(supporting)) return false; seen.add(record); try { return supporting.every(item => isPublishable(item, seen)); } finally { seen.delete(record); }
  }
  const api = { isPublishable, filterRecords: records => Array.isArray(records) ? records.filter(isPublishable) : [] };
  root.FloodReportIntegrity = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
