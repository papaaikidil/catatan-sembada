// =====================================================================
// SEMBADA KARYA WANGI - API untuk aplikasi Catatan Sembada (versi 7)
//
// Tempel file ini menggantikan SELURUH isi file "api" di project Apps Script "Sembada Sheet"
// (project yang sama dengan Kode.gs, urut_otomatis.gs, ubah_kondisi_bahan.gs).
// Jangan ditempel di Kode.gs.
//
// Kalau kode ini diperbarui: Terapkan > Kelola deployment > ikon pensil >
// Versi: "Versi baru" > Terapkan. Alamat /exec tetap sama.
//
// Versi 7 (tampilan dan fitur seperti Catatan Sembada Kepuh):
//  - Masuk dengan nama pengguna dan sandi (tab "Akun Aplikasi", sandi terenkripsi).
//    Saat pertama dipakai, akun dibuat otomatis dari tab "Pengguna": PIN lama menjadi sandi awal.
//  - Produksi Suling: jumlah sulingan per alat per hari di tab "Produksi Suling".
//    Upahnya dihitung dari Tarif Upah jenis Penyulingan (1x, 2x, 3x suling).
//  - Absensi diisi sekali sehari untuk semua karyawan (tab "Absensi Harian").
//  - Alat suling, karyawan, tarif upah, daftar pilihan, produk, dan kategori kas diatur dari aplikasi.
//  - Catatan lama, rumus Rekap, Dashboard, dan HPP tidak diubah oleh kode ini.
// =====================================================================

var API_ID_SHEET = '11erbcsOh7G0BKWFLmsGqvWNcQiyz0mSogFLX5AS_8AI';
var API_ZONA = 'Asia/Jakarta';
var API_VERSI = 7;
var API_LOG = 'Log Aplikasi';     // tab tersembunyi: catatan setiap perubahan
var API_SIMPAN_ID = 300;         // jumlah id isian terakhir yang diingat untuk mencegah dobel
var API_SESI_HARI = 180;         // sesi masuk berlaku selama ini kalau tidak dipakai
var API_BATAS_GAGAL = 5;         // sandi salah sebanyak ini dalam 15 menit = nama pengguna dikunci sementara

var SH_ABSENSI = 'Absensi Harian';
var SH_ABSENSI_LAMA = 'Absensi';
var SH_PRODUKSI = 'Produksi Suling';
var SH_KARYAWAN = 'Karyawan';
var SH_ALAT = 'Alat Suling';
var SH_TARIF = 'Tarif Upah';
var SH_DAFTAR = 'Daftar';
var SH_PIN_LAMA = 'Pengguna';
var SH_AKUN = 'Akun Aplikasi';
var SH_APLIKASI = 'Pengaturan Aplikasi';

var URUTAN_TAB = ['Ambil Bahan', 'Produksi Suling', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
var KEPALA_ABSENSI = ['Hari', 'Timestamp', 'Tanggal', 'Nama', 'Tim', 'Pekerjaan', 'Alat', 'Jumlah sulingan', 'Upah (Rp)',
  'Pos upah', 'Pekerjaan lain', 'Kerja lain untuk', 'Keterangan', 'Diisi oleh'];
var KEPALA_PRODUKSI = ['Hari', 'Timestamp', 'Tanggal', 'Alat suling', 'Operator', 'Jumlah sulingan', 'Kondisi alat', 'Keterangan',
  'Upah (Rp)', 'Diisi oleh', 'ID', 'ID isian'];
var KEPALA_AKUN = ['Nama pengguna', 'Nama', 'Peran', 'Boleh mengisi', 'Boleh mengatur', 'Aktif', 'Wajib ganti sandi',
  'Sandi (terenkripsi)', 'Garam', 'Versi sesi', 'Terakhir masuk'];
var KEPALA_APLIKASI = ['Kunci', 'Nilai', 'Keterangan'];
var PERAN_PENGGUNA = ['Pemilik', 'Pencatat', 'Mandor', 'Lainnya'];
var JENIS_KERJA = ['Libur', 'Pengumpulan', 'Penyulingan', 'Kerja harian', 'Kerja lain'];
var DAFTAR_PILIHAN = ['Daerah', 'Kondisi bahan', 'Kondisi alat', 'Pembeli', 'Status bayar', 'Kerja lain untuk'];
var KELOMPOK_KAS = ['Operasional usaha', 'Pengembangan usaha', 'Cicilan kendaraan', 'Keluarga & pribadi', 'Proyek lain',
  'Pembiayaan', 'Pemasukan lain'];
var URUTAN_MASTER = ['Alat Suling', 'Karyawan', 'Tarif Upah', 'Pilihan', 'Produk', 'Kategori Kas'];

// Dari mana setiap data induk dibaca. Semuanya tab yang sudah ada di Sheet ini.
var SUMBER_MASTER = {
  'Alat Suling': {sheet: SH_ALAT},
  'Karyawan': {sheet: SH_KARYAWAN},
  'Tarif Upah': {sheet: SH_TARIF, berhentiDiKosong: true},
  'Pilihan': {daftar: true},
  'Produk': {blok: [['Produk', 'Produk'], ['Satuan', 'Satuan'], ['Dihitung sebagai minyak', 'Dihitung sebagai minyak'],
    ['Harga biasa (Rp)', 'Harga biasa (Rp)']]},
  'Kategori Kas': {blok: [['Kategori', 'Kategori kas'], ['Arah', 'Arah'], ['Kelompok', 'Kelompok']]}
};

// ---------------------------------------------------------------- PINTU MASUK WEB

function doGet() {
  return keluaranJson_({ok: true, pesan: 'API Catatan Sembada aktif.', versi: API_VERSI});
}

function doPost(e) {
  var hasil;
  try {
    var req = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    hasil = layani_(SpreadsheetApp.openById(API_ID_SHEET), req);
  } catch (err) {
    hasil = {ok: false, galat: String(err && err.message ? err.message : err)};
  }
  return keluaranJson_(hasil);
}

function keluaranJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function layani_(ss, req) {
  var aksi = teks_(req.aksi);
  // Aplikasi versi lama (masuk dengan PIN) yang masih terbuka di HP.
  if (req.pin !== undefined && !req.token) {
    return {ok: false, kode: 'PERBARUI', galat: 'Aplikasi Catatan Sembada sudah diperbarui. Tutup aplikasinya, lalu buka lagi saat ada sinyal.'};
  }
  if (aksi === 'masuk') return masuk_(ss, req);

  var akses = cekSesi_(ss, req.token);
  if (!akses) return {ok: false, kode: 'SESI', galat: 'Sesi sudah berakhir. Silakan masuk lagi.'};
  if (aksi === 'keluar') return keluarSesi_(req.token);
  if (aksi === 'sandiUbah') return denganKunci_(function () { return sandiUbah_(ss, akses, req); });
  if (aksi === 'config') return config_(ss, akses);
  if (aksi === 'logo') return logo_(ss);
  if (akses.wajibGanti) return {ok: false, kode: 'GANTI', galat: 'Ganti sandi sementara dulu sebelum mencatat.'};

  switch (aksi) {
    case 'simpan': return simpan_(ss, akses, req);
    case 'terbaru': return terbaru_(ss, akses, req);
    case 'ringkasan': return ringkasan_(ss, akses);
    case 'ubah': return ubah_(ss, akses, req);
    case 'hapus': return hapus_(ss, akses, req);
    case 'masterSimpan': return masterSimpan_(ss, akses, req);
    case 'masterAktif': return masterAktif_(ss, akses, req);
    case 'masterUrut': return masterUrut_(ss, akses, req);
    case 'penggunaDaftar': return penggunaDaftar_(ss, akses);
    case 'penggunaSimpan': return penggunaSimpan_(ss, akses, req);
    case 'tampilanSimpan': return tampilanSimpan_(ss, akses, req);
  }
  return {ok: false, galat: 'Aksi tidak dikenal: ' + aksi};
}

function denganKunci_(f) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return f(); } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- ALAT BANTU

function adalahTanggal_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function teks_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function ya_(v) { return !/^(tidak|no|0|false|nonaktif)$/i.test(teks_(v)); }   // kosong dianggap Ya
function tglIso_(d) { return Utilities.formatDate(d, API_ZONA, 'yyyy-MM-dd'); }
function hariIniIso_() { return tglIso_(new Date()); }
function tglDariIso_(s) { return Utilities.parseDate(s, API_ZONA, 'yyyy-MM-dd'); }
function tglIndo_(iso) { return iso ? String(iso).split('-').reverse().join('/') : ''; }
function normalNama_(s) { return teks_(s).toLowerCase(); }
function pecahDaftar_(s) { return teks_(s).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; }); }
function namaSheet_(tab) { return tab === 'Absensi' ? SH_ABSENSI : tab; }
function rpTeks_(n) { return 'Rp' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function bulat_(n, d) { var f = Math.pow(10, d === undefined ? 2 : d); return Math.round(n * f) / f; }
function idBaru_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }

// Tanggal apa pun menjadi 'yyyy-MM-dd' (WIB). Kosong kalau bukan tanggal.
function tglKunci_(v) {
  if (adalahTanggal_(v)) return tglIso_(v);
  var s = teks_(v);
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function angka_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v === null || v === undefined ? '' : v).replace(/[^\d,.\-]/g, '');
  if (!s || s === '-') return 0;
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function kepalaSheet_(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(teks_);
}

// Membuat tab kalau belum ada (dengan judul kolom).
function siapkanSheet_(ss, nama, kepala, sembunyi) {
  var sh = ss.getSheetByName(nama);
  if (sh) return sh;
  sh = ss.insertSheet(nama);
  sh.getRange(1, 1, 1, kepala.length).setValues([kepala]);
  sh.setFrozenRows(1);
  if (sembunyi) sh.hideSheet();
  return sh;
}

// Kolom isian form: kolom B (Timestamp) sampai sebelum kolom rumus (abu-abu) pertama.
function kolomForm_(sh) {
  var lastCol = sh.getLastColumn();
  var judul = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var rumus = sh.getRange(1, 1, 1, lastCol).getFormulas()[0];
  var akhir = 2;                                   // indeks 0-based, mulai dari kolom C
  while (akhir < lastCol && rumus[akhir] === '') akhir++;
  return {kepala: judul.slice(1, akhir).map(function (j) { return teks_(j); }), lastCol: lastCol};
}

// ---------------------------------------------------------------- PENGATURAN APLIKASI

function bacaAplikasi_(ss) {
  var out = {};
  var sh = ss.getSheetByName(SH_APLIKASI);
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    var k = teks_(r[0]);
    if (k) out[k] = r[1];
  });
  return out;
}

function simpanAplikasi_(ss, kunci, nilai, ket) {
  var sh = siapkanSheet_(ss, SH_APLIKASI, KEPALA_APLIKASI, true);
  sh.getRange('B:B').setNumberFormat('@');           // nilai selalu teks (JSON, logo)
  var n = sh.getLastRow();
  var kunciAda = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return teks_(r[0]); }) : [];
  var i = kunciAda.indexOf(kunci);
  var baris = i >= 0 ? i + 2 : Math.max(n, 1) + 1;
  sh.getRange(baris, 1, 1, 2).setValues([[kunci, nilai]]);
  if (i < 0 && ket) sh.getRange(baris, 3).setValue(ket);
}

function jsonAman_(s, bawaan) {
  try { var v = JSON.parse(s); return v === null || v === undefined ? bawaan : v; } catch (e) { return bawaan; }
}

function tandaLogo_(logo) {
  return logo ? Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, logo, Utilities.Charset.UTF_8)) : '';
}

// ---------------------------------------------------------------- AKUN & SESI

function hashSandi_(garam, sandi) {
  var teks = garam + ':' + String(sandi);
  var hasil = '';
  for (var i = 0; i < 100; i++) {
    hasil = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, teks, Utilities.Charset.UTF_8));
    teks = hasil + garam;
  }
  return hasil;
}

function sandiAcak_() {
  var huruf = 'abcdefghjkmnpqrstuvwxyz23456789';
  var s = '';
  for (var i = 0; i < 8; i++) s += huruf.charAt(Math.floor(Math.random() * huruf.length));
  return s;
}

// Nama pengguna dari nama orang: huruf kecil tanpa spasi, "Mas" di depan dibuang. Contoh: Mas Wildan -> wildan.
function buatNamaPengguna_(nama, dipakai) {
  var s = normalNama_(nama).replace(/[^a-z0-9]+/g, '');
  var t = /^mas[a-z0-9]{3,}$/.test(s) ? s.slice(3) : s;
  if (t.length < 3) t = (t + 'usr').slice(0, 3);
  t = t.slice(0, 24);
  var u = t, i = 2;
  while (dipakai[u]) u = t + (i++);
  dipakai[u] = true;
  return u;
}

// Tab Akun Aplikasi. Kalau belum ada, dibuat dari tab Pengguna (PIN lama = sandi awal).
function siapkanAkun_(ss) {
  var sh = ss.getSheetByName(SH_AKUN);
  if (sh && sh.getLastRow() >= 2) return sh;
  return denganKunci_(function () {
    var s = ss.getSheetByName(SH_AKUN);
    if (s && s.getLastRow() >= 2) return s;
    if (!s) {
      s = ss.insertSheet(SH_AKUN);
      s.getRange(1, 1, 1, KEPALA_AKUN.length).setValues([KEPALA_AKUN]);
      s.setFrozenRows(1);
      s.hideSheet();
    }
    s.getRange(1, 1, Math.max(s.getMaxRows(), 2), KEPALA_AKUN.length).setNumberFormat('@');
    var baris = akunDariPin_(ss);
    if (!baris.length) {
      var sandi = sandiAcak_(), garam = idBaru_();
      baris.push(['wildan', 'Mas Wildan', 'Pemilik', 'Semua', 'Ya', 'Ya', 'Ya', hashSandi_(garam, sandi), garam, '1', '']);
      simpanAplikasi_(ss, 'sandiSementara', 'wildan: ' + sandi, 'Sandi sementara pemilik. Hilang otomatis setelah sandi diganti.');
    }
    s.getRange(2, 1, baris.length, KEPALA_AKUN.length).setValues(baris);
    catatLog_(ss, 'Buat akun aplikasi', SH_AKUN, '', '', baris.map(function (r) { return r[0] + ' (' + r[1] + ')'; }).join(', '), 'Sistem');
    return s;
  });
}

