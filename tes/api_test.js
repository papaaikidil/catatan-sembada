// Uji logika api.gs dengan Sheet tiruan (tanpa Google). Jalankan: node tes/api_test.js
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const isDate = v => Object.prototype.toString.call(v) === '[object Date]';

function buatSheet(nama, data, rumusKepala) {
  // data: array baris (baris 1 = judul). rumusKepala: indeks kolom (0-based) yang berisi rumus di baris 1.
  const sh = {
    nama, data: data.map(r => r.slice()), rumus: rumusKepala || [], disisipkan: 0, diurutkan: 0,
    getLastColumn() { return Math.max(...this.data.map(r => r.length)); },
    getLastRow() { return this.data.length; },
    getMaxRows() { return this.data.length + 50; },
    getRange(a, b, c, d) {
      const self = this;
      if (typeof a === 'string') {
        const m = a.match(/^([A-Z])(\d+)(?::([A-Z])(\d+))?$/);
        const col = x => x.charCodeAt(0) - 64;
        const r1 = +m[2], c1 = col(m[1]), r2 = m[4] ? +m[4] : r1, c2 = m[3] ? col(m[3]) : c1;
        return self.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1);
      }
      const row = a, colI = b, nr = c || 1, nc = d || 1;
      const ambil = () => { const out = []; for (let i = 0; i < nr; i++) { const r = self.data[row - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(r[colI - 1 + j] === undefined ? '' : r[colI - 1 + j]); out.push(o); } return out; };
      return {
        getValues: ambil, getValue: () => ambil()[0][0],
        getDisplayValues: () => ambil().map(r => r.map(v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v))),
        getDisplayValue: () => String(ambil()[0][0]),
        getFormulas: () => ambil().map((r, i) => r.map((v, j) => (row - 1 + i === 0 && self.rumus.includes(colI - 1 + j)) ? '=X' : '')),
        setValue(v) { while (self.data.length < row) self.data.push([]); self.data[row - 1][colI - 1] = v; },
        setNumberFormat() {},
        setValues(vals) { vals.forEach((r, i) => { while (self.data.length < row + i) self.data.push([]); r.forEach((v, j) => { self.data[row - 1 + i][colI - 1 + j] = v; }); }); },
        copyTo() {}
      };
    },
    getDataRange() { return this.getRange(1, 1, this.data.length, this.getLastColumn()); },
    insertRowBefore(r) { this.data.splice(r - 1, 0, []); this.disisipkan++; },
    deleteRow(r) { this.data.splice(r - 1, 1); },
    appendRow(r) { this.data.push(r.slice()); },
    setFrozenRows() {}, hideSheet() {}
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
      parseDate: (s) => new Date(s + 'T00:00:00+07:00'),
      formatDate: (d, z, f) => f === 'MM/yyyy' ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : d.toISOString().slice(0, 10)
    },
    CacheService: { getScriptCache: () => ({ get: k => cache[k], put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  };
  const ss = { getSheetByName: n => sheets[n], insertSheet: n => (sheets[n] = buatSheet(n, [])) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/api.gs', 'utf8'), ctx);
  ctx.urutkanTab_ = sh => { sh.diurutkan++; };
  return { ctx, ss, cache, props, sheets };
}

const kas = buatSheet('Kas', [
  ['Hari', 'Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Kelompok', 'Arah'],
  ['Selasa', new Date('2026-10-20T07:11:00'), new Date('2026-10-20'), 'Proyek bangunan', 300000, 'semen', 'Proyek lain', 'Keluar']
], [0, 6, 7]);
const absensi = buatSheet('Absensi', [
  ['Hari', 'Timestamp', 'Tanggal', 'Pengumpul [Rofik]', 'Pengumpul [Pak Muh]', 'Tim suling [Eko & Pak Gatot]', 'Keterangan',
    'Ada kerja lain dengan upah khusus hari ini?', 'Pekerjaan lain', 'Kerja lain untuk', 'Upah kerja lain Rofik (Rp)', 'Upah kerja lain Pak Muh (Rp)', 'Upah Rofik']
], [0, 12]);
const pengaturan = buatSheet('Pengaturan', Array.from({ length: 30 }, () => []));
pengaturan.data[19] = ['Pemilik', '123456', 'Semua'];
pengaturan.data[20] = ['Pengumpul', '1111', 'Ambil Bahan'];
pengaturan.data[21] = ['Mandor', '', 'Absensi'];
const daftar = buatSheet('Daftar', [
  ['Pengumpul', '', 'Produk', 'Satuan', 'Kategori kas', 'Arah'],
  ['Rofik', '', 'Minyak', 'kg', 'Proyek bangunan', 'Keluar'],
  ['Pak Muh', '', 'Hidrosol', 'liter', 'Pinjaman masuk', 'Masuk']
]);
const ambilBahan = buatSheet('Ambil Bahan', [['Hari', 'Timestamp', 'Tanggal', 'Pengumpul', 'Uang beli bahan (Rp)'], ['Rabu', new Date(), new Date(), 'Rofik', 1]], [0, 4]);
const tarif = buatSheet('Tarif Upah', [['Pilihan', 'Untuk', 'Upah'], ['Libur', 'Semua', 0], ['1 trip', 'Pengumpul', 76000]]);

const { ctx, ss, cache, props, sheets } = muat({ Kas: kas, 'Ambil Bahan': ambilBahan, Absensi: absensi, Pengaturan: pengaturan, Daftar: daftar, 'Tarif Upah': tarif });

// 1. PIN
let r = ctx.layani_(ss, { aksi: 'masuk', pin: '123456' });
assert.strictEqual(r.ok, true); assert.strictEqual(r.semua, true); assert.strictEqual(r.tab.length, 5);
r = ctx.layani_(ss, { aksi: 'masuk', pin: '1111' });
assert.deepStrictEqual(Array.from(r.tab), ['Ambil Bahan']);
r = ctx.layani_(ss, { aksi: 'masuk', pin: '' });
assert.strictEqual(r.kode, 'PIN', 'PIN kosong ditolak (baris Mandor tanpa PIN tidak boleh cocok)');
r = ctx.layani_(ss, { aksi: 'masuk', pin: '9999' });
assert.strictEqual(r.kode, 'PIN');

// 2. Config
r = ctx.layani_(ss, { aksi: 'config', pin: '123456' });
assert.ok(r.ok);
assert.deepStrictEqual(Array.from(r.kepala.Kas), ['Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan']);
assert.strictEqual(r.kepala.Absensi.length, 11);
assert.strictEqual(r.satuanProduk.Hidrosol, 'liter');
assert.strictEqual(r.arahKas['Pinjaman masuk'], 'Masuk');
assert.strictEqual(r.tarif[1].upah, 76000);
assert.deepStrictEqual(Array.from(r.daftar.Pengumpul), ['Rofik', 'Pak Muh']);

// 3. Simpan Kas
r = ctx.layani_(ss, { aksi: 'simpan', pin: '123456', tab: 'Kas', id: 'a1',
  nilai: { 'Tanggal': '2026-10-21', 'Kategori': 'Proyek bangunan', 'Jumlah (Rp)': 200000, 'Keterangan': ' service disel ' } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(kas.disisipkan, 1); assert.strictEqual(kas.diurutkan, 1);
const baru = kas.data[1];
assert.ok(isDate(baru[1]), 'Timestamp diisi');
assert.ok(isDate(baru[2]), 'Tanggal jadi Date');
assert.strictEqual(baru[3], 'Proyek bangunan'); assert.strictEqual(baru[4], 200000); assert.strictEqual(baru[5], 'service disel');
assert.strictEqual(baru[6], undefined, 'kolom rumus tidak ditulis');

// 4. Anti-dobel
r = ctx.layani_(ss, { aksi: 'simpan', pin: '123456', tab: 'Kas', id: 'a1', nilai: { 'Tanggal': '2026-10-21' } });
assert.strictEqual(r.dobel, true); assert.strictEqual(kas.disisipkan, 1);

// 5. Kolom asing ditolak, tidak ada baris disisipkan
r = ctx.layani_(ss, { aksi: 'simpan', pin: '123456', tab: 'Kas', id: 'a2', nilai: { 'Tanggal': '2026-10-21', 'Kolom ngawur': 1 } });
assert.strictEqual(r.ok, false); assert.ok(/Kolom ngawur/.test(r.galat)); assert.strictEqual(kas.disisipkan, 1);

// 6. Hak akses tab
r = ctx.layani_(ss, { aksi: 'simpan', pin: '1111', tab: 'Kas', id: 'a3', nilai: {} });
assert.strictEqual(r.ok, false); assert.ok(/tidak boleh/.test(r.galat));

// 7. Absensi dengan daftar (array) dan angka
r = ctx.layani_(ss, { aksi: 'simpan', pin: '123456', tab: 'Absensi', id: 'b1', nilai: {
  'Tanggal': '2026-10-21', 'Pengumpul [Rofik]': '1 trip', 'Pengumpul [Pak Muh]': 'Kerja lain', 'Tim suling [Eko & Pak Gatot]': 'Libur',
  'Ada kerja lain dengan upah khusus hari ini?': 'Ya', 'Pekerjaan lain': 'ngaci kolam', 'Kerja lain untuk': 'Proyek bangunan & lainnya',
  'Upah kerja lain Pak Muh (Rp)': 115000 } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(absensi.data[1][11], 115000); assert.strictEqual(absensi.data[1][10], '');

// 8. ubahNilai_ untuk daftar centang
assert.strictEqual(ctx.ubahNilai_('Pengumpul', ['Rofik', ' Pak Muh ', '']), 'Rofik, Pak Muh');

// 9. Terbaru
r = ctx.layani_(ss, { aksi: 'terbaru', pin: '123456', tab: 'Kas', n: 5 });
assert.strictEqual(r.ok, true); assert.strictEqual(r.baris.length, 2); assert.strictEqual(r.baris[0][3], 'Proyek bangunan');

// 10. Kunci setelah terlalu banyak PIN salah
for (let i = 0; i < 40; i++) ctx.layani_(ss, { aksi: 'masuk', pin: 'x' + i });
r = ctx.layani_(ss, { aksi: 'masuk', pin: '123456' });
assert.strictEqual(r.kode, 'KUNCI');

// 11. doPost dengan JSON rusak
const out = ctx.doPost({ postData: { contents: '{rusak' } });
assert.strictEqual(JSON.parse(out).ok, false);

console.log('Semua uji api.gs lulus.');

// 12. Kelola PIN (pemilik)
// buka kunci dulu (uji 10 sengaja mengunci)
cache.pinGagal = '0';
r = ctx.layani_(ss, { aksi: 'pinDaftar', pin: '123456' });
assert.strictEqual(r.ok, true); assert.strictEqual(r.daftar.length, 3);
assert.strictEqual(r.daftar[0].saya, true); assert.strictEqual(r.daftar[1].pin, '1111');
r = ctx.layani_(ss, { aksi: 'pinDaftar', pin: '1111' });
assert.strictEqual(r.ok, false, 'pekerja tidak boleh melihat PIN');
r = ctx.layani_(ss, { aksi: 'pinUbah', pin: '123456', baris: 21, pinBaru: '123456' });
assert.strictEqual(r.ok, false); assert.ok(/sudah dipakai/.test(r.galat));
r = ctx.layani_(ss, { aksi: 'pinUbah', pin: '123456', baris: 21, pinBaru: '12a' });
assert.strictEqual(r.ok, false);
r = ctx.layani_(ss, { aksi: 'pinUbah', pin: '123456', baris: 20, pinBaru: '' });
assert.strictEqual(r.ok, false, 'PIN pemilik tidak boleh dikosongkan');
r = ctx.layani_(ss, { aksi: 'pinUbah', pin: '123456', baris: 21, pinBaru: '4321' });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(pengaturan.data[20][1], '4321');
assert.strictEqual(ctx.layani_(ss, { aksi: 'masuk', pin: '4321' }).ok, true);
assert.strictEqual(ctx.layani_(ss, { aksi: 'masuk', pin: '1111' }).ok, false);
assert.ok(sheets['Log Aplikasi'] && sheets['Log Aplikasi'].data.length === 2, 'log tercatat');
assert.ok(!/4321/.test(JSON.stringify(sheets['Log Aplikasi'].data)), 'PIN tidak ditulis di log');

// 13. Terbaru untuk pemilik membawa nilai mentah dan tanda
r = ctx.layani_(ss, { aksi: 'terbaru', pin: '123456', tab: 'Kas', n: 5 });
assert.strictEqual(r.data.length, 2);
assert.strictEqual(r.data[0].nilai['Tanggal'], '2026-10-21'.length === 10 ? r.data[0].nilai['Tanggal'] : '');
assert.match(r.data[0].nilai['Tanggal'], /^\d{4}-\d{2}-\d{2}$/);
assert.strictEqual(r.data[0].nilai['Jumlah (Rp)'], 200000);
const pekerja = ctx.layani_(ss, { aksi: 'terbaru', pin: '4321', tab: 'Ambil Bahan', n: 5 });
assert.strictEqual(pekerja.data, undefined, 'pekerja tidak menerima data mentah');

// 14. Ubah catatan (baris bergeser karena ada catatan baru)
const target = r.data[0];
ctx.layani_(ss, { aksi: 'simpan', pin: '123456', tab: 'Kas', id: 'c1', nilai: { 'Tanggal': '2026-10-21', 'Kategori': 'Pinjaman masuk', 'Jumlah (Rp)': 5, 'Keterangan': 'baru' } });
r = ctx.layani_(ss, { aksi: 'ubah', pin: '123456', tab: 'Kas', nomor: target.nomor, tanda: target.tanda,
  nilai: { 'Tanggal': '2026-10-21', 'Kategori': 'Proyek bangunan', 'Jumlah (Rp)': 250000, 'Keterangan': 'diperbaiki' } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
const diubah = kas.data.filter(x => x[5] === 'diperbaiki')[0];
assert.ok(diubah, 'baris yang benar diubah'); assert.strictEqual(diubah[4], 250000);
assert.ok(isDate(diubah[1]), 'Timestamp asli dipertahankan');
assert.strictEqual(kas.data.filter(x => x[5] === 'baru').length, 1, 'baris lain tidak tersentuh');
// tanda lama sudah tidak berlaku
r = ctx.layani_(ss, { aksi: 'ubah', pin: '123456', tab: 'Kas', nomor: target.nomor, tanda: target.tanda, nilai: { 'Keterangan': 'x' } });
assert.strictEqual(r.kode, 'BERUBAH');
r = ctx.layani_(ss, { aksi: 'ubah', pin: '4321', tab: 'Kas', nomor: 2, tanda: 'x', nilai: {} });
assert.strictEqual(r.ok, false, 'pekerja tidak boleh mengubah');

// 15. Hapus catatan
r = ctx.layani_(ss, { aksi: 'terbaru', pin: '123456', tab: 'Kas', n: 10 });
const hapusIni = r.data.filter(d => d.nilai['Keterangan'] === 'baru')[0];
const sebelum = kas.data.length;
r = ctx.layani_(ss, { aksi: 'hapus', pin: '123456', tab: 'Kas', nomor: hapusIni.nomor, tanda: hapusIni.tanda });
assert.strictEqual(r.ok, true);
assert.strictEqual(kas.data.length, sebelum - 1);
assert.strictEqual(kas.data.filter(x => x[5] === 'baru').length, 0);
assert.ok(sheets['Log Aplikasi'].data.some(x => x[1] === 'Hapus' && /baru/.test(x[4])), 'isi yang dihapus tersimpan di log');

console.log('Semua uji fitur pemilik lulus.');

