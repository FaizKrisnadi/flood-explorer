/* Link eligibility screening is not editorial verification. */
(function (root) {
  'use strict';
  const blocked = ['example.com', 'example.org', 'example.net', 'localhost'];
  const generic = new Set(['', 'index.html', 'index.htm', 'index.php', 'home', 'news', 'berita', 'en', 'id']);
  function validSource(value) {
    if (typeof value !== 'string' || !value.trim() || /\s/.test(value)) return false;
    try {
      // Require an absolute URL, matching the offline audit.
      if (!/^https?:\/\//.test(value)) return false;
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return false;
      if (blocked.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) return false;
      return !generic.has(url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase());
    } catch (_) { return false; }
  }
  function isPublishable(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || !validSource(record.source_url)) return false;
    const supporting = record.supporting_records === undefined ? [] : record.supporting_records;
    return Array.isArray(supporting) && supporting.every(isPublishable);
  }
  const api = { isPublishable, filterRecords: records => Array.isArray(records) ? records.filter(isPublishable) : [] };
  root.FloodReportIntegrity = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