function akunDariPin_(ss) {
  var sh = ss.getSheetByName(SH_PIN_LAMA);
  if (!sh || sh.getLastRow() < 2) return [];
  var kepala = kepalaSheet_(sh);
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getDisplayValues();
  var g = function (r, h) { var j = kepala.indexOf(h); return j >= 0 ? teks_(r[j]) : ''; };
  var tarif = bacaTarifApi_(ss), karyawan = bacaKaryawan_(ss);
  var timSuling = timDenganJenis_(tarif, 'Penyulingan');
  var dipakai = {}, out = [];
  data.forEach(function (r) {
    var nama = g(r, 'Nama'), pin = g(r, 'PIN'), absen = g(r, 'Absen untuk');
    if (!nama || !pin || !ya_(g(r, 'Aktif'))) return;
    if (/^semua\b/i.test(absen)) return;                        // PIN bersama satu tim: tidak dibuatkan akun
    var peranLama = normalNama_(g(r, 'Peran'));
    var pemilik = peranLama === 'pemilik' || /^semua$/i.test(g(r, 'Boleh mengisi'));
    var peran = pemilik ? 'Pemilik' : (peranLama === 'mandor' ? 'Mandor' : 'Pencatat');
    var tab = pecahDaftar_(g(r, 'Boleh mengisi')).filter(function (t) { return URUTAN_TAB.indexOf(t) >= 0; });
    if (peran === 'Mandor' && tab.indexOf('Absensi') < 0) tab.push('Absensi');
    var suling = pecahDaftar_(absen).some(function (n) {
      return karyawan.some(function (k) { return k.nama === n && timSuling.indexOf(k.tim) >= 0; });
    });
    if (suling && tab.indexOf('Produksi Suling') < 0) tab.push('Produksi Suling');
    tab.sort(function (a, b) { return URUTAN_TAB.indexOf(a) - URUTAN_TAB.indexOf(b); });
    var garam = idBaru_();
    out.push([buatNamaPengguna_(nama, dipakai), nama, peran, pemilik ? 'Semua' : tab.join(', '), pemilik ? 'Ya' : 'Tidak',
      'Ya', 'Tidak', hashSandi_(garam, pin), garam, '1', '']);
  });
  return out;
}

function bacaPengguna_(ss) {
  var sh = siapkanAkun_(ss);
  if (sh.getLastRow() < 2) return [];
  var kepala = kepalaSheet_(sh);
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getValues();
  var k = function (h) { return kepala.indexOf(h); };
  return data.map(function (r, i) {
    var g = function (h) { var j = k(h); return j >= 0 ? r[j] : ''; };
    return {
      baris: i + 2, pengguna: normalNama_(g('Nama pengguna')), nama: teks_(g('Nama')),
      peran: teks_(g('Peran')) || 'Pencatat', boleh: teks_(g('Boleh mengisi')),
      mengatur: /^ya$/i.test(teks_(g('Boleh mengatur'))), aktif: !/^tidak$/i.test(teks_(g('Aktif'))),
      wajibGanti: /^ya$/i.test(teks_(g('Wajib ganti sandi'))), hash: teks_(g('Sandi (terenkripsi)')),
      garam: teks_(g('Garam')), versi: Number(g('Versi sesi')) || 1, terakhir: teks_(g('Terakhir masuk'))
    };
  }).filter(function (p) { return p.pengguna; });
}

function tulisPengguna_(ss, baris, nilai) {
  var sh = siapkanAkun_(ss);
  var kepala = kepalaSheet_(sh);
  if (!baris) {
    baris = sh.getLastRow() + 1;
    var row = kepala.map(function (h) { return nilai[h] === undefined ? '' : String(nilai[h]); });
    sh.getRange(baris, 1, 1, row.length).setNumberFormat('@');
    sh.getRange(baris, 1, 1, row.length).setValues([row]);
    return;
  }
  Object.keys(nilai).forEach(function (h) {
    var j = kepala.indexOf(h);
    if (j >= 0) { var sel = sh.getRange(baris, j + 1); sel.setNumberFormat('@'); sel.setValue(String(nilai[h])); }
  });
}

function tabBoleh_(boleh) {
  if (/^semua$/i.test(boleh)) return URUTAN_TAB.slice();
  return pecahDaftar_(boleh).filter(function (t) { return URUTAN_TAB.indexOf(t) >= 0; });
}

function aksesDari_(p) {
  var pemilik = p.peran === 'Pemilik';
  return {pengguna: p.pengguna, nama: p.nama || p.pengguna, peran: p.peran, tab: tabBoleh_(p.boleh),
    admin: pemilik || p.mengatur, pemilik: pemilik, wajibGanti: p.wajibGanti, baris: p.baris, versi: p.versi};
}

function kunciSesi_(token) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8);
  return 'S_' + Utilities.base64Encode(d).replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
}

function buatSesi_(p) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var hari = hariIniIso_();
  PropertiesService.getScriptProperties().setProperty(kunciSesi_(token), JSON.stringify({u: p.pengguna, v: p.versi, t: hari, a: hari}));
  return token;
}

function cekSesi_(ss, token) {
  if (!token) return null;
  var props = PropertiesService.getScriptProperties();
  var kunci = kunciSesi_(token);
  var isi = props.getProperty(kunci);
  if (!isi) return null;
  var s;
  try { s = JSON.parse(isi); } catch (e) { return null; }
  var p = bacaPengguna_(ss).filter(function (x) { return x.pengguna === s.u; })[0];
  if (!p || !p.aktif || p.versi !== s.v) { props.deleteProperty(kunci); return null; }
  var hari = hariIniIso_();
  if (s.a !== hari) { s.a = hari; props.setProperty(kunci, JSON.stringify(s)); }
  return aksesDari_(p);
}

function bersihkanSesi_() {
  var props = PropertiesService.getScriptProperties();
  var batas = tglIso_(new Date(Date.now() - API_SESI_HARI * 86400000));
  props.getKeys().forEach(function (k) {
    if (k.indexOf('S_') !== 0) return;
    try {
      var s = JSON.parse(props.getProperty(k));
      if (!s.a || s.a < batas) props.deleteProperty(k);
    } catch (e) { props.deleteProperty(k); }
  });
}

function masuk_(ss, req) {
  var u = normalNama_(req.pengguna);
  var cache = CacheService.getScriptCache();
  var gagalSemua = Number(cache.get('gagalSemua') || 0);
  var gagalIni = Number(cache.get('gagal_' + u) || 0);
  if (gagalSemua >= 60 || gagalIni >= API_BATAS_GAGAL) {
    return {ok: false, kode: 'KUNCI', galat: 'Terlalu banyak sandi salah. Coba lagi 15 menit lagi.'};
  }
  var p = bacaPengguna_(ss).filter(function (x) { return x.pengguna === u; })[0];
  if (!u || !p || !p.aktif || !p.garam || hashSandi_(p.garam, String(req.sandi || '')) !== p.hash) {
    cache.put('gagalSemua', String(gagalSemua + 1), 900);
    if (u) cache.put('gagal_' + u, String(gagalIni + 1), 900);
    return {ok: false, kode: 'SALAH', galat: 'Nama pengguna atau sandi salah.'};
  }
  bersihkanSesi_();
  var token = buatSesi_(p);
  tulisPengguna_(ss, p.baris, {'Terakhir masuk': Utilities.formatDate(new Date(), API_ZONA, 'dd/MM/yyyy HH:mm')});
  return {ok: true, token: token, akses: aksesDari_(p), versiApi: API_VERSI};
}

function keluarSesi_(token) {
  PropertiesService.getScriptProperties().deleteProperty(kunciSesi_(token));
  return {ok: true};
}

function cekSandiBaru_(s) {
  s = String(s || '');
  if (s.length < 4) return 'Sandi minimal 4 huruf atau angka.';
  if (s.length > 64) return 'Sandi terlalu panjang.';
  return '';
}

function sandiUbah_(ss, akses, req) {
  var p = bacaPengguna_(ss).filter(function (x) { return x.pengguna === akses.pengguna; })[0];
  if (!p) return {ok: false, galat: 'Pengguna tidak ditemukan.'};
  if (hashSandi_(p.garam, String(req.sandiLama || '')) !== p.hash) return {ok: false, galat: 'Sandi lama salah.'};
  var cek = cekSandiBaru_(req.sandiBaru);
  if (cek) return {ok: false, galat: cek};
  if (String(req.sandiBaru) === String(req.sandiLama)) return {ok: false, galat: 'Sandi baru harus berbeda dari sandi lama.'};
  var garam = idBaru_();
  var versi = p.versi + 1;
  tulisPengguna_(ss, p.baris, {'Sandi (terenkripsi)': hashSandi_(garam, req.sandiBaru), 'Garam': garam, 'Versi sesi': versi,
    'Wajib ganti sandi': 'Tidak'});
  var app = bacaAplikasi_(ss);
  if (teks_(app.sandiSementara).indexOf(p.pengguna + ':') === 0) simpanAplikasi_(ss, 'sandiSementara', '');
  catatLog_(ss, 'Ganti sandi', SH_AKUN, p.baris, '', p.pengguna, akses.pengguna);
  p.versi = versi; p.wajibGanti = false;
  return {ok: true, token: buatSesi_(p), akses: aksesDari_(p)};
}

function penggunaDaftar_(ss, akses) {
  if (!akses.pemilik) return {ok: false, galat: 'Hanya pemilik yang boleh mengatur pengguna.'};
  return {ok: true, daftar: bacaPengguna_(ss).map(function (p) {
    return {pengguna: p.pengguna, nama: p.nama, peran: p.peran, boleh: /^semua$/i.test(p.boleh) ? 'Semua' : tabBoleh_(p.boleh),
      mengatur: p.mengatur || p.peran === 'Pemilik', aktif: p.aktif, wajibGanti: p.wajibGanti, saya: p.pengguna === akses.pengguna,
      terakhir: p.terakhir};
  })};
}

function penggunaSimpan_(ss, akses, req) {
  if (!akses.pemilik) return {ok: false, galat: 'Hanya pemilik yang boleh mengatur pengguna.'};
  return denganKunci_(function () {
    var semua = bacaPengguna_(ss);
    var u = normalNama_(req.pengguna);
    var p = semua.filter(function (x) { return x.pengguna === u; })[0];
    var nama = teks_(req.nama);
    var peran = PERAN_PENGGUNA.indexOf(req.peran) >= 0 ? req.peran : 'Pencatat';
    var boleh = req.boleh === 'Semua' ? 'Semua' : (req.boleh || []).filter(function (t) { return URUTAN_TAB.indexOf(t) >= 0; }).join(', ');
    var aktif = req.aktif !== false;
    if (!nama) return {ok: false, galat: 'Nama wajib diisi.'};
    if (nama.length > 40) return {ok: false, galat: 'Nama terlalu panjang.'};

    if (req.baru) {
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) return {ok: false, galat: 'Nama pengguna 3–30 huruf kecil, angka, titik, atau garis bawah. Tanpa spasi.'};
      if (p) return {ok: false, galat: 'Nama pengguna "' + u + '" sudah dipakai.'};
      var cek = cekSandiBaru_(req.sandiBaru);
      if (cek) return {ok: false, galat: cek};
      var garam = idBaru_();
      tulisPengguna_(ss, 0, {'Nama pengguna': u, 'Nama': nama, 'Peran': peran, 'Boleh mengisi': boleh, 'Boleh mengatur': req.mengatur ? 'Ya' : 'Tidak',
        'Aktif': aktif ? 'Ya' : 'Tidak', 'Wajib ganti sandi': req.wajibGanti ? 'Ya' : 'Tidak',
        'Sandi (terenkripsi)': hashSandi_(garam, req.sandiBaru), 'Garam': garam, 'Versi sesi': 1, 'Terakhir masuk': ''});
      catatLog_(ss, 'Tambah pengguna', SH_AKUN, '', '', u + ' (' + peran + ')', akses.pengguna);
      return {ok: true};
    }

    if (!p) return {ok: false, galat: 'Pengguna tidak ditemukan.'};
    var pemilikLain = semua.filter(function (x) { return x.peran === 'Pemilik' && x.aktif && x.pengguna !== u; }).length;
    if (p.peran === 'Pemilik' && p.aktif && (peran !== 'Pemilik' || !aktif) && pemilikLain === 0) {
      return {ok: false, galat: 'Harus ada minimal satu pemilik yang aktif.'};
    }
    var ubah = {'Nama': nama, 'Peran': peran, 'Boleh mengisi': boleh, 'Boleh mengatur': req.mengatur ? 'Ya' : 'Tidak', 'Aktif': aktif ? 'Ya' : 'Tidak'};
    var versiBaru = p.versi;
    // Ganti nama pengguna (dipakai saat masuk). HP yang sedang masuk dengan nama lama diminta masuk lagi.
    var uBaru = req.penggunaBaru === undefined ? u : normalNama_(req.penggunaBaru);
    if (uBaru !== u) {
      if (!/^[a-z0-9._-]{3,30}$/.test(uBaru)) return {ok: false, galat: 'Nama pengguna 3–30 huruf kecil, angka, titik, atau garis bawah. Tanpa spasi.'};
      if (semua.some(function (x) { return x.pengguna === uBaru; })) return {ok: false, galat: 'Nama pengguna "' + uBaru + '" sudah dipakai.'};
      ubah['Nama pengguna'] = uBaru;
      versiBaru = p.versi + 1;
      ubah['Versi sesi'] = versiBaru;
    }
    if (req.sandiBaru) {
      var cek2 = cekSandiBaru_(req.sandiBaru);
      if (cek2) return {ok: false, galat: cek2};
      var garam2 = idBaru_();
      ubah['Sandi (terenkripsi)'] = hashSandi_(garam2, req.sandiBaru);
      ubah['Garam'] = garam2;
      versiBaru = p.versi + 1;
      ubah['Versi sesi'] = versiBaru;              // HP yang masuk dengan sandi lama diminta masuk lagi
      ubah['Wajib ganti sandi'] = req.wajibGanti ? 'Ya' : 'Tidak';
    }
    tulisPengguna_(ss, p.baris, ubah);
    catatLog_(ss, 'Ubah pengguna', SH_AKUN, p.baris, '', u + (uBaru !== u ? ' -> ' + uBaru : '') + (req.sandiBaru ? ' (sandi diganti)' : ''), akses.pengguna);
    // Akun sendiri: HP ini tetap masuk dengan sesi baru.
    if (u === akses.pengguna && versiBaru !== p.versi) {
      var diri = bacaPengguna_(ss).filter(function (x) { return x.pengguna === uBaru; })[0];
      return {ok: true, token: buatSesi_(diri), akses: aksesDari_(diri), pengguna: uBaru};
    }
    return {ok: true, pengguna: uBaru};
  });
}

