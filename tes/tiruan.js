// Sheet dan layanan Google tiruan untuk menjalankan api.gs di Node.
const fs = require('fs');
const vm = require('vm');
const isDate = v => Object.prototype.toString.call(v) === '[object Date]';
const tgl = s => new Date(s + 'T00:00:00+07:00');

function kolomKeAngka(s) { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; }

function buatSheet(nama, data, rumusKepala) {
  // data: array baris (baris 1 = judul). rumusKepala: indeks kolom (0-based) yang berisi rumus di baris 1.
  const sh = {
    nama, data: data.map(r => r.slice()), rumus: rumusKepala || [], disisipkan: 0, diurutkan: 0, tersembunyi: false,
    getLastColumn() { return Math.max(0, ...this.data.map(r => r.length)); },
    getLastRow() { let n = this.data.length; while (n > 0 && !(this.data[n - 1] || []).some(v => v !== '' && v !== undefined && v !== null)) n--; return n; },
    getMaxRows() { return this.data.length + 50; },
    getRange(a, b, c, d) {
      const self = this;
      if (typeof a === 'string' && /^[A-Z]+:[A-Z]+$/.test(a)) {   // seluruh kolom, hanya untuk format
        const c1 = kolomKeAngka(a.split(':')[0]);
        return self.getRange(1, c1, Math.max(self.data.length, 1), 1);
      }
      if (typeof a === 'string') {
        const m = a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
        const r1 = +m[2], c1 = kolomKeAngka(m[1]), r2 = m[4] ? +m[4] : r1, c2 = m[3] ? kolomKeAngka(m[3]) : c1;
        return self.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1);
      }
      const row = a, colI = b, nr = c || 1, nc = d || 1;
      const ambil = () => { const out = []; for (let i = 0; i < nr; i++) { const r = self.data[row - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(r[colI - 1 + j] === undefined ? '' : r[colI - 1 + j]); out.push(o); } return out; };
      const tulis = (vals) => vals.forEach((r, i) => { while (self.data.length < row + i) self.data.push([]); r.forEach((v, j) => { self.data[row - 1 + i][colI - 1 + j] = v; }); });
      return {
        getValues: ambil, getValue: () => ambil()[0][0],
        getDisplayValues: () => ambil().map(r => r.map(v => isDate(v) ? v.toISOString().slice(0, 10) : String(v))),
        getDisplayValue: () => String(ambil()[0][0]),
        getFormulas: () => ambil().map((r, i) => r.map((v, j) => (row - 1 + i === 0 && self.rumus.includes(colI - 1 + j)) ? '=X' : '')),
        setValue(v) { tulis([[v]]); },
        setValues: tulis,
        setNumberFormat() {},
        copyTo() {}
      };
    },
    getDataRange() { return this.getRange(1, 1, this.data.length, this.getLastColumn()); },
    insertRowBefore(r) { this.data.splice(r - 1, 0, []); this.disisipkan++; },
    insertRowsBefore(r, n) { for (let i = 0; i < n; i++) this.data.splice(r - 1, 0, []); this.disisipkan += n; },
    insertColumnAfter(c) {
      this.data.forEach(r => { while (r.length < c) r.push(''); r.splice(c, 0, ''); });
      this.rumus = this.rumus.map(i => (i >= c ? i + 1 : i));
    },
    deleteRow(r) { this.data.splice(r - 1, 1); },
    appendRow(r) { this.data.push(r.slice()); },
    setFrozenRows() {}, hideSheet() { this.tersembunyi = true; }
  };
  return sh;
}

function muat(sheets) {
  const cache = {}; const props = {};
  const ctx = {
    console,
    SpreadsheetApp: { openById: () => ss, flush() {}, CopyPasteType: { PASTE_FORMAT: 1 } },
    ContentService: { createTextOutput: s => ({ setMimeType: () => s }), MimeType: { JSON: 1 } },
    Utilities: {
      computeDigest: (alg, teks) => require('crypto').createHash('md5').update(teks).digest(),
      base64Encode: b => Buffer.from(b).toString('base64'),
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      parseDate: (s) => tgl(s),
      formatDate: (d, z, f) => {
        const w = new Date(d.getTime() + 7 * 3600e3);   // WIB
        const iso = w.toISOString();
        const Y = iso.slice(0, 4), M = iso.slice(5, 7), D = iso.slice(8, 10), jam = iso.slice(11, 16);
        const u = String(((w.getUTCDay() + 6) % 7) + 1);
        if (f === 'u') return u;
        return f.replace('yyyy', Y).replace('MM', M).replace('dd', D).replace('HH:mm', jam);
      }
    },
    CacheService: { getScriptCache: () => ({ get: k => cache[k], put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) }
  };
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = buatSheet(n, [])) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/api.gs', 'utf8'), ctx);
  ctx.urutkanTab_ = sh => { sh.diurutkan++; };
  return { ctx, ss, cache, props, sheets };
}

module.exports = { buatSheet, muat, tgl, isDate };
