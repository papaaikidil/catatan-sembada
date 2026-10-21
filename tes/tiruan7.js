// Google Sheet dan layanan Apps Script tiruan untuk menjalankan api.gs (versi 7) di Node.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const isDate = v => Object.prototype.toString.call(v) === '[object Date]';
const tgl = s => new Date(s + 'T00:00:00+07:00');

function kolomKeAngka(s) { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
const kosong = v => v === '' || v === undefined || v === null;

function formatTanggal(d, f) {
  const w = new Date(d.getTime() + 7 * 3600e3);   // WIB
  const iso = w.toISOString();
  if (f === 'u') return String(((w.getUTCDay() + 6) % 7) + 1);
  return f.replace('yyyy', iso.slice(0, 4)).replace('MM', iso.slice(5, 7)).replace('dd', iso.slice(8, 10))
    .replace('HH', iso.slice(11, 13)).replace('mm', iso.slice(14, 16));
}

// data: baris (baris 1 = judul). rumusKepala: indeks kolom (0-based) yang judulnya berupa rumus.
function buatSheet(nama, data, rumusKepala) {
  const sh = {
    nama, data: (data || []).map(r => r.slice()), rumusKepala: rumusKepala || [], rumus: {}, format: {},
    disisipkan: 0, diurutkan: 0, tersembunyi: false, maxBaris: 0, maxKolom: 0,
    getName() { return this.nama; },
    getIndex() { return 1; },
    getLastRow() { let n = this.data.length; while (n > 0 && !(this.data[n - 1] || []).some(v => !kosong(v))) n--; return n; },
    getLastColumn() {
      let m = 0;
      this.data.forEach(r => { for (let j = (r || []).length - 1; j >= 0; j--) if (!kosong(r[j])) { m = Math.max(m, j + 1); break; } });
      return m;
    },
    getMaxRows() { return Math.max(this.data.length, this.maxBaris || 1000); },
    getMaxColumns() { return Math.max(this.getLastColumn(), this.maxKolom || 26); },
    insertRowsAfter(r, n) { this.maxBaris = this.getMaxRows() + n; },
    insertColumnsAfter(c, n) { this.maxKolom = this.getMaxColumns() + n; },
    getRange(a, b, c, d) {
      const self = this;
      if (typeof a === 'string' && /^[A-Z]+:[A-Z]+$/.test(a)) {
        const c1 = kolomKeAngka(a.split(':')[0]);
        return self.getRange(1, c1, Math.max(self.data.length, 1), 1);
      }
      if (typeof a === 'string') {
        const m = a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
        const r1 = +m[2], c1 = kolomKeAngka(m[1]), r2 = m[4] ? +m[4] : r1, c2 = m[3] ? kolomKeAngka(m[3]) : c1;
        return self.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1);
      }
      const row = a, col = b, nr = c || 1, nc = d || 1;
      if (row < 1 || col < 1 || nr < 1 || nc < 1) throw new Error('Rentang tidak sah: ' + [nama, row, col, nr, nc]);
      const pastikan = i => { while (self.data.length < i) self.data.push([]); };
      const ambil = () => {
        const out = [];
        for (let i = 0; i < nr; i++) { const r = self.data[row - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(kosong(r[col - 1 + j]) ? '' : r[col - 1 + j]); out.push(o); }
        return out;
      };
      const tulis = vals => {
        if (vals.length !== nr || vals.some(r => r.length !== nc)) throw new Error('Ukuran setValues tidak cocok di ' + nama + ': ' + vals.length + 'x' + (vals[0] || []).length + ' vs ' + nr + 'x' + nc);
        vals.forEach((r, i) => { pastikan(row + i); r.forEach((v, j) => { self.data[row - 1 + i][col - 1 + j] = v; delete self.rumus[(row + i) + ',' + (col + j)]; }); });
      };
      const rumusSel = (i, j) => {
        const r = row + i, k = col + j;
        if (r === 1 && self.rumusKepala.includes(k - 1)) return '=X';
        return self.rumus[r + ',' + k] || '';
      };
      const rg = {
        getValues: ambil, getValue: () => ambil()[0][0],
        getDisplayValues: () => ambil().map(r => r.map(v => isDate(v) ? formatTanggal(v, 'dd/MM/yyyy') : String(v))),
        getDisplayValue: () => { const v = ambil()[0][0]; return isDate(v) ? formatTanggal(v, 'dd/MM/yyyy') : String(v); },
        getFormulas: () => ambil().map((r, i) => r.map((v, j) => rumusSel(i, j))),
        getFormulasR1C1: () => ambil().map((r, i) => r.map((v, j) => rumusSel(i, j))),
        setFormula(f) { pastikan(row); self.data[row - 1][col - 1] = '(rumus)'; self.rumus[row + ',' + col] = f; return rg; },
        setFormulaR1C1(f) { return rg.setFormula(f); },
        setValue(v) { tulis([[v]]); return rg; },
        setValues(v) { tulis(v); return rg; },
        setNumberFormat(f) { for (let j = 0; j < nc; j++) self.format[col + j] = f; return rg; },
        setNumberFormats() { return rg; },
        setFontWeight() { return rg; }, setBackground() { return rg; },
        copyTo() { return rg; },
        sort(spek) {
          const blok = ambil();
          blok.sort((x, y) => {
            for (const s of spek) {
              const i = s.column - col;
              const p = isDate(x[i]) ? x[i].getTime() : x[i], q = isDate(y[i]) ? y[i].getTime() : y[i];
              if (p < q) return s.ascending ? -1 : 1;
              if (p > q) return s.ascending ? 1 : -1;
            }
            return 0;
          });
          tulis(blok); self.diurutkan++;
          return rg;
        }
      };
      return rg;
    },
    getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); },
    insertRowBefore(r) { this.insertRowsBefore(r, 1); },
    insertRowsBefore(r, n) {
      for (let i = 0; i < n; i++) this.data.splice(r - 1, 0, []);
      const baru = {};
      Object.keys(this.rumus).forEach(k => { const [a, b] = k.split(',').map(Number); baru[(a >= r ? a + n : a) + ',' + b] = this.rumus[k]; });
      this.rumus = baru; this.disisipkan += n;
    },
    deleteRow(r) {
      this.data.splice(r - 1, 1);
      const baru = {};
      Object.keys(this.rumus).forEach(k => { const [a, b] = k.split(',').map(Number); if (a !== r) baru[(a > r ? a - 1 : a) + ',' + b] = this.rumus[k]; });
      this.rumus = baru;
    },
    appendRow(r) { const n = this.getLastRow(); while (this.data.length < n) this.data.push([]); this.data.splice(n, 0, r.slice()); },
    setFrozenRows() {}, hideSheet() { this.tersembunyi = true; }
  };
  return sh;
}