// ---------------------------------------------------------------- KARYAWAN, ALAT, TARIF (UNTUK HITUNGAN)

function bacaKaryawan_(ss) {
  return bacaMaster_(ss, 'Karyawan').map(function (m) {
    return {baris: m.baris, nama: m.nilai['Nama'], tim: m.nilai['Tim'], alat: m.nilai['Alat'], aktif: m.aktif};
  });
}

function bacaAlat_(ss) {
  return bacaMaster_(ss, 'Alat Suling').map(function (m) { return {baris: m.baris, nama: m.nilai['Nama alat'], aktif: m.aktif}; });
}

function bacaTarifApi_(ss) {
  return bacaMaster_(ss, 'Tarif Upah').map(function (m) {
    var v = m.nilai;
    return {pilihan: v['Pilihan'], untuk: v['Untuk'], upah: Number(v['Upah (Rp)']) || 0, jenis: v['Jenis kerja'],
      sulingan: Number(v['Jumlah sulingan']) || 0, aktif: m.aktif};
  });
}

function bacaReferensi_(ss) {
  return {tarif: bacaTarifApi_(ss), karyawan: bacaKaryawan_(ss), alat: bacaAlat_(ss)};
}

// Tim yang dikenal: dari Tarif Upah (kolom Untuk) dan dari daftar karyawan.
function daftarTim_(ref) {
  var tim = [];
  ref.tarif.forEach(function (t) { if (t.untuk && !/^semua$/i.test(t.untuk) && tim.indexOf(t.untuk) < 0) tim.push(t.untuk); });
  ref.karyawan.forEach(function (k) { if (k.tim && tim.indexOf(k.tim) < 0) tim.push(k.tim); });
  return tim;
}

function timDenganJenis_(tarif, jenis) {
  var out = [];
  tarif.forEach(function (t) { if (t.jenis === jenis && t.untuk && !/^semua$/i.test(t.untuk) && out.indexOf(t.untuk) < 0) out.push(t.untuk); });
  return out;
}

// Upah operator untuk n sulingan dalam sehari, dari Tarif Upah jenis Penyulingan (1x, 2x, 3x suling).
// Kalau jumlahnya melebihi tarif tertinggi: tarif tertinggi + tarif 1x untuk setiap sulingan tambahan.
function upahProduksi_(ref, operator, n) {
  n = Number(n) || 0;
  if (n <= 0) return 0;
  var k = ref.karyawan.filter(function (x) { return x.nama === operator; })[0];
  var tim = k ? k.tim : '';
  var tingkat = ref.tarif.filter(function (t) {
    return t.jenis === 'Penyulingan' && t.sulingan > 0 && (!tim || /^semua$/i.test(t.untuk) || t.untuk === tim);
  });
  if (!tingkat.length) return 0;
  var persis = tingkat.filter(function (t) { return t.sulingan === n; })[0];
  if (persis) return persis.upah;
  var maks = tingkat.reduce(function (a, b) { return b.sulingan > a.sulingan ? b : a; });
  var satu = tingkat.filter(function (t) { return t.sulingan === 1; })[0];
  var perSuling = satu ? satu.upah : Math.round(maks.upah / maks.sulingan);
  if (n > maks.sulingan) return maks.upah + (n - maks.sulingan) * perSuling;
  return n * perSuling;
}

// ---------------------------------------------------------------- DATA INDUK (DIATUR DARI APLIKASI)

function definisiMaster_(ss) {
  var ref = bacaReferensi_(ss);
  var tim = daftarTim_(ref);
  var kelompok = KELOMPOK_KAS.slice();
  bacaMaster_(ss, 'Kategori Kas').forEach(function (m) {
    var k = m.nilai['Kelompok'];
    if (k && kelompok.indexOf(k) < 0) kelompok.push(k);
  });
  return {
    'Alat Suling': {kunci: 'alat', judul: 'Alat suling', utama: 'Nama alat', kolom: [
      {h: 'Nama alat', j: 'teks', wajib: true, bantuan: 'Contoh: Ketel 1, Ketel 2.'},
      {h: 'Catatan', j: 'teks'}]},
    'Karyawan': {kunci: 'karyawan', judul: 'Karyawan', utama: 'Nama', keluar: true, kolom: [
      {h: 'Nama', j: 'teks', wajib: true, bantuan: 'Regu yang upahnya dihitung bersama boleh satu nama, contoh: Eko & Pak Gatot.'},
      {h: 'Tim', j: 'pilih', opsi: tim, lainnya: true, wajib: true, bantuan: 'Menentukan pilihan absensi dan upahnya.'},
      {h: 'Alat', j: 'alat', bantuan: 'Untuk tim suling: alat yang biasa dipegang. Otomatis terpilih sebagai operator di Produksi Suling.'},
      {h: 'No HP', j: 'teks'},
      {h: 'Catatan', j: 'teks'}]},
    'Tarif Upah': {kunci: 'tarif', judul: 'Tarif upah', utama: 'Pilihan', kolom: [
      {h: 'Pilihan', j: 'teks', wajib: true, bantuan: 'Yang dipilih saat absensi, contoh: 1 trip, Harian kenek, Libur.'},
      {h: 'Untuk', j: 'pilih', opsi: ['Semua'].concat(tim), lainnya: true, wajib: true},
      {h: 'Upah (Rp)', j: 'rupiah', bantuan: 'Untuk kerja lain biarkan 0: upahnya diisi saat absensi.'},
      {h: 'Jenis kerja', j: 'pilih', opsi: JENIS_KERJA, wajib: true,
        bantuan: 'Menentukan pos upah di Rekap. Libur = tidak dihitung hari kerja. Penyulingan dengan jumlah sulingan = tarif borongan di Produksi Suling.'},
      {h: 'Jumlah sulingan', j: 'angka', bantuan: 'Hanya untuk tarif borongan suling (1, 2, 3). Selain itu isi 0.'}]},
    'Pilihan': {kunci: 'pilihan', judul: 'Daftar pilihan', utama: 'Pilihan', kelompok: 'Daftar', hapus: true, kolom: [
      {h: 'Daftar', j: 'pilih', opsi: DAFTAR_PILIHAN, wajib: true},
      {h: 'Pilihan', j: 'teks', wajib: true}]},
    'Produk': {kunci: 'produk', judul: 'Produk', utama: 'Produk', hapus: true, kolom: [
      {h: 'Produk', j: 'teks', wajib: true},
      {h: 'Satuan', j: 'pilih', opsi: ['kg', 'liter', 'botol', 'pcs'], wajib: true},
      {h: 'Dihitung sebagai minyak', j: 'pilih', opsi: ['Ya', 'Tidak'], wajib: true, bantuan: 'Ya = ikut dihitung sebagai minyak terjual (kg) di Rekap.'},
      {h: 'Harga biasa (Rp)', j: 'rupiah', bantuan: 'Otomatis terisi saat mencatat penjualan. Boleh kosong.'}]},
    'Kategori Kas': {kunci: 'kategori', judul: 'Kategori kas', utama: 'Kategori', hapus: true, kolom: [
      {h: 'Kategori', j: 'teks', wajib: true},
      {h: 'Arah', j: 'pilih', opsi: ['Keluar', 'Masuk'], wajib: true},
      {h: 'Kelompok', j: 'pilih', opsi: kelompok, lainnya: true, wajib: true,
        bantuan: 'Menentukan kolom di Rekap. Operasional usaha ikut dihitung sebagai biaya produksi.'}]}
  };
}

// Kolom (judul) yang dibaca untuk setiap data induk, tanpa perlu membaca Sheet.
var KOLOM_MASTER = {
  'Alat Suling': [['Nama alat', 'teks'], ['Catatan', 'teks']],
  'Karyawan': [['Nama', 'teks'], ['Tim', 'teks'], ['Alat', 'teks'], ['No HP', 'teks'], ['Catatan', 'teks']],
  'Tarif Upah': [['Pilihan', 'teks'], ['Untuk', 'teks'], ['Upah (Rp)', 'rupiah'], ['Jenis kerja', 'teks'], ['Jumlah sulingan', 'angka']],
  'Produk': [['Produk', 'teks'], ['Satuan', 'teks'], ['Dihitung sebagai minyak', 'teks'], ['Harga biasa (Rp)', 'rupiah']],
  'Kategori Kas': [['Kategori', 'teks'], ['Arah', 'teks'], ['Kelompok', 'teks']]
};
var UTAMA_MASTER = {'Alat Suling': 'Nama alat', 'Karyawan': 'Nama', 'Tarif Upah': 'Pilihan', 'Pilihan': 'Pilihan', 'Produk': 'Produk',
  'Kategori Kas': 'Kategori'};

function nilaiMaster_(jenis, v) {
  if (jenis === 'rupiah' || jenis === 'angka' || jenis === 'desimal') {
    if (typeof v === 'number') return v;
    var s = teks_(v);
    return s === '' || s === '-' ? '' : angka_(s);
  }
  if (jenis === 'tanggal') return tglKunci_(v);
  if (adalahTanggal_(v)) return tglIso_(v);
  return teks_(v);
}

// Semua baris satu data induk: [{id, nilai, aktif, baris}] sesuai urutan di Sheet.
function bacaMaster_(ss, tab) {
  var src = SUMBER_MASTER[tab];
  var sh = ss.getSheetByName(src.sheet || SH_DAFTAR);
  if (!sh) return [];
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var kepala = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(teks_);
  var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];

  if (src.daftar) {
    DAFTAR_PILIHAN.forEach(function (d) {
      var j = kepala.indexOf(d);
      if (j < 0) return;
      for (var i = 0; i < data.length; i++) {
        var v = teks_(data[i][j]);
        if (v) out.push({id: d + '|' + v, nilai: {'Daftar': d, 'Pilihan': v}, aktif: true, baris: i + 2, kolom: j + 1});
      }
    });
    return out;
  }

  if (src.blok) {
    var idx = src.blok.map(function (p) { return kepala.indexOf(p[1]); });
    if (idx[0] < 0) return [];
    for (var b = 0; b < data.length; b++) {
      var u = teks_(data[b][idx[0]]);
      if (!u) continue;
      var nb = {};
      KOLOM_MASTER[tab].forEach(function (c, k) { nb[c[0]] = idx[k] >= 0 ? nilaiMaster_(c[1], data[b][idx[k]]) : ''; });
      out.push({id: u, nilai: nb, aktif: true, baris: b + 2});
    }
    return out;
  }

  var utama = UTAMA_MASTER[tab];
  var iUtama = kepala.indexOf(utama), iAktif = kepala.indexOf('Aktif'), iKeluar = kepala.indexOf('Tanggal keluar');
  if (iUtama < 0) return [];
  for (var r = 0; r < data.length; r++) {
    var v2 = teks_(data[r][iUtama]);
    if (!v2) { if (src.berhentiDiKosong) break; continue; }
    var n = {};
    KOLOM_MASTER[tab].forEach(function (c) { var j = kepala.indexOf(c[0]); n[c[0]] = j >= 0 ? nilaiMaster_(c[1], data[r][j]) : ''; });
    if (tab === 'Karyawan') n['Tanggal keluar'] = iKeluar >= 0 ? tglKunci_(data[r][iKeluar]) : '';
    out.push({id: v2, nilai: n, aktif: iAktif >= 0 ? ya_(data[r][iAktif]) : true, baris: r + 2});
  }
  return out;
}

function skemaMaster_(defs) {
  var out = {};
  URUTAN_MASTER.forEach(function (t) {
    var d = defs[t];
    out[t] = {kunci: d.kunci, judul: d.judul, utama: d.utama, kelompok: d.kelompok || '', keluar: !!d.keluar, hapus: !!d.hapus, kolom: d.kolom};
  });
  return out;
}

function masterAkses_(akses) { return akses.admin ? '' : 'Hanya pemilik atau pengguna yang boleh mengatur.'; }

// Indeks kolom (1-based) berjudul nama. Kalau belum ada, dibuat di kolom kosong pertama di kanan.
function pastikanKolom_(sh, nama, coba) {
  var kepala = kepalaSheet_(sh);
  var j = kepala.indexOf(nama);
  if (j >= 0) return j + 1;
  var kolom = 0;
  (coba || []).forEach(function (c) { if (!kolom && !teks_(kepala[c - 1])) kolom = c; });
  if (!kolom) kolom = kepala.length + 1;
  if (kolom > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), kolom - sh.getMaxColumns());
  sh.getRange(1, kolom).setValue(nama);
  return kolom;
}

function pastikanBaris_(sh, baris) {
  if (baris > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), baris - sh.getMaxRows() + 20);
}

function nilaiKeSheet_(jenis, v) {
  if (jenis === 'rupiah' || jenis === 'angka' || jenis === 'desimal') return v === '' || v === null || v === undefined ? 0 : Number(v) || 0;
  if (jenis === 'tanggal') return v ? tglDariIso_(tglKunci_(v)) : '';
  return v === null || v === undefined ? '' : v;
}

function masterSimpan_(ss, akses, req) {
  var larang = masterAkses_(akses);
  if (larang) return {ok: false, galat: larang};
  var tab = teks_(req.tab);
  if (!SUMBER_MASTER[tab]) return {ok: false, galat: 'Data tidak dikenal.'};
  return denganKunci_(function () {
    var def = definisiMaster_(ss)[tab];
    var nilai = {};
    for (var i = 0; i < def.kolom.length; i++) {
      var c = def.kolom[i];
      var v = req.nilai ? req.nilai[c.h] : '';
      if (v === undefined || v === null) v = '';
      if (c.j === 'rupiah' || c.j === 'desimal' || c.j === 'angka') v = v === '' ? '' : angka_(v);
      else v = teks_(v);
      if (c.wajib && v === '') return {ok: false, galat: c.h + ' wajib diisi.'};
      if (c.opsi && !c.lainnya && v !== '' && c.opsi.indexOf(v) < 0) return {ok: false, galat: c.h + ' tidak dikenal: ' + v};
      if (c.j === 'angka' && v !== '' && (v < 0 || Math.floor(v) !== v)) return {ok: false, galat: c.h + ' harus angka bulat.'};
      if ((c.j === 'rupiah') && v !== '' && v < 0) return {ok: false, galat: c.h + ' tidak boleh minus.'};
      if (typeof v === 'string' && v.length > 80) return {ok: false, galat: c.h + ' terlalu panjang.'};
      nilai[c.h] = v;
    }
    var utama = def.utama;
    if (/[,\[\]|*?~]/.test(nilai[utama])) return {ok: false, galat: utama + ' tidak boleh berisi koma, kurung siku, atau tanda | * ? ~.'};
    if (tab === 'Karyawan' && /[,\[\]|]/.test(nilai['Tim'])) return {ok: false, galat: 'Nama tim tidak boleh berisi koma.'};
    var semua = bacaMaster_(ss, tab);
    if (tab === 'Karyawan' && nilai['Alat'] && !bacaAlat_(ss).some(function (a) { return a.nama === nilai['Alat']; })) {
      return {ok: false, galat: 'Alat ' + nilai['Alat'] + ' tidak dikenal.'};
    }
    var id = teks_(req.id);
    var lama = id ? semua.filter(function (m) { return m.id === id; })[0] : null;
    if (id && !lama) return {ok: false, galat: 'Data ini sudah berubah. Muat ulang.'};
    var kembar = semua.filter(function (m) {
      return m !== lama && normalNama_(m.nilai[utama]) === normalNama_(nilai[utama]) &&
        (!def.kelompok || m.nilai[def.kelompok] === nilai[def.kelompok]);
    })[0];
    if (kembar) return {ok: false, galat: '"' + nilai[utama] + '" sudah ada' + (kembar.aktif ? '' : ' (tidak aktif, bisa diaktifkan lagi)') + '.'};

    if (lama) {
      tulisMaster_(ss, tab, lama, nilai);
      var namaLama = lama.nilai[utama], namaBaru = nilai[utama];
      var ganti = namaLama !== namaBaru ? gantiNamaDiCatatan_(ss, tab, namaLama, namaBaru) : 0;
      catatLog_(ss, 'Ubah data induk', tab, lama.baris, JSON.stringify(lama.nilai), JSON.stringify(nilai), akses.pengguna);
      return {ok: true, id: tab === 'Pilihan' ? nilai['Daftar'] + '|' + namaBaru : namaBaru, catatanDiganti: ganti};
    }
    tambahMaster_(ss, tab, nilai, semua);
    catatLog_(ss, 'Tambah data induk', tab, '', '', JSON.stringify(nilai), akses.pengguna);
    return {ok: true, id: tab === 'Pilihan' ? nilai['Daftar'] + '|' + nilai[utama] : nilai[utama]};
  });
}

function jenisKolomMaster_(tab, h) {
  var c = (KOLOM_MASTER[tab] || []).filter(function (x) { return x[0] === h; })[0];
  return c ? c[1] : 'teks';
}

function tulisMaster_(ss, tab, lama, nilai) {
  var src = SUMBER_MASTER[tab];
  if (src.daftar) {
    var sh = ss.getSheetByName(SH_DAFTAR);
    if (lama.nilai['Daftar'] === nilai['Daftar']) { sh.getRange(lama.baris, lama.kolom).setValue(nilai['Pilihan']); return; }
    hapusDariDaftar_(sh, lama);
    tambahMaster_(ss, tab, nilai, bacaMaster_(ss, tab));
    return;
  }
  var s = ss.getSheetByName(src.sheet || SH_DAFTAR);
  Object.keys(nilai).forEach(function (h) {
    var judul = src.blok ? src.blok.filter(function (p) { return p[0] === h; })[0][1] : h;
    var kosong = nilai[h] === '' || nilai[h] === null;
    var kepala = kepalaSheet_(s);
    var j = kepala.indexOf(judul);
    if (j < 0) {
      if (kosong) return;
      j = pastikanKolom_(s, judul, src.blok ? [kolomSetelahBlok_(s, src)] : []) - 1;
    }
    s.getRange(lama.baris, j + 1).setValue(nilaiKeSheet_(jenisKolomMaster_(tab, h), nilai[h]));
  });
}

// Kolom kosong tepat di kanan blok (untuk kolom baru seperti "Harga biasa (Rp)").
function kolomSetelahBlok_(sh, src) {
  var kepala = kepalaSheet_(sh);
  var maks = 0;
  src.blok.forEach(function (p) { var j = kepala.indexOf(p[1]); if (j + 1 > maks) maks = j + 1; });
  return maks + 1;
}

function tambahMaster_(ss, tab, nilai, semua) {
  var src = SUMBER_MASTER[tab];
  if (src.daftar) {
    var sh = ss.getSheetByName(SH_DAFTAR);
    var kolom = pastikanKolom_(sh, nilai['Daftar']);
    var akhir = sh.getLastRow();
    var isi = akhir >= 2 ? sh.getRange(2, kolom, akhir - 1, 1).getValues() : [];
    var baris = 2;
    for (var i = isi.length - 1; i >= 0; i--) { if (teks_(isi[i][0])) { baris = i + 3; break; } }
    pastikanBaris_(sh, baris);
    sh.getRange(baris, kolom).setValue(nilai['Pilihan']);
    return;
  }
  var s = ss.getSheetByName(src.sheet || SH_DAFTAR);
  var kepala = kepalaSheet_(s);
  var barisBaru;
  if (src.blok) {
    var iU = kepala.indexOf(src.blok[0][1]);
    var akhirB = s.getLastRow();
    var kol = akhirB >= 2 ? s.getRange(2, iU + 1, akhirB - 1, 1).getValues() : [];
    barisBaru = 2;
    for (var b = kol.length - 1; b >= 0; b--) { if (teks_(kol[b][0])) { barisBaru = b + 3; break; } }
  } else if (src.berhentiDiKosong) {
    barisBaru = 2 + semua.length;
  } else {
    barisBaru = Math.max(s.getLastRow(), 1) + 1;
  }
  pastikanBaris_(s, barisBaru);
  var tulis = {};
  Object.keys(nilai).forEach(function (h) { tulis[src.blok ? src.blok.filter(function (p) { return p[0] === h; })[0][1] : h] = {h: h, v: nilai[h]}; });
  if (!src.blok) tulis['Aktif'] = {h: 'Aktif', v: 'Ya'};
  Object.keys(tulis).forEach(function (judul) {
    var x = tulis[judul];
    var j = kepala.indexOf(judul);
    if (j < 0) {
      if (x.v === '' || judul === 'Aktif') return;
      j = pastikanKolom_(s, judul, src.blok ? [kolomSetelahBlok_(s, src)] : []) - 1;
      kepala = kepalaSheet_(s);
    }
    s.getRange(barisBaru, j + 1).setValue(nilaiKeSheet_(jenisKolomMaster_(tab, x.h), x.v));
  });
  // Rumus per baris (misalnya kolom F-H di Tarif Upah) disalin dari baris di atasnya.
  if (barisBaru > 2) {
    var lebar = s.getLastColumn();
    var rumus = s.getRange(barisBaru - 1, 1, 1, lebar).getFormulasR1C1()[0];
    rumus.forEach(function (f, j) { if (f && !(kepala[j] in tulis)) s.getRange(barisBaru, j + 1).setFormulaR1C1(f); });
  }
}

function hapusDariDaftar_(sh, m) {
  var akhir = sh.getLastRow();
  if (akhir < 2) return;
  var vals = sh.getRange(2, m.kolom, akhir - 1, 1).getValues().map(function (r) { return r[0]; });
  var sisa = vals.filter(function (v, i) { return i + 2 !== m.baris; }).filter(function (v) { return teks_(v) !== ''; });
  var tulis = vals.map(function (v, i) { return [i < sisa.length ? sisa[i] : '']; });
  sh.getRange(2, m.kolom, tulis.length, 1).setValues(tulis);
}

function blokKolom_(sh, src) {
  var kepala = kepalaSheet_(sh);
  return src.blok.map(function (p) { return kepala.indexOf(p[1]) + 1; }).filter(function (c) { return c > 0; });
}

// Menulis ulang baris-baris data induk sesuai urutan baru (hanya kolom data induk, rumus tidak disentuh).
function tulisUlangUrutan_(sh, kolom, posisi, barisSumber) {
  kolom.forEach(function (c) {
    var nilai = barisSumber.map(function (b) { return sh.getRange(b, c).getValue(); });
    posisi.forEach(function (p, i) { sh.getRange(p, c).setValue(nilai[i]); });
  });
}

function masterAktif_(ss, akses, req) {
  var larang = masterAkses_(akses);
  if (larang) return {ok: false, galat: larang};
  var tab = teks_(req.tab);
  var src = SUMBER_MASTER[tab];
  if (!src) return {ok: false, galat: 'Data tidak dikenal.'};
  return denganKunci_(function () {
    var semua = bacaMaster_(ss, tab);
    var m = semua.filter(function (x) { return x.id === teks_(req.id); })[0];
    if (!m) return {ok: false, galat: 'Data ini sudah berubah. Muat ulang.'};
    var aktif = req.aktif !== false;
    var nama = m.nilai[UTAMA_MASTER[tab]];
    if (src.daftar || src.blok) {
      if (aktif) return {ok: true};
      var sh = ss.getSheetByName(SH_DAFTAR);
      if (src.daftar) {
        hapusDariDaftar_(sh, m);
      } else {
        var kolom = blokKolom_(sh, src);
        var lain = semua.filter(function (x) { return x !== m; });
        var posisi = semua.map(function (x) { return x.baris; });
        tulisUlangUrutan_(sh, kolom, posisi.slice(0, lain.length), lain.map(function (x) { return x.baris; }));
        kolom.forEach(function (c) { sh.getRange(posisi[posisi.length - 1], c).setValue(''); });
      }
      catatLog_(ss, 'Hapus data induk', tab, m.baris, nama, '', akses.pengguna);
      return {ok: true, dihapus: true};
    }
    var s = ss.getSheetByName(src.sheet);
    if (tab === 'Alat Suling' && !aktif && semua.filter(function (x) { return x.aktif && x !== m; }).length === 0) {
      return {ok: false, galat: 'Minimal harus ada satu alat suling yang aktif.'};
    }
    var kAktif = pastikanKolom_(s, 'Aktif', tab === 'Tarif Upah' ? [9] : []);
    s.getRange(m.baris, kAktif).setValue(aktif ? 'Ya' : 'Tidak');
    if (tab === 'Karyawan') {
      var kKeluar = pastikanKolom_(s, 'Tanggal keluar');
      s.getRange(m.baris, kKeluar).setValue(aktif ? '' : tglDariIso_(tglKunci_(req.tanggalKeluar) || hariIniIso_()));
    }
    catatLog_(ss, aktif ? 'Aktifkan' : 'Nonaktifkan', tab, m.baris, '', nama, akses.pengguna);
    return {ok: true};
  });
}

function masterUrut_(ss, akses, req) {
  var larang = masterAkses_(akses);
  if (larang) return {ok: false, galat: larang};
  var tab = teks_(req.tab);
  var src = SUMBER_MASTER[tab];
  if (!src) return {ok: false, galat: 'Data tidak dikenal.'};
  var ids = (req.ids || []).map(String);
  return denganKunci_(function () {
    var semua = bacaMaster_(ss, tab);
    if (src.daftar) {
      var pertama = semua.filter(function (m) { return m.id === ids[0]; })[0];
      if (!pertama) return {ok: true};
      semua = semua.filter(function (m) { return m.kolom === pertama.kolom; });
    }
    var sisa = semua.filter(function (m) { return ids.indexOf(m.id) < 0; });
    var urutan = ids.map(function (id) { return semua.filter(function (m) { return m.id === id; })[0]; })
      .filter(function (m) { return m; }).concat(sisa);
    var posisi = semua.map(function (m) { return m.baris; }).sort(function (a, b) { return a - b; });
    var sh = ss.getSheetByName(src.sheet || SH_DAFTAR);
    var kolom;
    if (src.daftar) kolom = [semua[0].kolom];
    else if (src.blok) kolom = blokKolom_(sh, src);
    else {
      var kepala = kepalaSheet_(sh);
      kolom = KOLOM_MASTER[tab].map(function (c) { return c[0]; }).concat(['Aktif', 'Tanggal keluar'])
        .map(function (h) { return kepala.indexOf(h) + 1; }).filter(function (c) { return c > 0; });
    }
    tulisUlangUrutan_(sh, kolom, posisi, urutan.map(function (m) { return m.baris; }));
    return {ok: true};
  });
}