function muat(sheets, opsi) {
  opsi = opsi || {};
  const cache = {}; const props = {};
  const daftar = Object.values(sheets);
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: (n) => { if (sheets[n]) throw new Error('Tab sudah ada: ' + n); sheets[n] = buatSheet(n, []); return sheets[n]; }
  };
  const ctx = {
    console,
    SpreadsheetApp: { openById: () => ss, flush() {}, CopyPasteType: { PASTE_FORMAT: 1 } },
    ContentService: { createTextOutput: s => ({ setMimeType: () => s }), MimeType: { JSON: 1 } },
    Utilities: {
      computeDigest: (alg, teks) => Array.from(crypto.createHash(alg === 'SHA_256' ? 'sha256' : 'md5').update(String(teks), 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      base64Encode: b => Buffer.from(b.map(x => x & 255)).toString('base64'),
      DigestAlgorithm: { MD5: 'MD5', SHA_256: 'SHA_256' }, Charset: { UTF_8: 'utf8' },
      getUuid: () => crypto.randomUUID(),
      parseDate: (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('parseDate: ' + s); return tgl(s); },
      formatDate: (d, z, f) => formatTanggal(d, f)
    },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] === undefined ? null : cache[k], put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => props[k] === undefined ? null : props[k],
        setProperty: (k, v) => { if (String(v).length > 9 * 1024) throw new Error('Argument too large: ' + k); props[k] = String(v); },
        deleteProperty: k => { delete props[k]; },
        getKeys: () => Object.keys(props)
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) }
  };
  vm.createContext(ctx);
  const berkas = opsi.semuaBerkas ? ['Kode.gs', 'urut_otomatis.gs', 'ubah_kondisi_bahan.gs', 'api.gs'] : ['api.gs'];
  berkas.forEach(f => vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/' + f, 'utf8'), ctx, { filename: f }));
  if (!opsi.semuaBerkas) ctx.urutkanTab_ = sh => { sh.diurutkan++; };
  const panggil = req => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(req) } }));
  return { ctx, ss, cache, props, sheets, panggil, daftar };
}

module.exports = { buatSheet, muat, tgl, isDate, formatTanggal };