// Kalau nama karyawan, alat, tarif, produk, atau kategori diganti, catatan lama ikut diganti supaya rekap tetap utuh.
function gantiNamaDiCatatan_(ss, tab, lama, baru) {
  var target = {
    'Karyawan': [[SH_ABSENSI, 'Nama', false], [SH_PRODUKSI, 'Operator', false], ['Ambil Bahan', 'Pengumpul', true]],
    'Alat Suling': [[SH_ABSENSI, 'Alat', false], [SH_PRODUKSI, 'Alat suling', false], [SH_KARYAWAN, 'Alat', false]],
    'Tarif Upah': [[SH_ABSENSI, 'Pekerjaan', false]],
    'Produk': [['Penjualan', 'Produk', false]],
    'Kategori Kas': [['Kas', 'Kategori', false]]
  }[tab] || [];
  var jumlah = 0;
  target.forEach(function (tg) {
    var sh = ss.getSheetByName(tg[0]);
    if (!sh || sh.getLastRow() < 2) return;
    var j = kepalaSheet_(sh).indexOf(tg[1]);
    if (j < 0) return;
    var rg = sh.getRange(2, j + 1, sh.getLastRow() - 1, 1);
    var vals = rg.getValues();
    var berubah = false;
    vals.forEach(function (r) {
      var v = teks_(r[0]);
      if (tg[2]) {
        var bagian = v.split(',').map(function (x) { return x.trim(); });
        if (bagian.indexOf(lama) >= 0) {
          r[0] = bagian.map(function (x) { return x === lama ? baru : x; }).join(', ');
          berubah = true; if (tg[0] !== SH_KARYAWAN) jumlah++;
        }
      } else if (v === lama) {
        r[0] = baru; berubah = true; if (tg[0] !== SH_KARYAWAN) jumlah++;
      }
    });
    if (berubah) rg.setValues(vals);
  });
  return jumlah;
}

// ---------------------------------------------------------------- CONFIG

function config_(ss, akses) {
  var app = bacaAplikasi_(ss);
  var master = {};
  URUTAN_MASTER.forEach(function (t) {
    master[t] = bacaMaster_(ss, t).filter(function (m) { return akses.admin || m.aktif; })
      .map(function (m) {
        // Angka upah hanya untuk pemilik dan pengguna yang boleh mengatur.
        if (t === 'Tarif Upah' && !(akses.pemilik || akses.admin)) m.nilai['Upah (Rp)'] = '';
        return {id: m.id, nilai: m.nilai, aktif: m.aktif};
      });
  });
  return {ok: true, versiApi: API_VERSI, akses: akses, master: master,
    skema: akses.admin ? skemaMaster_(definisiMaster_(ss)) : null,
    pengaturan: {namaUsaha: app.namaUsaha || 'Sembada Karya Wangi', namaAplikasi: app.namaAplikasi || 'Catatan Sembada', awalMinggu: 'Senin'},
    tampilan: jsonAman_(app.tampilanV7 || '{}', {}), logoTanda: tandaLogo_(app.logo || '')};
}

function logo_(ss) {
  var app = bacaAplikasi_(ss);
  return {ok: true, logo: app.logo || '', tanda: tandaLogo_(app.logo || '')};
}

function tampilanSimpan_(ss, akses, req) {
  if (!akses.pemilik) return {ok: false, galat: 'Hanya pemilik yang boleh mengubah tampilan untuk semua.'};
  return denganKunci_(function () {
    var diubah = [];
    if (req.tampilan !== undefined) {
      var teks = JSON.stringify(req.tampilan || {});
      if (teks.length > 40000) return {ok: false, galat: 'Pengaturan tampilan terlalu besar.'};
      simpanAplikasi_(ss, 'tampilanV7', teks, 'Warna, ukuran, dan tata letak aplikasi (diatur dari aplikasi, jangan diubah manual)');
      diubah.push('tampilan');
    }
    if (req.namaAplikasi !== undefined) {
      var nama = teks_(req.namaAplikasi);
      if (nama.length > 40) return {ok: false, galat: 'Nama aplikasi terlalu panjang (maksimal 40 huruf).'};
      simpanAplikasi_(ss, 'namaAplikasi', nama, 'Judul aplikasi');
      diubah.push('nama aplikasi');
    }
    if (req.logo !== undefined && req.logo !== null) {
      var logo = teks_(req.logo);
      if (logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(logo)) return {ok: false, galat: 'Gambar logo tidak valid.'};
      if (logo.length > 45000) return {ok: false, galat: 'Gambar logo terlalu besar.'};
      simpanAplikasi_(ss, 'logo', logo, 'Logo (gambar kecil, diunggah dari aplikasi)');
      diubah.push(logo ? 'logo' : 'logo bawaan');
    }
    catatLog_(ss, 'Ubah tampilan', SH_APLIKASI, '', '', diubah.join(', '), akses.pengguna);
    var app = bacaAplikasi_(ss);
    return {ok: true, logoTanda: tandaLogo_(app.logo || '')};
  });
}

// ---------------------------------------------------------------- SIMPAN CATATAN

function simpan_(ss, akses, req) {
  var tab = teks_(req.tab);
  if (URUTAN_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Catatan tidak dikenal: ' + tab};
  if (akses.tab.indexOf(tab) < 0) return {ok: false, galat: 'Akun ini tidak boleh mengisi ' + tab + '.'};
  var id = teks_(req.id);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var props = PropertiesService.getScriptProperties();
    var ids = [];
    try { ids = JSON.parse(props.getProperty('idMasuk') || '[]'); } catch (e) { ids = []; }
    if (id && ids.indexOf(id) >= 0) return {ok: true, dobel: true};

    var hasil;
    if (tab === 'Absensi') {
      pindahkanAbsensiLama_(ss);
      hasil = simpanAbsensi_(ss, akses, req);
    } else if (tab === 'Produksi Suling') {
      hasil = simpanProduksi_(ss, akses, req, id);
    } else {
      hasil = simpanUmum_(ss, tab, req.nilai || {});
    }
    if (hasil.ok && id) {
      ids.push(id);
      if (ids.length > API_SIMPAN_ID) ids = ids.slice(ids.length - API_SIMPAN_ID);
      while (JSON.stringify(ids).length > 8000) ids.shift();       // batas 9 KB per nilai
      props.setProperty('idMasuk', JSON.stringify(ids));
    }
    if (hasil.ok && !hasil.dobel) catatLog_(ss, 'Tambah', tab, '', '', ringkasIsian_(req), akses.nama);
    return hasil;
  } finally {
    lock.releaseLock();
  }
}

function ringkasIsian_(req) {
  try { return JSON.stringify({nilai: req.nilai || {}, baris: req.baris || undefined}).slice(0, 1500); } catch (e) { return ''; }
}

function simpanUmum_(ss, tab, nilai) {
  var sh = ss.getSheetByName(tab);
  if (!sh) return {ok: false, galat: 'Tab ' + tab + ' tidak ada di Google Sheet.'};
  var info = kolomForm_(sh);
  var kolTgl = info.kepala[1];
  var tgl = teks_(nilai[kolTgl]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return {ok: false, galat: kolTgl + ' wajib diisi.'};
  if (tgl > hariIniIso_()) return {ok: false, galat: 'Tanggal tidak boleh setelah hari ini.'};
  var baris = susunBaris_(info.kepala, nilai, new Date());
  if (baris.asing.length) {
    return {ok: false, galat: 'Kolom tidak ditemukan di tab ' + tab + ': ' + baris.asing.join(', ') +
      '. Buka menu Akun > Perbarui data, lalu kirim ulang.'};
  }
  sh.insertRowBefore(2);
  sh.getRange(2, 2, 1, baris.isi.length).setValues([baris.isi]);
  SpreadsheetApp.flush();
  rapikan_(sh, info.lastCol);
  return {ok: true};
}

function rapikan_(sh, lastCol) {
  if (typeof urutkanTab_ === 'function') {
    urutkanTab_(sh);                             // dari urut_otomatis.gs: urutkan + rapikan format
  } else if (sh.getLastRow() >= 3) {
    sh.getRange(3, 1, 1, lastCol).copyTo(sh.getRange(2, 1, 1, lastCol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
}

// Menyusun satu baris (mulai kolom B) dari isian aplikasi yang dikunci dengan judul kolom.
function susunBaris_(kepala, nilai, sekarang) {
  var isi = [];
  for (var i = 0; i < kepala.length; i++) isi.push('');
  isi[0] = sekarang;                               // Timestamp
  var asing = [];
  Object.keys(nilai).forEach(function (k) {
    var j = kepala.indexOf(k);
    if (j >= 1) isi[j] = ubahNilai_(k, nilai[k]);
    else asing.push(k);
  });
  return {isi: isi, asing: asing};
}

function ubahNilai_(judul, v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Array]') {
    return v.map(function (x) { return String(x).trim(); }).filter(function (x) { return x; }).join(', ');
  }
  if (typeof v === 'number') return isFinite(v) ? v : '';
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return tglDariIso_(s);   // isian tanggal dari aplikasi
  return s;
}

// ---------------------------------------------------------------- ABSENSI (SATU BARIS PER ORANG PER HARI)
//
// Isian aplikasi versi 7: nilai {Tanggal, Keterangan}, baris [{Nama, Pekerjaan, Pekerjaan lain, Upah kerja lain (Rp), Kerja lain untuk}]
// Isian aplikasi versi 2 (antrian lama di HP): nilai {Tanggal, Keterangan, baris: [{nama, pekerjaan, alat, upah, pekerjaanLain, kerjaLainUntuk}]}
// Isian format lama (Google Form): {"Tim [Nama]": pilihan, "Upah kerja lain Nama (Rp)": angka, ...}

function simpanAbsensi_(ss, akses, req) {
  var sh = siapkanSheet_(ss, SH_ABSENSI, KEPALA_ABSENSI);
  var ref = bacaReferensi_(ss);
  var nilai = req.nilai || {};
  var entri;
  if (Array.isArray(nilai.baris)) entri = entriBaru_(nilai);
  else if (Array.isArray(req.baris)) entri = entriV7_(nilai, req.baris, ref);
  else entri = entriLama_(nilai);
  if (!entri.length) return {ok: false, galat: 'Isi minimal satu orang.'};
  var g = periksaEntri_(entri, akses, ref);
  if (g) return {ok: false, galat: g};
  var waktu = new Date();
  return tulisAbsensi_(ss, sh, entri.map(function (e) { return barisAbsensi_(e, ref, akses.nama, waktu); }), {});
}

function entriV7_(nilai, baris, ref) {
  var tgl = teks_(nilai['Tanggal']), ket = teks_(nilai['Keterangan']);
  var tLain = ref.tarif.filter(function (t) { return t.jenis === 'Kerja lain'; })[0];
  var out = [];
  baris.forEach(function (b) {
    var nama = teks_(b['Nama']);
    if (!nama) return;
    var pek = teks_(b['Pekerjaan']);
    if (pek) out.push({tanggal: tgl, nama: nama, pekerjaan: pek, alat: '', upah: 0, keterangan: ket});
    var pl = teks_(b['Pekerjaan lain']), ul = angka_(b['Upah kerja lain (Rp)']);
    if (pl || ul > 0) {
      out.push({tanggal: tgl, nama: nama, pekerjaan: tLain ? tLain.pilihan : 'Kerja lain', alat: '', upah: ul,
        pekerjaanLain: pl, kerjaLainUntuk: teks_(b['Kerja lain untuk']), keterangan: ket});
    }
  });
  if (!out.length && ket) out.push({tanggal: tgl, nama: '', pekerjaan: '', keterangan: ket});
  return out;
}

function entriBaru_(nilai) {
  var tgl = teks_(nilai['Tanggal']), ket = teks_(nilai['Keterangan']);
  var out = (nilai.baris || []).map(function (b) {
    return {tanggal: tgl, nama: teks_(b.nama), pekerjaan: teks_(b.pekerjaan), alat: teks_(b.alat),
      upah: Number(b.upah) || 0, pekerjaanLain: teks_(b.pekerjaanLain), kerjaLainUntuk: teks_(b.kerjaLainUntuk), keterangan: ket};
  }).filter(function (e) { return e.nama && e.pekerjaan; });
  if (!out.length && ket) out.push({tanggal: tgl, nama: '', pekerjaan: '', keterangan: ket});
  return out;
}

function entriLama_(nilai) {
  var tgl = teks_(nilai['Tanggal']), ket = teks_(nilai['Keterangan']);
  var pekLain = teks_(nilai['Pekerjaan lain']), untuk = teks_(nilai['Kerja lain untuk']);
  var out = [], adaUtama = {};
  var upahLain = function (nama) { return Number(nilai['Upah kerja lain ' + nama + ' (Rp)']) || 0; };
  var kerjaLain = function (nama, upah) {
    return {tanggal: tgl, nama: nama, pekerjaan: 'Kerja lain', upah: upah, pekerjaanLain: pekLain, kerjaLainUntuk: untuk, keterangan: ket};
  };
  Object.keys(nilai).forEach(function (h) {
    var m = /^(.+) \[(.+)\]$/.exec(h);
    if (!m) return;
    var nama = m[2].trim(), pek = teks_(nilai[h]);
    if (!pek) return;
    adaUtama[nama] = 1;
    var upah = upahLain(nama);
    if (pek === 'Kerja lain') { out.push(kerjaLain(nama, upah)); return; }
    out.push({tanggal: tgl, nama: nama, pekerjaan: pek, alat: '', keterangan: ket});
    if (upah > 0) out.push(kerjaLain(nama, upah));
  });
  Object.keys(nilai).forEach(function (h) {
    var m = /^Upah kerja lain (.+) \(Rp\)$/.exec(h);
    if (m && !adaUtama[m[1]] && upahLain(m[1]) > 0) out.push(kerjaLain(m[1], upahLain(m[1])));
  });
  if (!out.length && ket) out.push({tanggal: tgl, nama: '', pekerjaan: '', keterangan: ket});
  return out;
}

// Memeriksa isian absensi. sistem = true untuk pemindahan data lama (tanpa cek hak).
function periksaEntri_(entri, akses, ref, sistem) {
  var alatAktif = ref.alat.filter(function (a) { return a.aktif; }).map(function (a) { return a.nama; });
  var sudah = {};
  for (var i = 0; i < entri.length; i++) {
    var e = entri[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.tanggal)) return 'Tanggal tidak valid.';
    if (!sistem && e.tanggal > hariIniIso_()) return 'Tanggal tidak boleh setelah hari ini.';
    if (!e.nama) continue;                                         // hanya keterangan
    var k = ref.karyawan.filter(function (x) { return x.nama === e.nama; })[0];
    if (!k) { if (sistem) continue; return e.nama + ' tidak ada di daftar karyawan.'; }
    if (!sistem && !k.aktif && !(akses && akses.admin)) return e.nama + ' sudah tidak aktif.';
    var t = ref.tarif.filter(function (x) { return x.pilihan === e.pekerjaan; })[0];
    if (!t) { if (sistem) continue; return '"' + e.pekerjaan + '" tidak ada di Tarif Upah.'; }
    if (!sistem && !/^semua$/i.test(t.untuk) && t.untuk !== k.tim) return '"' + e.pekerjaan + '" bukan pilihan untuk ' + k.tim + '.';
    if (t.jenis === 'Kerja lain') {
      if (!(e.upah >= 0)) return 'Upah kerja lain ' + e.nama + ' tidak valid.';
      if (!sistem && !e.pekerjaanLain && !(e.upah > 0)) return 'Tulis pekerjaan lain untuk ' + e.nama + '.';
    }
    if (t.jenis === 'Penyulingan') {
      if (e.alat && ref.alat.length && !ref.alat.some(function (a) { return a.nama === e.alat; })) return 'Alat "' + e.alat + '" tidak dikenal.';
      if (!e.alat) e.alat = (k.alat && alatAktif.indexOf(k.alat) >= 0) ? k.alat : (alatAktif.length === 1 ? alatAktif[0] : '');
    } else {
      e.alat = '';
    }
    var kunci = e.tanggal + '|' + e.nama + '|' + (t.jenis === 'Kerja lain' ? 'lain' : 'utama');
    if (sudah[kunci] && !sistem) return e.nama + ' diisi dua kali.';
    sudah[kunci] = 1;
  }
  return '';
}

function posUpah_(jenis, untuk) {
  if (jenis === 'Pengumpulan') return 'Pengumpulan';
  if (jenis === 'Penyulingan') return 'Penyulingan';
  if (jenis === 'Kerja harian') return 'Harian & lain';
  if (jenis === 'Kerja lain') {
    if (untuk === 'Pengumpulan bahan') return 'Pengumpulan';
    if (untuk === 'Penyulingan') return 'Penyulingan';
    if (untuk === 'Perawatan alat suling') return 'Perawatan alat';
    return 'Harian & lain';
  }
  return '';
}

// Satu baris Absensi Harian mulai kolom B (13 kolom). Upah dikunci saat dicatat.
function barisAbsensi_(e, ref, oleh, waktu) {
  var t = ref.tarif.filter(function (x) { return x.pilihan === e.pekerjaan; })[0];
  var k = ref.karyawan.filter(function (x) { return x.nama === e.nama; })[0];
  var jenis = t ? t.jenis : '';
  var lain = jenis === 'Kerja lain';
  var upah = lain ? (Number(e.upah) || 0) : (t ? t.upah : 0);
  return [waktu, tglDariIso_(e.tanggal), e.nama, k ? k.tim : '', e.pekerjaan || '',
    e.alat || '', e.nama ? (t ? t.sulingan : 0) : 0, e.nama ? upah : 0, e.nama ? posUpah_(jenis, e.kerjaLainUntuk) : '',
    lain ? (e.pekerjaanLain || '') : '', lain ? (e.kerjaLainUntuk || '') : '', e.keterangan || '', oleh];
}

function kunciAbsensi_(r) {
  var tgl = adalahTanggal_(r[1]) ? tglIso_(r[1]) : teks_(r[1]);
  if (!teks_(r[2])) return tgl + '||ket|' + teks_(r[11]);
  return tgl + '|' + teks_(r[2]) + '|' + (teks_(r[4]) === 'Kerja lain' || teks_(r[9]) ? 'lain' : 'utama');
}

// Menulis baris baru. Orang yang sudah tercatat dengan isi sama dilewati; isi berbeda = bentrok.
function tulisAbsensi_(ss, sh, barisBaru, opsi) {
  var akhir = sh.getLastRow();
  var lama = akhir >= 2 ? sh.getRange(2, 2, akhir - 1, 13).getValues() : [];
  var ada = {};
  lama.forEach(function (r) { if (adalahTanggal_(r[1])) ada[kunciAbsensi_(r)] = r; });
  var tulis = [], dobel = 0, bentrok = [];
  barisBaru.forEach(function (r) {
    var k = kunciAbsensi_(r), x = ada[k];
    if (!x) { tulis.push(r); ada[k] = r; return; }
    var sama = teks_(x[4]) === teks_(r[4]) && teks_(x[5]) === teks_(r[5]) && Number(x[7]) === Number(r[7]) &&
      teks_(x[9]) === teks_(r[9]);
    if (sama) { dobel++; return; }
    bentrok.push(r[2] + ' sudah tercatat "' + x[4] + (teks_(x[4]) === 'Kerja lain' ? ' ' + rpTeks_(x[7]) : '') + '"' +
      (teks_(x[5]) && teks_(x[5]) !== teks_(r[5]) ? ' di ' + x[5] : ''));
  });
  if (bentrok.length && !opsi.lewatiBentrok) {
    return {ok: false, kode: 'SUDAH', galat: 'Absensi ' + tglIndo_(tglIso_(barisBaru[0][1])) + ': ' + bentrok.join('; ') +
      '. Kalau salah, ubah lewat Riwayat.'};
  }
  if (!tulis.length) return {ok: true, dobel: true, ditambah: 0, bentrok: bentrok};
  sh.insertRowsBefore(2, tulis.length);
  sh.getRange(2, 2, tulis.length, 13).setValues(tulis);
  SpreadsheetApp.flush();
  rapikan_(sh, KEPALA_ABSENSI.length);
  return {ok: true, ditambah: tulis.length, dobel: dobel > 0 ? dobel : undefined, bentrok: bentrok};
}

// Isian baru di tab Absensi lama (format satu baris per hari, dari Google Form) dipindahkan ke Absensi Harian.
function pindahkanAbsensiLama_(ss) {
  var lama = ss.getSheetByName(SH_ABSENSI_LAMA), baru = ss.getSheetByName(SH_ABSENSI);
  if (!lama || !baru) return 0;
  var info = kolomForm_(lama);
  if (!info.kepala.some(function (h) { return /^(.+) \[(.+)\]$/.test(h); })) return 0;
  var akhir = lama.getLastRow();
  if (akhir < 2) return 0;
  // Disimpan sebagai teks "ms 1792539290290" supaya tidak diubah format angka oleh Sheet.
  var batas = Number(String(bacaAplikasi_(ss).absensiLamaSampai || '').replace(/[^0-9]/g, '')) || 0;
  var data = lama.getRange(2, 2, akhir - 1, info.kepala.length).getValues();
  var calon = data.filter(function (r) { return adalahTanggal_(r[0]) && r[0].getTime() > batas && adalahTanggal_(r[1]); });
  if (!calon.length) return 0;
  var ref = bacaReferensi_(ss);
  var semua = [], maks = batas;
  calon.forEach(function (r) {
    var nilai = {};
    info.kepala.forEach(function (h, j) { if (j >= 1) nilai[h] = adalahTanggal_(r[j]) ? tglIso_(r[j]) : r[j]; });
    var en = entriLama_(nilai);
    periksaEntri_(en, null, ref, true);
    en.forEach(function (e) { semua.push(barisAbsensi_(e, ref, 'Absensi lama', r[0])); });
    maks = Math.max(maks, r[0].getTime());
  });
  var hasil = semua.length ? tulisAbsensi_(ss, baru, semua, {lewatiBentrok: true}) : {ditambah: 0, bentrok: []};
  if (hasil.bentrok && hasil.bentrok.length) {
    catatLog_(ss, 'Bentrok absensi lama', SH_ABSENSI_LAMA, '', hasil.bentrok.join('; '), 'tidak dipindahkan', 'Sistem');
  }
  simpanAplikasi_(ss, 'absensiLamaSampai', 'ms ' + maks, 'Batas waktu isian tab Absensi lama yang sudah dipindahkan (otomatis, jangan diubah)');
  return hasil.ditambah || 0;
}

function cobaPindahkanAbsensiLama_(ss) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try { pindahkanAbsensiLama_(ss); } catch (e) { /* tidak boleh menggagalkan permintaan */ } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- PRODUKSI SULING (SATU BARIS PER ALAT PER HARI)

function siapkanProduksi_(ss) {
  var sh = ss.getSheetByName(SH_PRODUKSI);
  if (sh) return sh;
  var ab = ss.getSheetByName('Ambil Bahan');
  sh = ss.insertSheet(SH_PRODUKSI, ab ? ab.getIndex() : 0);
  sh.getRange(1, 1).setFormula('=ARRAYFORMULA(IF(ROW(C:C)=1,"Hari",IF(LEN(C:C),IFERROR(CHOOSE(WEEKDAY(C:C,2),' +
    '"Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"),""),)))');
  sh.getRange(1, 2, 1, KEPALA_PRODUKSI.length - 1).setValues([KEPALA_PRODUKSI.slice(1)]);
  sh.setFrozenRows(1);
  var contoh = ss.getSheetByName(SH_ABSENSI);
  if (contoh) contoh.getRange(1, 1, 1, KEPALA_PRODUKSI.length).copyTo(sh.getRange(1, 1, 1, KEPALA_PRODUKSI.length), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  return sh;
}

function rapikanProduksi_(sh) {
  var akhir = sh.getLastRow();
  if (akhir < 2) return;
  if (akhir >= 3) sh.getRange(2, 2, akhir - 1, 11).sort([{column: 3, ascending: false}, {column: 2, ascending: false}]);
  var n = akhir - 1;
  var f = ['dd/MM/yyyy HH:mm', 'dd/MM/yyyy', '@', '@', '0', '@', '@', '"Rp"#,##0', '@', '@', '@'];
  f.forEach(function (x, j) { sh.getRange(2, 2 + j, n, 1).setNumberFormat(x); });
  sh.getRange(2, 1, n, 12).setFontWeight('normal');
}

function bacaProduksi_(ss) {
  var sh = ss.getSheetByName(SH_PRODUKSI);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 2, sh.getLastRow() - 1, 11).getValues().map(function (r, i) {
    return {baris: i + 2, waktu: r[0], tgl: tglKunci_(r[1]), alat: teks_(r[2]), operator: teks_(r[3]), n: angka_(r[4]),
      kondisi: teks_(r[5]), ket: teks_(r[6]), upah: angka_(r[7]), oleh: teks_(r[8]), id: teks_(r[9]), idIsian: teks_(r[10])};
  }).filter(function (x) { return x.tgl; });
}

// Memeriksa satu baris produksi. Hasil: pesan salah, atau '' kalau benar.
function periksaProduksi_(ref, alat, n, op) {
  if (!alat) return 'Pilih alat suling.';
  if (!ref.alat.some(function (a) { return a.nama === alat; })) return 'Alat "' + alat + '" tidak dikenal.';
  if (!(n >= 0) || Math.floor(n) !== n || n > 50) return 'Jumlah sulingan ' + alat + ' tidak valid.';
  if (n > 0 && !op) return 'Pilih operator ' + alat + '.';
  if (op && !ref.karyawan.some(function (k) { return k.nama === op; })) return 'Operator "' + op + '" tidak ada di daftar karyawan.';
  return '';
}

function simpanProduksi_(ss, akses, req, id) {
  var nilai = req.nilai || {};
  var tgl = teks_(nilai['Tanggal']), ket = teks_(nilai['Keterangan']);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return {ok: false, galat: 'Tanggal wajib diisi.'};
  if (tgl > hariIniIso_()) return {ok: false, galat: 'Tanggal tidak boleh setelah hari ini.'};
  var baris = Array.isArray(req.baris) ? req.baris : [];
  if (!baris.length) return {ok: false, galat: 'Isi minimal satu alat suling.'};
  var ref = bacaReferensi_(ss);
  var sh = siapkanProduksi_(ss);
  var waktu = new Date(), idIsian = id || idBaru_();
  var rows = [], dalam = {};
  for (var i = 0; i < baris.length; i++) {
    var b = baris[i];
    var alat = teks_(b['Alat suling']), op = teks_(b['Operator']);
    var n = b['Jumlah sulingan'] === '' || b['Jumlah sulingan'] === undefined ? NaN : angka_(b['Jumlah sulingan']);
    var g = periksaProduksi_(ref, alat, n, op);
    if (g) return {ok: false, galat: g};
    if (dalam[alat]) return {ok: false, galat: alat + ' tertulis dua kali.'};
    dalam[alat] = true;
    rows.push([waktu, tglDariIso_(tgl), alat, op, n, teks_(b['Kondisi alat']), ket, upahProduksi_(ref, op, n), akses.nama,
      idIsian + '-' + (i + 1), idIsian]);
  }
  var peta = {};
  bacaProduksi_(ss).forEach(function (x) { peta[x.tgl + '|' + x.alat] = x; });
  var tulis = [], bentrok = [];
  rows.forEach(function (r) {
    var x = peta[tgl + '|' + r[2]];
    if (!x) { tulis.push(r); return; }
    if (x.n === r[4] && x.operator === r[3]) return;
    bentrok.push(r[2] + ' sudah tercatat ' + x.n + ' sulingan' + (x.operator ? ' (' + x.operator + ')' : ''));
  });
  if (bentrok.length) return {ok: false, kode: 'SUDAH', galat: 'Produksi Suling ' + tglIndo_(tgl) + ': ' + bentrok.join('; ') + '. Kalau salah, ubah lewat Riwayat.'};
  if (!tulis.length) return {ok: true, dobel: true};
  sh.insertRowsBefore(2, tulis.length);
  sh.getRange(2, 2, tulis.length, 11).setValues(tulis);
  SpreadsheetApp.flush();
  rapikanProduksi_(sh);
  return {ok: true, baris: tulis.length};
}

// ---------------------------------------------------------------- RIWAYAT

function nilaiUntukAplikasi_(h, v) {
  if (adalahTanggal_(v)) {
    if (h === 'Timestamp') return Utilities.formatDate(v, API_ZONA, 'dd/MM/yyyy HH:mm');
    return tglIso_(v);
  }
  return v === null || v === undefined ? '' : v;
}

function sheetTab_(ss, tab) { return ss.getSheetByName(namaSheet_(tab)); }

function terbaru_(ss, akses, req) {
  var tab = teks_(req.tab);
  if (URUTAN_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Catatan tidak dikenal.'};
  if (akses.tab.indexOf(tab) < 0 && !akses.admin) return {ok: false, galat: 'Akun ini tidak boleh melihat ' + tab + '.'};
  if (tab === 'Absensi') cobaPindahkanAbsensiLama_(ss);
  var n = Math.max(1, Math.min(Number(req.n) || 20, 300));
  var sh = sheetTab_(ss, tab);
  if (!sh || sh.getLastRow() < 2) return {ok: true, tab: tab, kepala: sh ? kepalaSheet_(sh) : [], total: 0, data: []};
  var lastCol = sh.getLastColumn();
  var kepala = kepalaSheet_(sh);
  var semua = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
  var nIsi = tab === 'Produksi Suling' ? 0 : kolomForm_(sh).kepala.length;
  var iId = kepala.indexOf('ID');
  var data = [];
  semua.forEach(function (r, i) {
    if (teks_(r[1]) === '' && teks_(r[2]) === '') return;
    data.push({r: r, urut: i, tgl: tglKunci_(r[2])});
  });
  data.sort(function (a, b) { return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : a.urut - b.urut; });
  var rahasia = (akses.pemilik || akses.admin) ? [] : ['Upah (Rp)', 'Pos upah'];
  var hasil = data.slice(0, n).map(function (d) {
    var nilai = {};
    kepala.forEach(function (h, j) { if (h && rahasia.indexOf(h) < 0) nilai[h] = nilaiUntukAplikasi_(h, d.r[j]); });
    var id = tab === 'Produksi Suling' ? teks_(d.r[iId]) : 'r' + (d.urut + 2) + '|' + tandaBaris_(d.r.slice(1, 1 + nIsi));
    return {id: id, nilai: nilai};
  });
  return {ok: true, tab: tab, kepala: kepala.filter(function (h) { return rahasia.indexOf(h) < 0; }), total: data.length, data: hasil};
}

// ---------------------------------------------------------------- UBAH & HAPUS CATATAN

function pecahId_(id) {
  var m = /^r(\d+)\|(.+)$/.exec(teks_(id));
  return m ? {nomor: Number(m[1]), tanda: m[2]} : {nomor: 0, tanda: ''};
}

function cariBarisId_(sh, id) {
  if (!id) return 0;
  var j = kepalaSheet_(sh).indexOf('ID');
  if (j < 0 || sh.getLastRow() < 2) return 0;
  var ids = sh.getRange(2, j + 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (teks_(ids[i][0]) === id) return i + 2;
  return 0;
}

function ubah_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mengubah catatan.'};
  var tab = teks_(req.tab);
  if (URUTAN_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Catatan tidak dikenal.'};
  var nilai = req.nilai || {};
  return denganKunci_(function () {
    if (tab === 'Produksi Suling') return ubahProduksi_(ss, akses, req);
    var sh = sheetTab_(ss, tab);
    var info = kolomForm_(sh);
    var p = pecahId_(req.id);
    var r = cariBaris_(sh, info, p.nomor, p.tanda);
    if (!r) return {ok: false, kode: 'BERUBAH', galat: 'Catatan ini sudah berubah atau terhapus. Muat ulang Riwayat, lalu coba lagi.'};
    var lama = sh.getRange(r, 2, 1, info.kepala.length).getValues()[0];
    var baru;
    if (tab === 'Absensi') {
      var hasil = ubahAbsensi_(ss, akses, sh, r, lama, nilai);
      if (!hasil.ok) return hasil;
      baru = hasil.baris;
    } else {
      baru = lama.slice();
      var asing = [];
      Object.keys(nilai).forEach(function (k) {
        var j = info.kepala.indexOf(k);
        if (j >= 1) baru[j] = ubahNilai_(k, nilai[k]);
        else asing.push(k);
      });
      if (asing.length) return {ok: false, galat: 'Kolom tidak ditemukan di tab ' + tab + ': ' + asing.join(', ') + '.'};
      var kolTgl = info.kepala[1];
      if (nilai[kolTgl] !== undefined && !adalahTanggal_(baru[1])) return {ok: false, galat: kolTgl + ' wajib diisi.'};
    }
    sh.getRange(r, 2, 1, baru.length).setValues([baru]);
    SpreadsheetApp.flush();
    if (typeof urutkanTab_ === 'function') urutkanTab_(sh);
    catatLog_(ss, 'Ubah', tab, r, JSON.stringify(nilaiMentah_(info.kepala, lama)), JSON.stringify(nilaiMentah_(info.kepala, baru)), akses.nama);
    return {ok: true};
  });
}

// Mengubah satu baris absensi: upah, pos, dan sulingan dihitung ulang dari Tarif Upah.
function ubahAbsensi_(ss, akses, sh, r, lama, nilai) {
  var ref = bacaReferensi_(ss);
  var e = {tanggal: teks_(nilai['Tanggal']), nama: teks_(nilai['Nama']), pekerjaan: teks_(nilai['Pekerjaan']),
    alat: teks_(nilai['Alat']), upah: angka_(nilai['Upah (Rp)']), pekerjaanLain: teks_(nilai['Pekerjaan lain']),
    kerjaLainUntuk: teks_(nilai['Kerja lain untuk']), keterangan: teks_(nilai['Keterangan'])};
  if (!e.nama && !e.keterangan) return {ok: false, galat: 'Pilih nama karyawan.'};
  if (e.nama && !e.pekerjaan) return {ok: false, galat: 'Pilih pekerjaan.'};
  var g = periksaEntri_([e], akses, ref);
  if (g) return {ok: false, galat: g};
  var baris = barisAbsensi_(e, ref, teks_(lama[12]) || akses.nama, lama[0]);
  if (teks_(lama[12]).indexOf('diubah') < 0) baris[12] = (teks_(lama[12]) || '?') + ' (diubah ' + akses.nama + ')';
  else baris[12] = teks_(lama[12]);
  // Tidak boleh bentrok dengan baris lain.
  var akhir = sh.getLastRow();
  var semua = sh.getRange(2, 2, akhir - 1, 13).getValues();
  var k = kunciAbsensi_(baris);
  for (var i = 0; i < semua.length; i++) {
    if (i + 2 !== r && adalahTanggal_(semua[i][1]) && kunciAbsensi_(semua[i]) === k) {
      return {ok: false, galat: e.nama + ' sudah punya catatan ' + (k.slice(-4) === 'lain' ? 'kerja lain' : 'absensi') +
        ' lain di tanggal itu. Ubah atau hapus yang itu.'};
    }
  }
  return {ok: true, baris: baris};
}

function ubahProduksi_(ss, akses, req) {
  var sh = ss.getSheetByName(SH_PRODUKSI);
  var r = sh ? cariBarisId_(sh, teks_(req.id)) : 0;
  if (!r) return {ok: false, kode: 'BERUBAH', galat: 'Catatan ini sudah terhapus. Muat ulang Riwayat.'};
  var lama = sh.getRange(r, 2, 1, 11).getValues()[0];
  var nilai = req.nilai || {};
  var ambil = function (h, i) { return nilai[h] !== undefined ? nilai[h] : lama[i]; };
  var tgl = nilai['Tanggal'] !== undefined ? teks_(nilai['Tanggal']) : tglKunci_(lama[1]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return {ok: false, galat: 'Tanggal wajib diisi.'};
  if (tgl > hariIniIso_()) return {ok: false, galat: 'Tanggal tidak boleh setelah hari ini.'};
  var alat = teks_(ambil('Alat suling', 2)), op = teks_(ambil('Operator', 3));
  var nMentah = ambil('Jumlah sulingan', 4);
  var n = nMentah === '' || nMentah === undefined ? NaN : angka_(nMentah);
  var ref = bacaReferensi_(ss);
  var g = periksaProduksi_(ref, alat, n, op);
  if (g) return {ok: false, galat: g};
  var kembar = bacaProduksi_(ss).some(function (x) { return x.baris !== r && x.tgl === tgl && x.alat === alat; });
  if (kembar) return {ok: false, galat: alat + ' sudah punya catatan lain di tanggal ' + tglIndo_(tgl) + '.'};
  var upah = (n !== angka_(lama[4]) || op !== teks_(lama[3]) || alat !== teks_(lama[2])) ? upahProduksi_(ref, op, n) : angka_(lama[7]);
  var oleh = teks_(lama[8]);
  if (oleh.indexOf('diubah') < 0) oleh = (oleh || '?') + ' (diubah ' + akses.nama + ')';
  var baru = [lama[0], tglDariIso_(tgl), alat, op, n, teks_(ambil('Kondisi alat', 5)), teks_(ambil('Keterangan', 6)), upah, oleh, lama[9], lama[10]];
  sh.getRange(r, 2, 1, 11).setValues([baru]);
  SpreadsheetApp.flush();
  rapikanProduksi_(sh);
  catatLog_(ss, 'Ubah', SH_PRODUKSI, r, JSON.stringify(nilaiMentah_(KEPALA_PRODUKSI.slice(1), lama)),
    JSON.stringify(nilaiMentah_(KEPALA_PRODUKSI.slice(1), baru)), akses.nama);
  return {ok: true};
}

function hapus_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa menghapus catatan.'};
  var tab = teks_(req.tab);
  if (URUTAN_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Catatan tidak dikenal.'};
  return denganKunci_(function () {
    var sh = sheetTab_(ss, tab);
    if (!sh) return {ok: false, kode: 'BERUBAH', galat: 'Catatan ini sudah terhapus. Muat ulang Riwayat.'};
    var r, kepala;
    if (tab === 'Produksi Suling') {
      r = cariBarisId_(sh, teks_(req.id));
      kepala = KEPALA_PRODUKSI.slice(1);
    } else {
      var info = kolomForm_(sh);
      var p = pecahId_(req.id);
      r = cariBaris_(sh, info, p.nomor, p.tanda);
      kepala = info.kepala;
    }
    if (!r) return {ok: false, kode: 'BERUBAH', galat: 'Catatan ini sudah berubah atau terhapus. Muat ulang Riwayat, lalu coba lagi.'};
    var lama = sh.getRange(r, 2, 1, kepala.length).getValues()[0];
    sh.deleteRow(r);
    catatLog_(ss, 'Hapus', tab, r, JSON.stringify(nilaiMentah_(kepala, lama)), '', akses.nama);
    return {ok: true};
  });
}

// Mencari baris yang isinya sama persis dengan saat dilihat di aplikasi.
// Nomor baris bisa bergeser karena ada catatan baru, jadi dicocokkan lewat "tanda" isinya.
function cariBaris_(sh, info, nomor, tanda) {
  if (!tanda) return 0;
  var n = info.kepala.length;
  var akhir = sh.getLastRow();
  if (nomor >= 2 && nomor <= akhir && tandaBaris_(sh.getRange(nomor, 2, 1, n).getValues()[0]) === tanda) return nomor;
  if (akhir < 2) return 0;
  var semua = sh.getRange(2, 2, akhir - 1, n).getValues();
  for (var i = 0; i < semua.length; i++) {
    if (tandaBaris_(semua[i]) === tanda) return i + 2;
  }
  return 0;
}

function tandaBaris_(nilai) {
  var teks = JSON.stringify(nilai.map(function (v) { return adalahTanggal_(v) ? 'D' + v.getTime() : v; }));
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, teks, Utilities.Charset.UTF_8));
}

// Nilai baris (mulai kolom B) untuk Log: tanggal jadi teks, angka tetap angka.
function nilaiMentah_(kepala, nilai) {
  var out = {};
  for (var j = 0; j < kepala.length; j++) {
    var v = nilai[j];
    if (adalahTanggal_(v)) {
      var hanyaTgl = /^Tanggal/.test(kepala[j]) || (kepala[j] !== 'Timestamp' && Utilities.formatDate(v, API_ZONA, 'HH:mm') === '00:00');
      v = hanyaTgl ? Utilities.formatDate(v, API_ZONA, 'yyyy-MM-dd') : Utilities.formatDate(v, API_ZONA, 'dd/MM/yyyy HH:mm');
    }
    if (kepala[j]) out[kepala[j]] = v;
  }
  return out;
}

// ---------------------------------------------------------------- RINGKASAN
// Angka minggu dan bulan dibaca dari tab Rekap Mingguan dan Rekap Bulanan (sama persis dengan Dashboard).
// Upah per orang, per alat, dan penjualan belum lunas dihitung dari tab catatan.

function tambahHari_(k, n) {
  var d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) + n * 86400000);
  return d.toISOString().slice(0, 10);
}
function seninDari_(k) {
  var hari = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10))).getUTCDay();
  return tambahHari_(k, -((hari + 6) % 7));
}

function angkaRekap_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  return teks_(v) === '' ? null : angka_(v);
}

function ringkasan_(ss, akses) {
  if (!akses.admin) return {ok: false, galat: 'Ringkasan hanya untuk pemilik atau pengguna yang boleh mengatur.'};
  cobaPindahkanAbsensiLama_(ss);
  SpreadsheetApp.flush();
  var hariIni = hariIniIso_();
  var dash = ss.getSheetByName('Dashboard');
  var dataSampai = dash ? tglKunci_(dash.getRange('B2').getValue()) : '';
  var batas = dataSampai && dataSampai > hariIni ? dataSampai : hariIni;
  var a = angkaRekap_;

  var minggu = [];
  var rek = ss.getSheetByName('Rekap Mingguan');
  if (rek && rek.getLastRow() >= 5) {
    rek.getRange(5, 1, rek.getLastRow() - 4, 22).getValues().forEach(function (v) {
      var mulai = tglKunci_(v[0]);
      if (!mulai || mulai > batas) return;
      minggu.push({mulai: mulai, sampai: tglKunci_(v[1]) || tambahHari_(mulai, 6), trip: a(v[2]), bahanKg: a(v[3]), beliBahan: a(v[4]),
        hargaBahan: a(v[5]), biayaJalan: a(v[6]), sulingan: a(v[7]), hariKosong: a(v[8]), sulinganDisaring: a(v[9]), minyak: a(v[10]),
        minyakPerSulingan: a(v[11]), rendemen: a(v[12]), upahPengumpul: a(v[13]), upahPenyuling: a(v[14]), operasional: a(v[15]),
        biayaProduksi: a(v[16]), biayaPerKg: a(v[17]), terjualKg: a(v[18]), penjualan: a(v[19]), laba: a(v[20]), upahHarian: a(v[21])});
    });
  }
  minggu.reverse();
  minggu = minggu.slice(0, 26);
  minggu.forEach(function (m) { m.totalUpah = (m.upahPengumpul || 0) + (m.upahPenyuling || 0) + (m.upahHarian || 0); });
  rincianMinggu_(ss, minggu);
  keteranganMinggu_(ss, minggu);

  var bulan = [];
  var rb = ss.getSheetByName('Rekap Bulanan');
  if (rb && rb.getLastRow() >= 5) {
    rb.getRange(5, 1, rb.getLastRow() - 4, 31).getValues().forEach(function (v) {
      var mulai = tglKunci_(v[0]);
      if (!mulai || mulai > batas) return;
      var b = {bulan: mulai.slice(0, 7), trip: a(v[2]), bahanKg: a(v[3]), beliBahan: a(v[4]), hargaBahan: a(v[5]), biayaJalan: a(v[6]),
        sulingan: a(v[7]), hariKosong: a(v[8]), sulinganDisaring: a(v[9]), minyak: a(v[10]), minyakPerSulingan: a(v[11]),
        rendemen: a(v[12]), upahPengumpul: a(v[13]), upahPenyuling: a(v[14]), operasional: a(v[15]), biayaProduksi: a(v[16]),
        biayaPerKg: a(v[17]), terjualKg: a(v[18]), penjualan: a(v[19]), laba: a(v[20]), pengembangan: a(v[21]), cicilan: a(v[22]),
        labaSetelahCicilan: a(v[23]), keluarga: a(v[24]), proyekLain: a(v[25]), upahHarian: a(v[26]), pembiayaan: a(v[27]),
        pemasukanLain: a(v[28]), belumDibayar: a(v[29]), perubahanKas: a(v[30])};
      b.totalUpah = (b.upahPengumpul || 0) + (b.upahPenyuling || 0) + (b.upahHarian || 0);
      bulan.push(b);
    });
  }
  bulan.reverse();

  var peringatan = dash ? dash.getRange('A15:F23').getDisplayValues().map(function (r) {
    return {hal: teks_(r[0]), nilai: teks_(r[2]), batas: teks_(r[3]), status: teks_(r[4]), saran: teks_(r[5])};
  }).filter(function (p) { return p.hal; }) : [];

  return {ok: true, hariIni: hariIni, dataSampai: dataSampai, minggu: minggu, bulan: bulan.slice(0, 12), peringatan: peringatan};
}

// Upah per orang, sulingan per alat, dan penjualan belum lunas untuk setiap minggu di daftar.
function rincianMinggu_(ss, minggu) {
  var ref = bacaReferensi_(ss);
  var keMinggu = {};
  minggu.forEach(function (m) { m.orang = []; m.alat = []; m.belumLunas = 0; m._orang = {}; m._alat = {}; m._hari = {}; keMinggu[m.mulai] = m; });
  var cari = function (k) { return k ? keMinggu[seninDari_(k)] || null : null; };
  var jenisTarif = {};
  ref.tarif.forEach(function (t) { jenisTarif[t.pilihan] = t.jenis; });
  var timOrang = {};
  ref.karyawan.forEach(function (k) { timOrang[k.nama] = k.tim; });
  var satuAlat = ref.alat.length === 1 ? ref.alat[0].nama : '';
  var orang = function (m, nama, tim) {
    return m._orang[nama] || (m._orang[nama] = {nama: nama, peran: tim || timOrang[nama] || '', hari: {}, sulingan: 0, upahAbsensi: 0, upahSuling: 0, upahLain: 0});
  };
  var alat = function (m, nama) { return m._alat[nama] || (m._alat[nama] = {sulingan: 0, hari: {}, op: {}}); };

  var ah = ss.getSheetByName(SH_ABSENSI);
  if (ah && ah.getLastRow() >= 2) {
    ah.getRange(2, 3, ah.getLastRow() - 1, 8).getValues().forEach(function (r) {
      var k = tglKunci_(r[0]), m = cari(k);
      if (!m) return;
      m._hari[k] = true;
      var nama = teks_(r[1]);
      if (!nama) return;
      var pek = teks_(r[3]), jenis = jenisTarif[pek] || '', s = angka_(r[5]), upah = angka_(r[6]), pos = teks_(r[7]);
      var o = orang(m, nama, teks_(r[2]));
      if (jenis === 'Kerja lain' || pek === 'Kerja lain') o.upahLain += upah;
      else if (pos === 'Penyulingan' || jenis === 'Penyulingan') { o.upahSuling += upah; o.sulingan += s; }
      else o.upahAbsensi += upah;
      if (jenis ? jenis !== 'Libur' : upah > 0) o.hari[k] = true;
      if (s > 0) {
        var x = alat(m, teks_(r[4]) || satuAlat || '(tanpa alat)');
        x.sulingan += s; x.hari[k] = true; x.op[nama] = (x.op[nama] || 0) + s;
      }
    });
  }
  bacaProduksi_(ss).forEach(function (p) {
    var m = cari(p.tgl);
    if (!m) return;
    m._hari[p.tgl] = true;
    var x = alat(m, p.alat || '(tanpa alat)');
    x.sulingan += p.n;
    if (p.n > 0) x.hari[p.tgl] = true;
    if (p.operator) {
      x.op[p.operator] = (x.op[p.operator] || 0) + p.n;
      var o = orang(m, p.operator);
      o.sulingan += p.n; o.upahSuling += p.upah;
      if (p.n > 0) o.hari[p.tgl] = true;
    }
  });
  var jual = ss.getSheetByName('Penjualan');
  if (jual && jual.getLastRow() >= 2) {
    var kj = kepalaSheet_(jual);
    var iT = kj.indexOf('Tanggal'), iS = kj.indexOf('Status bayar'), iTot = kj.indexOf('Total (Rp)');
    if (iT >= 0 && iS >= 0 && iTot >= 0) {
      jual.getRange(2, 1, jual.getLastRow() - 1, kj.length).getValues().forEach(function (r) {
        var m = cari(tglKunci_(r[iT]));
        var st = teks_(r[iS]);
        if (m && st && st !== 'Lunas') m.belumLunas += angka_(r[iTot]);
      });
    }
  }
  var urutOrang = {};
  ref.karyawan.forEach(function (k, i) { urutOrang[k.nama] = i; });
  var namaAlat = ref.alat.filter(function (x) { return x.aktif; }).map(function (x) { return x.nama; });
  minggu.forEach(function (m) {
    var hariCatat = Object.keys(m._hari).length;
    m.orang = Object.keys(m._orang).map(function (n) {
      var o = m._orang[n];
      return {nama: n, peran: o.peran, hariMasuk: Object.keys(o.hari).length, sulingan: o.sulingan, upahAbsensi: o.upahAbsensi,
        upahSuling: o.upahSuling, upahLain: o.upahLain, total: o.upahAbsensi + o.upahSuling + o.upahLain};
    }).filter(function (o) { return o.total !== 0 || o.hariMasuk > 0; }).sort(function (p, q) {
      var a = urutOrang[p.nama] === undefined ? 999 : urutOrang[p.nama], b = urutOrang[q.nama] === undefined ? 999 : urutOrang[q.nama];
      return a - b || (p.nama < q.nama ? -1 : 1);
    });
    var nama = namaAlat.slice();
    Object.keys(m._alat).forEach(function (n) { if (nama.indexOf(n) < 0) nama.push(n); });
    m.alat = nama.map(function (n) {
      var x = m._alat[n] || {sulingan: 0, hari: {}, op: {}};
      var jalan = Object.keys(x.hari).length;
      var op = Object.keys(x.op).sort(function (p, q) { return x.op[q] - x.op[p]; });
      return {nama: n, operator: op.join(', '), sulingan: x.sulingan, hariJalan: jalan, hariKosong: Math.max(hariCatat - jalan, 0),
        minyakPerSulingan: null};
    });
    delete m._orang; delete m._alat; delete m._hari;
  });
}

// Keterangan dan kejadian tidak biasa per minggu (sama dengan daftar di bagian bawah Dashboard):
// keterangan Ambil Bahan, Produksi Suling, Saring Minyak, Absensi, kerja lain, kondisi alat bukan Normal, dan Penjualan.
function keteranganMinggu_(ss, minggu) {
  var keMinggu = {};
  minggu.forEach(function (m) { m.keterangan = []; m._sudah = {}; keMinggu[m.mulai] = m; });
  var tambah = function (tgl, bagian, isi) {
    isi = teks_(isi);
    var m = tgl && isi ? keMinggu[seninDari_(tgl)] : null;
    if (!m) return;
    var k = tgl + '|' + bagian + '|' + isi;
    if (m._sudah[k]) return;
    m._sudah[k] = true;
    m.keterangan.push({tgl: tgl, bagian: bagian, isi: isi});
  };
  var baca = function (nama, f) {
    var sh = ss.getSheetByName(nama);
    if (!sh || sh.getLastRow() < 2) return;
    var kepala = kepalaSheet_(sh);
    var g = function (r, h) { var j = kepala.indexOf(h); return j >= 0 ? r[j] : ''; };
    sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getValues().forEach(function (r) { f(r, g); });
  };
  baca('Ambil Bahan', function (r, g) { tambah(tglKunci_(g(r, 'Tanggal')), 'Ambil bahan', g(r, 'Keterangan')); });
  baca('Saring Minyak', function (r, g) {
    var t = tglKunci_(g(r, 'Tanggal saring'));
    tambah(t, 'Saring minyak', g(r, 'Keterangan'));
    var k = teks_(g(r, 'Kondisi alat'));
    if (k && k !== 'Normal') tambah(t, 'Kondisi alat', 'Saat saring: ' + k);
  });
  bacaProduksi_(ss).forEach(function (p) {
    tambah(p.tgl, 'Produksi suling', p.ket);
    if (p.kondisi && p.kondisi !== 'Normal') tambah(p.tgl, 'Kondisi alat', p.alat + ': ' + p.kondisi);
  });
  baca(SH_ABSENSI, function (r, g) {
    var t = tglKunci_(g(r, 'Tanggal'));
    tambah(t, 'Absensi', g(r, 'Keterangan'));
    var pl = teks_(g(r, 'Pekerjaan lain'));
    if (pl) {
      var untuk = teks_(g(r, 'Kerja lain untuk'));
      tambah(t, 'Kerja lain', teks_(g(r, 'Nama')) + ': ' + pl + (untuk ? ' (untuk ' + untuk.toLowerCase() + ')' : '') +
        (angka_(g(r, 'Upah (Rp)')) > 0 ? ', upah ' + rpTeks_(angka_(g(r, 'Upah (Rp)'))) : ''));
    }
  });
  baca('Penjualan', function (r, g) {
    var k = teks_(g(r, 'Keterangan'));
    if (k) tambah(tglKunci_(g(r, 'Tanggal')), 'Penjualan', teks_(g(r, 'Pembeli')) + ': ' + k);
  });
  var urutBagian = ['Ambil bahan', 'Produksi suling', 'Kondisi alat', 'Saring minyak', 'Absensi', 'Kerja lain', 'Penjualan'];
  minggu.forEach(function (m) {
    m.keterangan.sort(function (a, b) {
      return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : urutBagian.indexOf(a.bagian) - urutBagian.indexOf(b.bagian);
    });
    m.keterangan = m.keterangan.slice(0, 40);
    delete m._sudah;
  });
}

// ---------------------------------------------------------------- LOG

function catatLog_(ss, aksi, tab, baris, lama, baru, oleh) {
  try {
    var sh = ss.getSheetByName(API_LOG);
    if (!sh) {
      sh = ss.insertSheet(API_LOG);
      sh.getRange(1, 1, 1, 7).setValues([['Waktu', 'Aksi', 'Tab', 'Baris', 'Isi lama', 'Isi baru', 'Oleh']]);
      sh.setFrozenRows(1);
      sh.hideSheet();
    }
    sh.appendRow([new Date(), aksi, tab, baris, lama, baru, oleh]);
  } catch (e) {
    // Log gagal tidak boleh menggagalkan perubahan.
  }
}
