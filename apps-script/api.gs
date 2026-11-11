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
//  - Absensi diisi sekali sehari untuk semua karyawan (tab "Absensi Harian"). Semua upah dari absensi:
//    tim suling memilih 1x, 2x, atau 3x suling, jumlah sulingan dan upahnya ikut tercatat.
//  - Tab "Produksi Suling" (sulingan per alat) tetap dikenali dan ikut dihitung di Rekap, tapi sejak aplikasi 3.3
//    tidak ditampilkan lagi supaya sulingan dan upah tidak tercatat dua kali.
//  - Tab "Laporan Suling" (aplikasi 3.12): laporan harian tim suling (anggota, jumlah suling, kondisi bahan,
//    jam mulai & selesai, kondisi alat, catatan). Tidak ikut dihitung di Rekap: sulingan dan upah tetap dari Absensi.
//    Kalau jumlahnya beda dengan Absensi di tanggal yang sama, muncul di daftar keterangan Ringkasan.
//  - Tab "Data Pembeli" (aplikasi 3.13): kontak pembeli (nama PT/orang, jenis, nama kontak, No HP, email, alamat, website,
//    catatan). Total pembelian dihitung dari tab Penjualan menurut nama pembeli; Penjualan tidak diubah.
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
var SH_LAPORAN = 'Laporan Suling';
var SH_KARYAWAN = 'Karyawan';
var SH_ALAT = 'Alat Suling';
var SH_TARIF = 'Tarif Upah';
var SH_DAFTAR = 'Daftar';
var SH_PIN_LAMA = 'Pengguna';
var SH_AKUN = 'Akun Aplikasi';
var SH_APLIKASI = 'Pengaturan Aplikasi';
var SH_STOK = 'Stok Minyak';
var SH_BON = 'Bon';
var SH_BAYAR_BON = 'Bayar Bon';
var SH_PEMBELI = 'Data Pembeli';
var KEPALA_PEMBELI = ['ID', 'Timestamp', 'Nama', 'Jenis', 'Nama kontak', 'No HP', 'Email', 'Alamat', 'Website', 'Catatan', 'Diubah oleh'];
var JENIS_PEMBELI = ['Perusahaan', 'Perorangan'];

var URUTAN_TAB = ['Ambil Bahan', 'Produksi Suling', 'Laporan Suling', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
// Laporan Suling: Hari (rumus) | isian B..K | Lama nyuling (rumus). Jam disimpan sebagai teks "07:30".
var KEPALA_LAPORAN = ['Hari', 'Timestamp', 'Tanggal', 'Anggota tim', 'Jumlah suling', 'Kondisi bahan', 'Mulai nyuling', 'Selesai nyuling',
  'Kondisi alat', 'Keterangan', 'Diisi oleh', 'Lama nyuling (jam)'];
var KOLOM_JAM = ['Mulai nyuling', 'Selesai nyuling'];
var KEPALA_ABSENSI = ['Hari', 'Timestamp', 'Tanggal', 'Nama', 'Tim', 'Pekerjaan', 'Alat', 'Jumlah sulingan', 'Upah (Rp)',
  'Pos upah', 'Pekerjaan lain', 'Kerja lain untuk', 'Keterangan', 'Diisi oleh'];
var KEPALA_PRODUKSI = ['Hari', 'Timestamp', 'Tanggal', 'Alat suling', 'Operator', 'Jumlah sulingan', 'Kondisi alat', 'Keterangan',
  'Upah (Rp)', 'Diisi oleh', 'ID', 'ID isian'];
var KEPALA_AKUN = ['Nama pengguna', 'Nama', 'Peran', 'Boleh mengisi', 'Boleh mengatur', 'Aktif', 'Wajib ganti sandi',
  'Sandi (terenkripsi)', 'Garam', 'Versi sesi', 'Terakhir masuk'];
var KEPALA_APLIKASI = ['Kunci', 'Nilai', 'Keterangan'];
var KEPALA_STOK = ['Timestamp', 'Tanggal', 'Stok ditimbang (kg)', 'Stok menurut catatan (kg)', 'Selisih (kg)', 'Keterangan', 'Diisi oleh'];
// Catatan bon. Arah: "Orang ngebon" = orang utang ke kita (kasbon karyawan, dll.), "Kita ngebon" = kita utang ke orang/toko.
// Dibayar, Sisa, Status, dan Tanggal lunas dihitung ulang dari tab Bayar Bon setiap ada perubahan.
var KEPALA_BON = ['ID', 'Timestamp', 'Tanggal', 'Arah', 'Nama', 'Untuk', 'Jumlah (Rp)', 'Jatuh tempo', 'Keterangan', 'Diisi oleh',
  'Dibayar (Rp)', 'Sisa (Rp)', 'Status', 'Tanggal lunas', 'Bentuk', 'Masuk Kas', 'Kategori kas'];
var BENTUK_BON = ['Uang', 'Barang'];
// Kategori Kas untuk bon (nama yang dipakai di Google Sheet). Kalau namanya diganti, dicari kategori Pembiayaan dengan arah dan kata yang mirip.
var KAS_BON = {
  beri: ['Bon pekerja (dipinjamkan)', 'Keluar', /bon|pinjam/i],
  kembali: ['Pelunasan bon pekerja', 'Masuk', /bon|kembali|lunas/i],
  pinjam: ['Pinjaman masuk', 'Masuk', /pinjam/i],
  bayarUtang: ['Bayar hutang', 'Keluar', /hutang|utang/i]
};
var KEPALA_BAYAR_BON = ['ID', 'Timestamp', 'Tanggal', 'ID bon', 'Nama', 'Jumlah (Rp)', 'Cara', 'Keterangan', 'Diisi oleh'];
var ARAH_BON = ['Orang ngebon', 'Kita ngebon'];
var CARA_BAYAR_BON = ['Tunai', 'Transfer', 'Potong upah', 'Barang'];
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

// Aksi yang hanya membaca. Aksi lain (simpan, ubah, hapus, kelola, timbang, batas, ...) membuang cache ringkasan.
var AKSI_BACA = {masuk: 1, keluar: 1, config: 1, logo: 1, terbaru: 1, ringkasan: 1, stok: 1, batas: 1, penggunaDaftar: 1, bon: 1, pembeli: 1};

function layani_(ss, req) {
  var hasil = layaniInti_(ss, req);
  if (!AKSI_BACA[teks_(req.aksi)]) hapusCacheRingkasan_();
  return hasil;
}

function layaniInti_(ss, req) {
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
    case 'ringkasan': return ringkasanCepat_(ss, akses, req);
    case 'ubah': return ubah_(ss, akses, req);
    case 'hapus': return hapus_(ss, akses, req);
    case 'masterSimpan': return masterSimpan_(ss, akses, req);
    case 'masterAktif': return masterAktif_(ss, akses, req);
    case 'masterUrut': return masterUrut_(ss, akses, req);
    case 'penggunaDaftar': return penggunaDaftar_(ss, akses);
    case 'penggunaSimpan': return penggunaSimpan_(ss, akses, req);
    case 'tampilanSimpan': return tampilanSimpan_(ss, akses, req);
    case 'stok': return stokUntukAplikasi_(ss, akses);
    case 'stokCatat': return stokCatat_(ss, akses, req);
    case 'stokUbah': return stokUbah_(ss, akses, req);
    case 'bon': return bonDaftar_(ss, akses);
    case 'bonSimpan': return bonSimpan_(ss, akses, req);
    case 'bonBayar': return bonBayar_(ss, akses, req);
    case 'bonBayarOrang': return bonBayarOrang_(ss, akses, req);
    case 'bonHapus': return bonHapus_(ss, akses, req);
    case 'pembeli': return pembeliDaftar_(ss, akses);
    case 'pembeliSimpan': return pembeliSimpan_(ss, akses, req);
    case 'pembeliHapus': return pembeliHapus_(ss, akses, req);
    case 'batas': return batas_(ss, akses);
    case 'batasSimpan': return denganKunci_(function () { return batasSimpan_(ss, akses, req); });
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
// Tanggal boleh di masa depan (misal isi untuk besok), paling jauh MAKS_HARI_DEPAN hari, supaya salah ketik bulan/tahun tetap tertangkap.
var MAKS_HARI_DEPAN = 30;
function galatTanggal_(tgl) {
  var batas = tglIso_(new Date(Date.now() + MAKS_HARI_DEPAN * 864e5));
  return tgl > batas ? 'Tanggal paling jauh ' + MAKS_HARI_DEPAN + ' hari dari hari ini.' : '';
}
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
  var tab = pecahDaftar_(boleh).filter(function (t) { return URUTAN_TAB.indexOf(t) >= 0; });
  // Formulir Produksi Suling sudah tidak dipakai: yang dulu boleh mengisinya otomatis boleh mengisi Laporan Suling.
  if (tab.indexOf(SH_PRODUKSI) >= 0 && tab.indexOf(SH_LAPORAN) < 0) tab.splice(tab.indexOf(SH_PRODUKSI) + 1, 0, SH_LAPORAN);
  return tab;
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
      {h: 'Alat', j: 'alat', bantuan: 'Untuk tim suling: alat yang biasa dipegang. Sulingan dari absensinya dicatat ke alat ini.'},
      {h: 'No HP', j: 'teks'},
      {h: 'Catatan', j: 'teks'}]},
    'Tarif Upah': {kunci: 'tarif', judul: 'Tarif upah', utama: 'Pilihan', kolom: [
      {h: 'Pilihan', j: 'teks', wajib: true, bantuan: 'Yang dipilih saat absensi, contoh: 1 trip, Harian kenek, Libur.'},
      {h: 'Untuk', j: 'pilih', opsi: ['Semua'].concat(tim), lainnya: true, wajib: true},
      {h: 'Upah (Rp)', j: 'rupiah', bantuan: 'Untuk kerja lain biarkan 0: upahnya diisi saat absensi.'},
      {h: 'Jenis kerja', j: 'pilih', opsi: JENIS_KERJA, wajib: true,
        bantuan: 'Menentukan pos upah di Rekap. Libur = tidak dihitung hari kerja. Penyulingan dengan jumlah sulingan = tarif borongan suling di absensi.'},
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
    } else if (tab === SH_LAPORAN) {
      hasil = simpanLaporan_(ss, akses, req.nilai || {});
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
  if (galatTanggal_(tgl)) return {ok: false, galat: galatTanggal_(tgl)};
  var baris = susunBaris_(info.kepala, nilai, new Date());
  if (baris.asing.length) {
    return {ok: false, galat: 'Kolom tidak ditemukan di tab ' + tab + ': ' + baris.asing.join(', ') +
      '. Buka menu Akun > Perbarui data, lalu kirim ulang.'};
  }
  sh.insertRowBefore(2);
  formatJam_(sh, 2, info.kepala);
  sh.getRange(2, 2, 1, baris.isi.length).setValues([baris.isi]);
  SpreadsheetApp.flush();
  rapikan_(sh, info.lastCol);
  return {ok: true};
}

// Kolom jam (Mulai/Selesai nyuling) diformat teks supaya "07:30" tidak diubah Sheet menjadi angka waktu.
function formatJam_(sh, r, kepala) {
  KOLOM_JAM.forEach(function (h) {
    var j = kepala.indexOf(h);
    if (j >= 1) sh.getRange(r, 2 + j).setNumberFormat('@');
  });
}

// ---------------------------------------------------------------- LAPORAN SULING (DIISI TIM SULING)

function siapkanLaporan_(ss) {
  var sh = ss.getSheetByName(SH_LAPORAN);
  if (sh) return sh;
  var dekat = ss.getSheetByName(SH_PRODUKSI) || ss.getSheetByName('Ambil Bahan');
  sh = ss.insertSheet(SH_LAPORAN, dekat ? dekat.getIndex() : 0);
  var n = KEPALA_LAPORAN.length;
  sh.getRange(1, 1).setFormula('=ARRAYFORMULA(IF(ROW(C:C)=1,"Hari",IF(LEN(C:C),IFERROR(CHOOSE(WEEKDAY(C:C,2),' +
    '"Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"),""),)))');
  sh.getRange(1, 2, 1, n - 2).setValues([KEPALA_LAPORAN.slice(1, n - 1)]);
  // Lama nyuling (jam) dari jam mulai & selesai; lewat tengah malam tetap benar. Jam boleh teks "07:30" atau angka waktu.
  sh.getRange(1, n).setFormula('=ARRAYFORMULA(IF(ROW(C:C)=1,"Lama nyuling (jam)",IF(LEN(C:C)*LEN(G:G)*LEN(H:H),' +
    'ROUND(MOD(IFERROR(TIMEVALUE(H:H),H:H)-IFERROR(TIMEVALUE(G:G),G:G),1)*24,2),)))');
  sh.setFrozenRows(1);
  // Warna judul mengikuti tab Saring Minyak: isian hijau, rumus abu-abu.
  var contoh = ss.getSheetByName('Saring Minyak');
  if (contoh) {
    var akhirContoh = contoh.getLastColumn();
    contoh.getRange(1, 1).copyTo(sh.getRange(1, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    contoh.getRange(1, 2).copyTo(sh.getRange(1, 2, 1, n - 2), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    contoh.getRange(1, akhirContoh).copyTo(sh.getRange(1, n), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  } else {
    sh.getRange(1, 1, 1, n).setFontWeight('bold');
  }
  var baris = Math.max(sh.getMaxRows() - 1, 1);
  var f = ['dd/MM/yyyy HH:mm', 'dd/MM/yyyy', '@', '0', '@', '@', '@', '@', '@', '@', '0.00'];
  f.forEach(function (x, j) { sh.getRange(2, 2 + j, baris, 1).setNumberFormat(x); });
  catatLog_(ss, 'Buat tab', SH_LAPORAN, '', '', KEPALA_LAPORAN.join(', '), 'Sistem');
  return sh;
}

function jamSah_(v) { return /^([01]?\d|2[0-3]):[0-5]\d$/.test(teks_(v)); }
function jamRapi_(v) { var m = /^(\d{1,2}):(\d{2})$/.exec(teks_(v)); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : teks_(v); }

// Pemeriksaan isian Laporan Suling (dipakai saat simpan dan ubah). Mengembalikan teks galat atau ''.
function cekLaporan_(nilai) {
  var n = nilai['Jumlah suling'];
  if (n !== undefined && n !== '') {
    var x = Number(n);
    if (!isFinite(x) || x < 0 || x > 20 || Math.round(x) !== x) return 'Jumlah suling harus angka bulat 0 sampai 20.';
  }
  for (var i = 0; i < KOLOM_JAM.length; i++) {
    var v = nilai[KOLOM_JAM[i]];
    if (v !== undefined && v !== '' && !jamSah_(v)) return KOLOM_JAM[i] + ' harus jam, contoh 07:30.';
  }
  return '';
}

function simpanLaporan_(ss, akses, nilai) {
  var galat = cekLaporan_(nilai);
  if (galat) return {ok: false, galat: galat};
  if (nilai['Jumlah suling'] === undefined || nilai['Jumlah suling'] === '') return {ok: false, galat: 'Jumlah suling wajib diisi.'};
  var isi = {};
  Object.keys(nilai).forEach(function (k) { isi[k] = KOLOM_JAM.indexOf(k) >= 0 ? jamRapi_(nilai[k]) : nilai[k]; });
  isi['Diisi oleh'] = akses.nama;
  siapkanLaporan_(ss);
  return simpanUmum_(ss, SH_LAPORAN, isi);
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
    if (!sistem && galatTanggal_(e.tanggal)) return galatTanggal_(e.tanggal);
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
  if (galatTanggal_(tgl)) return {ok: false, galat: galatTanggal_(tgl)};
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
    if (KOLOM_JAM.indexOf(h) >= 0) return Utilities.formatDate(v, API_ZONA, 'HH:mm');   // diketik langsung di Sheet
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
    if (tab === 'Kas' && POLA_KAS_BON.test(String(lama[info.kepala.indexOf('Keterangan')] || ''))) return {ok: false, galat: GALAT_KAS_BON};
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
      if (tab === SH_LAPORAN) {
        var galatLap = cekLaporan_(nilai);
        if (galatLap) return {ok: false, galat: galatLap};
        KOLOM_JAM.forEach(function (h) { var j = info.kepala.indexOf(h); if (j >= 1 && baru[j] !== '') baru[j] = jamRapi_(baru[j]); });
        formatJam_(sh, r, info.kepala);
      }
      var kolTgl = info.kepala[1];
      if (nilai[kolTgl] !== undefined && !adalahTanggal_(baru[1])) return {ok: false, galat: kolTgl + ' wajib diisi.'};
      if (nilai[kolTgl] !== undefined && galatTanggal_(tglKunci_(baru[1]))) return {ok: false, galat: galatTanggal_(tglKunci_(baru[1]))};
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
  if (galatTanggal_(tgl)) return {ok: false, galat: galatTanggal_(tgl)};
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
    if (tab === 'Kas' && POLA_KAS_BON.test(String(lama[kepala.indexOf('Keterangan')] || ''))) return {ok: false, galat: GALAT_KAS_BON};
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

// ---- Cache ringkasan
// Menghitung ringkasan membaca banyak tab dan bisa makan beberapa detik. Hasilnya disimpan sebentar di CacheService
// (sama untuk semua pengguna yang boleh mengatur) dan langsung dibuang setiap ada perubahan data lewat aplikasi.
// Ubahan langsung di Google Sheet terlihat paling lambat CACHE_RINGKASAN_DETIK kemudian, atau langsung lewat tombol
// muat ulang di layar Ringkasan (segar: true). Ganti REV_RINGKASAN kalau bentuk data ringkasan berubah.
var CACHE_RINGKASAN_DETIK = 600;
var REV_RINGKASAN = 'rk20261111';

function ringkasanCepat_(ss, akses, req) {
  if (!akses.admin) return ringkasan_(ss, akses);
  if (!req.segar) {
    var simpanan = bacaCacheBesar_(REV_RINGKASAN);
    if (simpanan && simpanan.ok) { simpanan.dariCache = true; return simpanan; }
  }
  var r = ringkasan_(ss, akses);
  if (r && r.ok) {
    r.dihitung = Utilities.formatDate(new Date(), API_ZONA, 'HH:mm');
    simpanCacheBesar_(REV_RINGKASAN, r, CACHE_RINGKASAN_DETIK);
  }
  return r;
}

function hapusCacheRingkasan_() {
  try { CacheService.getScriptCache().remove(REV_RINGKASAN + '_n'); } catch (e) { /* cache tidak wajib */ }
}

// Nilai cache maksimal 100KB, jadi teks dipotong-potong. Kunci _n (jumlah potongan) ditulis bersama potongannya.
function simpanCacheBesar_(nama, obj, detik) {
  try {
    var teks = JSON.stringify(obj), ukuran = 30000, n = Math.ceil(teks.length / ukuran);
    if (n > 60) return;
    var isi = {};
    for (var i = 0; i < n; i++) isi[nama + '_' + i] = teks.substr(i * ukuran, ukuran);
    isi[nama + '_n'] = String(n);
    CacheService.getScriptCache().putAll(isi, detik);
  } catch (e) { /* cache tidak wajib */ }
}

function bacaCacheBesar_(nama) {
  try {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get(nama + '_n') || 0);
    if (!n) return null;
    var kunci = [];
    for (var i = 0; i < n; i++) kunci.push(nama + '_' + i);
    var isi = cache.getAll(kunci), teks = '';
    for (var j = 0; j < n; j++) { if (isi[kunci[j]] === undefined || isi[kunci[j]] === null) return null; teks += isi[kunci[j]]; }
    return JSON.parse(teks);
  } catch (e) { return null; }
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
  bulan = bulan.slice(0, 12);

  var sets = siapkanPeriode_([{daftar: minggu, jenis: 'minggu', lengkap: 12}, {daftar: bulan, jenis: 'bulan', lengkap: 6}]);
  rincianPeriode_(ss, sets);
  catatanPeriode_(ss, sets);
  selesaiPeriode_(sets);
  keteranganMinggu_(ss, minggu);

  var peringatan = dash ? dash.getRange('A15:F23').getDisplayValues().map(function (r) {
    return {hal: teks_(r[0]), nilai: teks_(r[2]), batas: teks_(r[3]), status: teks_(r[4]), saran: teks_(r[5])};
  }).filter(function (p) { return p.hal; }) : [];

  return {ok: true, hariIni: hariIni, dataSampai: dataSampai, minggu: minggu, bulan: bulan, peringatan: peringatan,
    stok: hitungStok_(ss)};
}

// ---- Rincian per periode (minggu dan bulan) untuk kartu Ringkasan dan lembar rincian saat angka diketuk.
// Periode minggu berkunci tanggal Senin (yyyy-MM-dd), periode bulan berkunci yyyy-MM. Penyaringan tanggal sama dengan rumus Rekap.
// Setiap set: {daftar, jenis: 'minggu'|'bulan', lengkap: n}. Hanya n periode terbaru yang diberi daftar catatan asli
// (supaya data yang dikirim ke HP tidak terlalu besar); periode lama tetap dapat upah per orang dan per alat.

function kunciPeriode_(jenis, k) { return jenis === 'bulan' ? k.slice(0, 7) : seninDari_(k); }
function idPeriode_(jenis, p) { return jenis === 'bulan' ? p.bulan : p.mulai; }
function hariPeriode_(jenis, p) {
  var id = idPeriode_(jenis, p), out = [];
  for (var t = jenis === 'bulan' ? id + '-01' : id; kunciPeriode_(jenis, t) === id && out.length < 31; t = tambahHari_(t, 1)) out.push(t);
  return out;
}
function siapkanPeriode_(sets) {
  sets.forEach(function (set) {
    set.ke = {};
    set.daftar.forEach(function (m, i) { m._lengkap = i < set.lengkap; set.ke[idPeriode_(set.jenis, m)] = m; });
  });
  return sets;
}
// Semua periode (minggu dan bulan) yang memuat tanggal k.
function periodeDari_(sets, k) {
  var out = [];
  if (!k) return out;
  sets.forEach(function (set) { var m = set.ke[kunciPeriode_(set.jenis, k)]; if (m) out.push(m); });
  return out;
}
function selesaiPeriode_(sets) {
  sets.forEach(function (set) { set.daftar.forEach(function (m) { delete m._lengkap; }); });
}

// Upah per orang (dengan rincian per hari untuk gajian), sulingan per alat, hari per hari, dan penjualan belum lunas.
function rincianPeriode_(ss, sets) {
  var ref = bacaReferensi_(ss);
  sets.forEach(function (set) {
    set.daftar.forEach(function (m) { m.orang = []; m.alat = []; m.belumLunas = 0; m._orang = {}; m._alat = {}; m._hari = {}; m._sul = {}; });
  });
  var jenisTarif = {};
  ref.tarif.forEach(function (t) { jenisTarif[t.pilihan] = t.jenis; });
  var timOrang = {};
  ref.karyawan.forEach(function (k) { timOrang[k.nama] = k.tim; });
  var satuAlat = ref.alat.length === 1 ? ref.alat[0].nama : '';
  var orang = function (m, nama, tim) {
    return m._orang[nama] || (m._orang[nama] = {nama: nama, peran: tim || timOrang[nama] || '', hari: {}, sulingan: 0, upahAbsensi: 0, upahSuling: 0,
      upahLain: 0, rinci: []});
  };
  var alat = function (m, nama) { return m._alat[nama] || (m._alat[nama] = {sulingan: 0, hari: {}, op: {}}); };

  var ah = ss.getSheetByName(SH_ABSENSI);
  if (ah && ah.getLastRow() >= 2) {
    // Kolom C (Tanggal) sampai K (Pekerjaan lain).
    ah.getRange(2, 3, ah.getLastRow() - 1, 9).getValues().forEach(function (r) {
      var k = tglKunci_(r[0]);
      periodeDari_(sets, k).forEach(function (m) {
        m._hari[k] = true;
        m._sul[k] = (m._sul[k] || 0) + angka_(r[5]);
        var nama = teks_(r[1]);
        if (!nama) return;
        var pek = teks_(r[3]), jenis = jenisTarif[pek] || '', s = angka_(r[5]), upah = angka_(r[6]), pos = teks_(r[7]);
        var o = orang(m, nama, teks_(r[2]));
        if (jenis === 'Kerja lain' || pek === 'Kerja lain') o.upahLain += upah;
        else if (pos === 'Penyulingan' || jenis === 'Penyulingan') { o.upahSuling += upah; o.sulingan += s; }
        else o.upahAbsensi += upah;
        if (jenis ? jenis !== 'Libur' : upah > 0) o.hari[k] = true;
        if (m._lengkap) o.rinci.push({tgl: k, pek: pek, lain: teks_(r[8]), upah: upah, pos: pos, sulingan: s});
        if (s > 0) {
          var x = alat(m, teks_(r[4]) || satuAlat || '(tanpa alat)');
          x.sulingan += s; x.hari[k] = true; x.op[nama] = (x.op[nama] || 0) + s;
        }
      });
    });
  }
  bacaProduksi_(ss).forEach(function (p) {
    periodeDari_(sets, p.tgl).forEach(function (m) {
      m._hari[p.tgl] = true;
      m._sul[p.tgl] = (m._sul[p.tgl] || 0) + p.n;
      var x = alat(m, p.alat || '(tanpa alat)');
      x.sulingan += p.n;
      if (p.n > 0) x.hari[p.tgl] = true;
      if (p.operator) {
        x.op[p.operator] = (x.op[p.operator] || 0) + p.n;
        var o = orang(m, p.operator);
        o.sulingan += p.n; o.upahSuling += p.upah;
        if (p.n > 0) o.hari[p.tgl] = true;
        if (m._lengkap) o.rinci.push({tgl: p.tgl, pek: p.n + 'x suling (Produksi Suling)', lain: '', upah: p.upah, pos: 'Penyulingan', sulingan: p.n});
      }
    });
  });
  bacaKolom_(ss, 'Penjualan', ['Tanggal', 'Status bayar', 'Total (Rp)']).forEach(function (r) {
    var st = teks_(r[1]);
    if (!st || st === 'Lunas') return;
    periodeDari_(sets, tglKunci_(r[0])).forEach(function (m) { m.belumLunas += angka_(r[2]); });
  });
  var urutOrang = {};
  ref.karyawan.forEach(function (k, i) { urutOrang[k.nama] = i; });
  var namaAlat = ref.alat.filter(function (x) { return x.aktif; }).map(function (x) { return x.nama; });
  var urutTgl = function (a, b) { return a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : 0; };
  sets.forEach(function (set) {
    set.daftar.forEach(function (m) {
      var hariCatat = Object.keys(m._hari).length;
      m.orang = Object.keys(m._orang).map(function (n) {
        var o = m._orang[n];
        var x = {nama: n, peran: o.peran, hariMasuk: Object.keys(o.hari).length, sulingan: o.sulingan, upahAbsensi: o.upahAbsensi,
          upahSuling: o.upahSuling, upahLain: o.upahLain, total: o.upahAbsensi + o.upahSuling + o.upahLain};
        if (m._lengkap) x.rinci = o.rinci.sort(urutTgl);
        return x;
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
      // Hari per hari (sama dengan cara Rekap menghitung "Hari ketel kosong": hari yang ada catatan tapi tanpa sulingan).
      if (m._lengkap) {
        m.hari = hariPeriode_(set.jenis, m).map(function (t) { return {tgl: t, catat: !!m._hari[t], sulingan: m._sul[t] || 0}; });
      }
      delete m._orang; delete m._alat; delete m._hari; delete m._sul;
    });
  });
}

var KELOMPOK_KAS_BULAN = ['Pengembangan usaha', 'Cicilan kendaraan', 'Keluarga & pribadi', 'Proyek lain', 'Pembiayaan', 'Pemasukan lain'];

// Catatan asli di balik angka setiap periode: trip, saring, penjualan, biaya operasional, dan (untuk bulan) Kas per kelompok.
function catatanPeriode_(ss, sets) {
  var semua = [];
  sets.forEach(function (set) {
    set.daftar.forEach(function (m) {
      if (!m._lengkap) return;
      m.rinci = {bahan: [], saring: [], jual: [], ops: []};
      if (set.jenis === 'bulan') m.rinci.kas = [];
      semua.push({m: m, batas: set.jenis === 'bulan' ? 200 : 60});
    });
  });
  var tiap = function (k, f) { periodeDari_(sets, k).forEach(function (m) { if (m.rinci) f(m.rinci); }); };
  bacaKolom_(ss, 'Ambil Bahan', ['Tanggal', 'Pengumpul', 'Daerah', 'Kondisi bahan', 'Berat bahan (kg)', 'Uang beli bahan (Rp)',
    'Biaya lain di jalan (Rp)', 'Keterangan biaya lain']).forEach(function (r) {
    var t = tglKunci_(r[0]);
    tiap(t, function (x) {
      x.bahan.push({tgl: t, oleh: teks_(r[1]), daerah: teks_(r[2]), kondisi: teks_(r[3]), kg: angka_(r[4]), beli: angka_(r[5]),
        jalan: angka_(r[6]), ketJalan: teks_(r[7])});
    });
  });
  bacaKolom_(ss, 'Saring Minyak', ['Tanggal saring', 'Jumlah sulingan yang disaring', 'Minyak (kg)', 'Keterangan']).forEach(function (r) {
    var t = tglKunci_(r[0]);
    tiap(t, function (x) { x.saring.push({tgl: t, sulingan: angka_(r[1]), kg: angka_(r[2]), ket: teks_(r[3])}); });
  });
  bacaKolom_(ss, 'Penjualan', ['Tanggal', 'Pembeli', 'Produk', 'Jumlah', 'Satuan', 'Harga satuan (Rp)', 'Total (Rp)', 'Minyak terjual (kg)',
    'Status bayar']).forEach(function (r) {
    var t = tglKunci_(r[0]);
    tiap(t, function (x) {
      x.jual.push({tgl: t, pembeli: teks_(r[1]), produk: teks_(r[2]), jumlah: angka_(r[3]), satuan: teks_(r[4]),
        harga: angka_(r[5]), total: angka_(r[6]), kg: angka_(r[7]), status: teks_(r[8])});
    });
  });
  bacaKolom_(ss, 'Kas', ['Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Kelompok', 'Arah']).forEach(function (r) {
    var t = tglKunci_(r[0]), kel = teks_(r[4]);
    tiap(t, function (x) {
      if (kel === 'Operasional usaha') x.ops.push({tgl: t, apa: teks_(r[1]), rp: angka_(r[2]), ket: teks_(r[3])});
      else if (x.kas && KELOMPOK_KAS_BULAN.indexOf(kel) >= 0) x.kas.push({tgl: t, apa: teks_(r[1]), rp: angka_(r[2]), ket: teks_(r[3]).replace(POLA_KAS_BON, '').trim(), kel: kel, arah: teks_(r[5])});
    });
  });
  bacaKolom_(ss, SH_ABSENSI, ['Tanggal', 'Nama', 'Pekerjaan', 'Pekerjaan lain', 'Upah (Rp)', 'Pos upah']).forEach(function (r) {
    if (teks_(r[5]) !== 'Perawatan alat') return;
    var t = tglKunci_(r[0]);
    tiap(t, function (x) { x.ops.push({tgl: t, apa: 'Upah perawatan alat', rp: angka_(r[4]), ket: teks_(r[1]) + ': ' + (teks_(r[3]) || teks_(r[2]))}); });
  });
  var urut = function (a, b) { return a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : 0; };
  semua.forEach(function (p) {
    Object.keys(p.m.rinci).forEach(function (k) { p.m.rinci[k] = p.m.rinci[k].sort(urut).slice(0, p.batas); });
  });
}

// Keterangan dan kejadian tidak biasa per minggu (sama dengan daftar di bagian bawah Dashboard):
// keterangan Ambil Bahan, Produksi Suling, Laporan Suling, Saring Minyak, Absensi, kerja lain, kondisi alat bukan Normal, dan Penjualan.
// Juga: jumlah suling di Laporan Suling yang beda dengan Absensi tim suling di tanggal yang sama.
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
  var sulingAbsen = {};   // tanggal -> jumlah sulingan menurut Absensi (+ Produksi Suling lama)
  bacaProduksi_(ss).forEach(function (p) {
    tambah(p.tgl, 'Produksi suling', p.ket);
    if (p.kondisi && p.kondisi !== 'Normal') tambah(p.tgl, 'Kondisi alat', p.alat + ': ' + p.kondisi);
    sulingAbsen[p.tgl] = (sulingAbsen[p.tgl] || 0) + p.n;
  });
  var timSuling = timDenganJenis_(bacaTarifApi_(ss), 'Penyulingan');
  baca(SH_ABSENSI, function (r, g) {
    var t = tglKunci_(g(r, 'Tanggal'));
    var nSul = angka_(g(r, 'Jumlah sulingan'));
    if (t && (nSul > 0 || timSuling.indexOf(teks_(g(r, 'Tim'))) >= 0)) sulingAbsen[t] = (sulingAbsen[t] || 0) + nSul;
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
  var sulingLapor = {};
  baca(SH_LAPORAN, function (r, g) {
    var t = tglKunci_(g(r, 'Tanggal'));
    if (!t) return;
    tambah(t, 'Laporan suling', g(r, 'Keterangan'));
    var k = pecahDaftar_(g(r, 'Kondisi alat')).filter(function (x) { return x !== 'Normal'; });
    if (k.length) tambah(t, 'Kondisi alat', 'Saat nyuling: ' + k.join(', '));
    if (teks_(g(r, 'Jumlah suling')) !== '') sulingLapor[t] = (sulingLapor[t] || 0) + angka_(g(r, 'Jumlah suling'));
  });
  Object.keys(sulingLapor).forEach(function (t) {
    if (sulingAbsen[t] === undefined || sulingAbsen[t] === sulingLapor[t]) return;
    tambah(t, 'Laporan suling', 'Jumlah suling beda: laporan tim ' + sulingLapor[t] + 'x, Absensi ' + sulingAbsen[t] +
      'x. Cek mana yang benar (upah & rekap dihitung dari Absensi).');
  });
  var urutBagian = ['Ambil bahan', 'Produksi suling', 'Laporan suling', 'Kondisi alat', 'Saring minyak', 'Absensi', 'Kerja lain', 'Penjualan'];
  minggu.forEach(function (m) {
    m.keterangan.sort(function (a, b) {
      return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : urutBagian.indexOf(a.bagian) - urutBagian.indexOf(b.bagian);
    });
    m.keterangan = m.keterangan.slice(0, 40);
    delete m._sudah;
  });
}

// ---------------------------------------------------------------- STOK MINYAK
// Stok sekarang = hasil timbang terakhir + minyak disaring sesudahnya - minyak terjual sesudahnya.
// Hasil timbang diambil dari tab "Stok Minyak" (dicatat dari aplikasi) atau kolom "Stok minyak di gudang (kg)" di Saring Minyak.
// Hasil timbang = stok saat timbangan itu dicatat. Saring dan penjualan di tanggal yang sama ikut dihitung kalau
// dicatat SESUDAH timbangan (menurut Timestamp); yang dicatat sebelumnya dianggap sudah termasuk timbangan.
// Catatan lama tanpa Timestamp dianggap sudah termasuk (sama seperti aturan lama: timbang = stok akhir hari).
// Kalau belum pernah ditimbang: semua minyak disaring dikurangi semua minyak terjual.

function bacaKolom_(ss, nama, judul) {
  var sh = ss.getSheetByName(nama);
  if (!sh || sh.getLastRow() < 2) return [];
  var kepala = kepalaSheet_(sh);
  var idx = judul.map(function (h) { return kepala.indexOf(h); });
  return sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getValues().map(function (r) {
    return idx.map(function (j) { return j >= 0 ? r[j] : ''; });
  });
}

function waktuMs_(v) { return adalahTanggal_(v) ? v.getTime() : 0; }

// sampai: 'yyyy-MM-dd' (opsional) = hitung stok di akhir tanggal itu, tanpa memakai timbangan pada/sesudah tanggal itu.
// batasW (opsional, ms): di tanggal 'sampai', hanya saring & penjualan yang dicatat sampai jam itu (stok saat timbangan dicatat).
// lewatiBaris (opsional): baris tab Stok Minyak yang tidak dipakai (timbangan yang sedang diubah).
function hitungStok_(ss, sampai, batasW, lewatiBaris) {
  var sebelum = function (x) { return !sampai || x.tgl < sampai || (x.tgl === sampai && (!batasW || !x.w || x.w <= batasW)); };
  var saring = bacaKolom_(ss, 'Saring Minyak', ['Timestamp', 'Tanggal saring', 'Minyak (kg)', 'Stok minyak di gudang (kg)'])
    .map(function (r) { return {w: waktuMs_(r[0]), tgl: tglKunci_(r[1]), kg: angka_(r[2]), stok: teks_(r[3]) === '' ? null : angka_(r[3])}; })
    .filter(function (x) { return x.tgl && sebelum(x); });
  var jual = bacaKolom_(ss, 'Penjualan', ['Tanggal', 'Minyak terjual (kg)', 'Pembeli', 'Timestamp'])
    .map(function (r) { return {tgl: tglKunci_(r[0]), kg: angka_(r[1]), pembeli: teks_(r[2]), w: waktuMs_(r[3])}; })
    .filter(function (x) { return x.tgl && x.kg > 0 && sebelum(x); });
  var timbang = bacaKolom_(ss, SH_STOK, ['Timestamp', 'Tanggal', 'Stok ditimbang (kg)', 'Selisih (kg)', 'Keterangan', 'Diisi oleh'])
    .map(function (r, i) { return {baris: i + 2, w: waktuMs_(r[0]), tgl: tglKunci_(r[1]), kg: angka_(r[2]), selisih: teks_(r[3]) === '' ? null : angka_(r[3]),
      ket: teks_(r[4]), oleh: teks_(r[5]), sumber: 'Timbang'}; })
    .filter(function (x) { return x.tgl && x.baris !== lewatiBaris; });
  var dasar = timbang.filter(function (x) { return !sampai || x.tgl < sampai; })
    .concat(saring.filter(function (x) { return x.stok !== null && (!sampai || x.tgl < sampai); })
      .map(function (x) { return {w: x.w, tgl: x.tgl, kg: x.stok, sumber: 'Saring'}; }))
    .sort(function (a, b) { return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : b.w - a.w; })[0] || null;
  var sesudah = function (x) { return !dasar || x.tgl > dasar.tgl || (x.tgl === dasar.tgl && dasar.w > 0 && x.w > dasar.w); };
  var masuk = saring.filter(sesudah).reduce(function (t, x) { return t + x.kg; }, 0);
  var keluar = jual.filter(sesudah).reduce(function (t, x) { return t + x.kg; }, 0);
  var akhirMasuk = saring.slice().sort(function (a, b) { return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : b.w - a.w; })[0] || null;
  var akhirKeluar = jual.slice().sort(function (a, b) { return a.tgl < b.tgl ? 1 : -1; })[0] || null;
  return {
    kg: bulat_((dasar ? dasar.kg : 0) + masuk - keluar, 2),
    dasar: dasar ? {tgl: dasar.tgl, kg: dasar.kg, sumber: dasar.sumber} : null,
    masuk: bulat_(masuk, 2), keluar: bulat_(keluar, 2),
    nMasuk: saring.filter(sesudah).length, nKeluar: jual.filter(sesudah).length,
    akhirMasuk: akhirMasuk ? {tgl: akhirMasuk.tgl, kg: akhirMasuk.kg} : null,
    akhirKeluar: akhirKeluar ? {tgl: akhirKeluar.tgl, kg: akhirKeluar.kg, pembeli: akhirKeluar.pembeli} : null,
    riwayat: sampai ? undefined : timbang.sort(function (a, b) { return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : b.w - a.w; }).slice(0, 5)
      .map(function (x) { return {tgl: x.tgl, kg: x.kg, selisih: x.selisih, ket: x.ket, oleh: x.oleh, baris: x.baris, w: x.w}; })
  };
}

function stokUntukAplikasi_(ss, akses) {
  if (!akses.admin) return {ok: false, galat: 'Stok hanya untuk pemilik atau pengguna yang boleh mengatur.'};
  return {ok: true, stok: hitungStok_(ss)};
}

// Mencatat hasil timbang stok minyak di gudang. Selisih = hasil timbang - stok menurut catatan di tanggal itu.
function stokCatat_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mencatat stok.'};
  var tgl = teks_(req.tanggal);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return {ok: false, galat: 'Tanggal wajib diisi.'};
  if (galatTanggal_(tgl)) return {ok: false, galat: galatTanggal_(tgl)};
  var kg = typeof req.kg === 'number' ? req.kg : angka_(req.kg);
  if (!(kg >= 0) || kg > 10000) return {ok: false, galat: 'Tulis berat stok dalam kg, contoh 12,5.'};
  return denganKunci_(function () {
    var waktu = new Date();
    var catatan = hitungStok_(ss, tgl, waktu.getTime()).kg;
    var sh = ss.getSheetByName(SH_STOK);
    if (!sh) {
      sh = siapkanSheet_(ss, SH_STOK, KEPALA_STOK);
      var contoh = ss.getSheetByName('Saring Minyak');
      if (contoh) contoh.getRange(1, 2, 1, KEPALA_STOK.length).copyTo(sh.getRange(1, 1, 1, KEPALA_STOK.length), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    }
    var baris = [waktu, tglDariIso_(tgl), bulat_(kg, 2), catatan, bulat_(kg - catatan, 2), teks_(req.keterangan), akses.nama];
    sh.insertRowBefore(2);
    sh.getRange(2, 1, 1, baris.length).setValues([baris]);
    sh.getRange(2, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    sh.getRange(2, 2).setNumberFormat('dd/MM/yyyy');
    sh.getRange(2, 3, 1, 3).setNumberFormat('0.00');
    sh.getRange(2, 1, 1, baris.length).setFontWeight('normal');
    catatLog_(ss, 'Timbang stok', SH_STOK, 2, 'catatan ' + catatan + ' kg', 'ditimbang ' + bulat_(kg, 2) + ' kg', akses.nama);
    return {ok: true, selisih: bulat_(kg - catatan, 2), catatan: catatan, stok: hitungStok_(ss)};
  });
}

// Mengubah atau menghapus satu hasil timbang. Baris dicocokkan dengan nomor baris + Timestamp + tanggal,
// supaya tidak salah baris kalau tab sudah berubah. Jam timbang (Timestamp) tidak diubah.
// Stok menurut catatan dihitung ulang untuk tanggal (baru) itu, sampai jam timbangan dicatat.
function stokUbah_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mengubah hasil timbang.'};
  var hapus = req.hapus === true;
  var tgl = teks_(req.tanggal);
  var kg = typeof req.kg === 'number' ? req.kg : angka_(req.kg);
  if (!hapus) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return {ok: false, galat: 'Tanggal wajib diisi.'};
    if (galatTanggal_(tgl)) return {ok: false, galat: galatTanggal_(tgl)};
    if (!(kg >= 0) || kg > 10000) return {ok: false, galat: 'Tulis berat stok dalam kg, contoh 12,5.'};
  }
  return denganKunci_(function () {
    var sh = ss.getSheetByName(SH_STOK);
    var r = Math.floor(Number(req.baris));
    var berubah = {ok: false, kode: 'BERUBAH', galat: 'Hasil timbang ini sudah berubah atau terhapus. Muat ulang Ringkasan, lalu coba lagi.'};
    if (!sh || !(r >= 2) || r > sh.getLastRow()) return berubah;
    var kepala = kepalaSheet_(sh);
    var k = function (h) { return kepala.indexOf(h); };
    if (k('Timestamp') < 0 || k('Tanggal') < 0 || k('Stok ditimbang (kg)') < 0) return {ok: false, galat: 'Judul kolom tab Stok Minyak berubah.'};
    var lama = sh.getRange(r, 1, 1, kepala.length).getValues()[0];
    if (waktuMs_(lama[k('Timestamp')]) !== Number(req.w || 0) || tglKunci_(lama[k('Tanggal')]) !== teks_(req.tanggalLama)) return berubah;
    var teksLama = JSON.stringify({tanggal: tglKunci_(lama[k('Tanggal')]), kg: lama[k('Stok ditimbang (kg)')], ket: k('Keterangan') >= 0 ? lama[k('Keterangan')] : ''});
    if (hapus) {
      sh.deleteRow(r);
      catatLog_(ss, 'Hapus timbang', SH_STOK, r, teksLama, '', akses.nama);
      return {ok: true, stok: hitungStok_(ss)};
    }
    var w = waktuMs_(lama[k('Timestamp')]);
    var catatan = hitungStok_(ss, tgl, w || null, r).kg;
    var baru = lama.slice();
    baru[k('Tanggal')] = tglDariIso_(tgl);
    baru[k('Stok ditimbang (kg)')] = bulat_(kg, 2);
    if (k('Stok menurut catatan (kg)') >= 0) baru[k('Stok menurut catatan (kg)')] = catatan;
    if (k('Selisih (kg)') >= 0) baru[k('Selisih (kg)')] = bulat_(kg - catatan, 2);
    if (k('Keterangan') >= 0) baru[k('Keterangan')] = teks_(req.keterangan);
    if (k('Diisi oleh') >= 0) {
      var oleh = String(lama[k('Diisi oleh')] || '').replace(/ \(diubah .*\)$/, '');
      baru[k('Diisi oleh')] = oleh + (oleh === akses.nama ? '' : ' (diubah ' + akses.nama + ')');
    }
    sh.getRange(r, 1, 1, baru.length).setValues([baru]);
    sh.getRange(r, k('Tanggal') + 1).setNumberFormat('dd/MM/yyyy');
    catatLog_(ss, 'Ubah timbang', SH_STOK, r, teksLama, JSON.stringify({tanggal: tgl, kg: bulat_(kg, 2), ket: teks_(req.keterangan)}), akses.nama);
    return {ok: true, selisih: bulat_(kg - catatan, 2), catatan: catatan, stok: hitungStok_(ss)};
  });
}

// ---------------------------------------------------------------- CATATAN BON
// Tab "Bon" (satu baris per bon) dan "Bayar Bon" (satu baris per pembayaran/cicilan) dibuat otomatis saat bon pertama dicatat.
// Status dihitung dari pembayaran: Belum lunas, Dicicil, atau Lunas. Penjualan dengan Status bayar selain Lunas ikut
// ditampilkan sebagai "orang ngebon" supaya semua yang belum dibayar ada di satu tempat.
// Bon tidak otomatis masuk Kas maupun Rekap (kasbon bukan biaya).

function bacaTabel_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  var kepala = kepalaSheet_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getValues().map(function (r, i) {
    var v = {};
    kepala.forEach(function (h, j) { if (h) v[h] = r[j]; });
    return {baris: i + 2, v: v};
  }).filter(function (x) { return teks_(x.v['ID']); });
}

function bacaBon_(ss) {
  var bon = bacaTabel_(ss.getSheetByName(SH_BON)).map(function (x) {
    var v = x.v;
    return {baris: x.baris, id: teks_(v['ID']), w: waktuMs_(v['Timestamp']), tgl: tglKunci_(v['Tanggal']), arah: teks_(v['Arah']),
      nama: teks_(v['Nama']), untuk: teks_(v['Untuk']), jumlah: angka_(v['Jumlah (Rp)']), tempo: tglKunci_(v['Jatuh tempo']),
      ket: teks_(v['Keterangan']), oleh: teks_(v['Diisi oleh']), bentuk: teks_(v['Bentuk']) || 'Uang', masukKas: teks_(v['Masuk Kas']) === 'Ya',
      kategoriKas: teks_(v['Kategori kas']), bayar: []};
  });
  var per = {};
  bon.forEach(function (b) { per[b.id] = b; });
  bacaTabel_(ss.getSheetByName(SH_BAYAR_BON)).forEach(function (x) {
    var v = x.v, b = per[teks_(v['ID bon'])];
    if (!b) return;
    b.bayar.push({baris: x.baris, id: teks_(v['ID']), w: waktuMs_(v['Timestamp']), tgl: tglKunci_(v['Tanggal']), jumlah: angka_(v['Jumlah (Rp)']),
      cara: teks_(v['Cara']), ket: teks_(v['Keterangan']), oleh: teks_(v['Diisi oleh'])});
  });
  bon.forEach(hitungBon_);
  return bon;
}

function hitungBon_(b) {
  b.bayar.sort(function (p, q) { return p.tgl < q.tgl ? -1 : p.tgl > q.tgl ? 1 : p.w - q.w; });
  b.dibayar = b.bayar.reduce(function (t, p) { return t + p.jumlah; }, 0);
  b.sisa = Math.max(0, b.jumlah - b.dibayar);
  b.status = b.sisa <= 0 ? 'Lunas' : (b.dibayar > 0 ? 'Dicicil' : 'Belum lunas');
  b.tglLunas = b.status === 'Lunas' && b.bayar.length ? b.bayar[b.bayar.length - 1].tgl : '';
  return b;
}

// Menulis kolom hasil hitungan (Dibayar, Sisa, Status, Tanggal lunas) ke baris bon.
function tulisHitunganBon_(sh, b) {
  var kepala = kepalaSheet_(sh);
  var isi = {'Dibayar (Rp)': b.dibayar, 'Sisa (Rp)': b.sisa, 'Status': b.status, 'Tanggal lunas': b.tglLunas ? tglDariIso_(b.tglLunas) : ''};
  Object.keys(isi).forEach(function (h) {
    var j = kepala.indexOf(h);
    if (j >= 0) sh.getRange(b.baris, j + 1).setValue(isi[h]);
  });
}

function formatBarisBon_(sh, r, kepala) {
  kepala.forEach(function (h, j) {
    var f = h === 'Timestamp' ? 'dd/MM/yyyy HH:mm' : (/^Tanggal|Jatuh tempo/.test(h) ? 'dd/MM/yyyy' : (/\(Rp\)$/.test(h) ? '"Rp"#,##0' : ''));
    if (f) sh.getRange(r, j + 1).setNumberFormat(f);
  });
  sh.getRange(r, 1, 1, kepala.length).setFontWeight('normal');
}

function siapkanBon_(ss, nama, kepala) {
  var ada = ss.getSheetByName(nama);
  var sh = siapkanSheet_(ss, nama, kepala);
  if (!ada) sh.getRange(1, 1, 1, kepala.length).setFontWeight('bold');
  else {
    // Tab dari versi sebelumnya: kolom baru ditambahkan di kanan.
    var sekarang = kepalaSheet_(sh), akhir = sekarang.length;
    kepala.forEach(function (h) {
      if (sekarang.indexOf(h) >= 0) return;
      akhir++;
      if (akhir > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), akhir - sh.getMaxColumns());
      sh.getRange(1, akhir).setValue(h).setFontWeight('bold');
      sekarang.push(h);
    });
  }
  return sh;
}

// ---- Sambungan bon ke tab Kas
// Setiap bon dan pembayarannya punya paling banyak satu baris Kas, dikenali dari tanda di Keterangan:
// "[bon:<id>]" untuk bon, "[bayar bon:<id>]" untuk pembayaran. Baris Kas itu ikut diubah/dihapus bersama bonnya,
// dan tidak bisa diubah/dihapus dari Riwayat Kas (supaya tidak berbeda dengan Catatan bon).
var GALAT_KAS_BON = 'Catatan kas ini dibuat otomatis dari Catatan bon. Ubah atau hapus lewat Catatan bon supaya keduanya tetap sama.';
var POLA_KAS_BON = /\[(bayar )?bon:[0-9a-zA-Z_-]+\]/;
function tandaKasBon_(id) { return '[bon:' + id + ']'; }
function tandaKasBayar_(id) { return '[bayar bon:' + id + ']'; }

function kategoriKasBon_(ss, jenis) {
  var c = KAS_BON[jenis];
  var kat = bacaMaster_(ss, 'Kategori Kas').map(function (m) { return m.nilai; });
  var persis = kat.filter(function (k) { return teks_(k['Kategori']) === c[0]; })[0];
  if (persis) return c[0];
  var mirip = kat.filter(function (k) { return teks_(k['Kelompok']) === 'Pembiayaan' && teks_(k['Arah']) === c[1] && c[2].test(teks_(k['Kategori'])); })[0];
  return mirip ? teks_(mirip['Kategori']) : '';
}

// Isi baris Kas untuk bon itu sendiri (null = tidak ada baris Kas).
function kasUntukBon_(ss, b) {
  if (!b.masukKas) return null;
  if (b.arah === 'Orang ngebon') {
    return {jenis: 'beri', kategori: kategoriKasBon_(ss, 'beri'), tanggal: b.tgl, jumlah: b.jumlah,
      ket: 'Bon ' + b.nama + (b.untuk ? ': ' + b.untuk : '')};
  }
  if (b.bentuk === 'Barang') return null;   // ambil barang dulu: uang baru keluar saat dibayar
  return {jenis: 'pinjam', kategori: kategoriKasBon_(ss, 'pinjam'), tanggal: b.tgl, jumlah: b.jumlah,
    ket: 'Pinjam dari ' + b.nama + (b.untuk ? ': ' + b.untuk : '')};
}

// Isi baris Kas untuk satu pembayaran bon. Dibayar dengan barang: tidak ada uang yang bergerak.
function kasUntukBayar_(ss, b, p) {
  if (p.cara === 'Barang') return null;
  var cara = p.cara && p.cara !== 'Tunai' ? ' (' + p.cara.toLowerCase() + ')' : '';
  if (b.arah === 'Orang ngebon') {
    return {jenis: 'kembali', kategori: kategoriKasBon_(ss, 'kembali'), tanggal: p.tgl, jumlah: p.jumlah,
      ket: b.nama + ' bayar bon' + (b.untuk ? ' ' + b.untuk : '') + cara};
  }
  if (b.bentuk === 'Barang' && b.kategoriKas) {
    return {jenis: 'barang', kategori: b.kategoriKas, tanggal: p.tgl, jumlah: p.jumlah, ket: 'Bayar bon ke ' + b.nama + (b.untuk ? ': ' + b.untuk : '') + cara};
  }
  return {jenis: 'bayarUtang', kategori: kategoriKasBon_(ss, 'bayarUtang'), tanggal: p.tgl, jumlah: p.jumlah,
    ket: 'Bayar bon ke ' + b.nama + (b.untuk ? ': ' + b.untuk : '') + cara};
}

function barisKasBertanda_(sh, info, tanda) {
  var j = info.kepala.indexOf('Keterangan');
  if (j < 0 || sh.getLastRow() < 2) return 0;
  var ket = sh.getRange(2, 2 + j, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ket.length; i++) if (String(ket[i][0]).indexOf(tanda) >= 0) return i + 2;
  return 0;
}

// Menulis, mengubah, atau menghapus (isi = null) baris Kas bertanda. Hasil: '' kalau beres, atau teks peringatan.
function aturKasBon_(ss, tanda, isi, akses) {
  var sh = ss.getSheetByName('Kas');
  if (!sh) return isi ? 'Tab Kas tidak ada, jadi bon ini belum tercatat di Kas.' : '';
  var info = kolomForm_(sh);
  var r = barisKasBertanda_(sh, info, tanda);
  var k = function (h) { return info.kepala.indexOf(h); };
  if (!isi) {
    if (r) {
      var lamaH = sh.getRange(r, 2, 1, info.kepala.length).getValues()[0];
      sh.deleteRow(r);
      catatLog_(ss, 'Hapus', 'Kas', r, JSON.stringify(nilaiMentah_(info.kepala, lamaH)), 'dari Catatan bon', akses.nama);
    }
    return '';
  }
  if (!isi.kategori) {
    if (r) sh.deleteRow(r);
    return 'Kategori kas "' + KAS_BON[isi.jenis][0] + '" belum ada di Kelola › Kategori kas, jadi belum tercatat di Kas.';
  }
  var nilai = {'Tanggal': isi.tanggal, 'Kategori': isi.kategori, 'Jumlah (Rp)': Math.round(isi.jumlah), 'Keterangan': isi.ket + ' ' + tanda};
  if (r) {
    var baris = sh.getRange(r, 2, 1, info.kepala.length).getValues()[0], lama = baris.slice();
    Object.keys(nilai).forEach(function (h) { if (k(h) >= 0) baris[k(h)] = ubahNilai_(h, nilai[h]); });
    if (JSON.stringify(nilaiMentah_(info.kepala, lama)) === JSON.stringify(nilaiMentah_(info.kepala, baris))) return '';
    sh.getRange(r, 2, 1, baris.length).setValues([baris]);
    SpreadsheetApp.flush();
    rapikan_(sh, info.lastCol);
    catatLog_(ss, 'Ubah', 'Kas', r, JSON.stringify(nilaiMentah_(info.kepala, lama)), JSON.stringify(nilaiMentah_(info.kepala, baris)) + ' (dari Catatan bon)', akses.nama);
    return '';
  }
  var hasil = simpanUmum_(ss, 'Kas', nilai);
  if (!hasil.ok) return 'Belum tercatat di Kas: ' + hasil.galat;
  catatLog_(ss, 'Tambah', 'Kas', 2, '', JSON.stringify(nilai) + ' (dari Catatan bon)', akses.nama);
  return '';
}

// Menyamakan semua baris Kas milik satu bon (bonnya dan setiap pembayarannya).
function samakanKasBon_(ss, b, akses) {
  var pesan = [aturKasBon_(ss, tandaKasBon_(b.id), kasUntukBon_(ss, b), akses)];
  b.bayar.forEach(function (p) { pesan.push(aturKasBon_(ss, tandaKasBayar_(p.id), kasUntukBayar_(ss, b, p), akses)); });
  return pesan.filter(function (x) { return x; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' ');
}

function bonUntukAplikasi_(b) {
  return {id: b.id, tgl: b.tgl, arah: b.arah, nama: b.nama, untuk: b.untuk, jumlah: b.jumlah, tempo: b.tempo, ket: b.ket, oleh: b.oleh,
    dibayar: b.dibayar, sisa: b.sisa, status: b.status, tglLunas: b.tglLunas, bentuk: b.bentuk, masukKas: b.masukKas, kategoriKas: b.kategoriKas,
    bayar: b.bayar.map(function (p) { return {id: p.id, tgl: p.tgl, jumlah: p.jumlah, cara: p.cara, ket: p.ket, oleh: p.oleh}; })};
}

function bonDaftar_(ss, akses) {
  if (!akses.admin) return {ok: false, galat: 'Catatan bon hanya untuk pemilik atau pengguna yang boleh mengatur.'};
  var bon = bacaBon_(ss).map(bonUntukAplikasi_);
  // Penjualan yang belum lunas (dari tab Penjualan). id sama dengan Riwayat, jadi bisa ditandai lunas lewat aksi 'ubah'.
  var jual = [];
  var sh = ss.getSheetByName('Penjualan');
  if (sh && sh.getLastRow() >= 2) {
    var kepala = kepalaSheet_(sh), nIsi = kolomForm_(sh).kepala.length;
    var k = function (h) { return kepala.indexOf(h); };
    sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getValues().forEach(function (r, i) {
      var st = k('Status bayar') >= 0 ? teks_(r[k('Status bayar')]) : '';
      if (!st || st === 'Lunas' || !tglKunci_(r[k('Tanggal')])) return;
      jual.push({id: 'r' + (i + 2) + '|' + tandaBaris_(r.slice(1, 1 + nIsi)), tgl: tglKunci_(r[k('Tanggal')]), nama: teks_(r[k('Pembeli')]),
        untuk: [teks_(r[k('Jumlah')]).replace('.', ','), teks_(r[k('Satuan')]), teks_(r[k('Produk')])].filter(function (x) { return x; }).join(' '),
        jumlah: angka_(r[k('Total (Rp)')]), status: st, ket: k('Keterangan') >= 0 ? teks_(r[k('Keterangan')]) : ''});
    });
  }
  var keluar = bacaMaster_(ss, 'Kategori Kas').filter(function (m) { return m.aktif && teks_(m.nilai['Arah']) === 'Keluar'; }).map(function (m) { return teks_(m.nilai['Kategori']); });
  return {ok: true, bon: bon, jual: jual, arah: ARAH_BON, cara: CARA_BAYAR_BON, bentuk: BENTUK_BON, kategoriKeluar: keluar};
}
function hasilBon_(ss, akses, peringatan) {
  var r = bonDaftar_(ss, akses);
  if (peringatan) r.peringatan = peringatan;
  return r;
}

function bonSimpan_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mencatat bon.'};
  var tgl = teks_(req.tanggal), tempo = teks_(req.tempo), arah = teks_(req.arah), nama = teks_(req.nama), untuk = teks_(req.untuk);
  var jumlah = typeof req.jumlah === 'number' ? req.jumlah : angka_(req.jumlah);
  if (ARAH_BON.indexOf(arah) < 0) return {ok: false, galat: 'Pilih: orang ngebon ke kita, atau kita ngebon.'};
  if (!nama) return {ok: false, galat: 'Nama wajib diisi.'};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return {ok: false, galat: 'Tanggal wajib diisi.'};
  if (galatTanggal_(tgl)) return {ok: false, galat: galatTanggal_(tgl)};
  if (tempo && !/^\d{4}-\d{2}-\d{2}$/.test(tempo)) return {ok: false, galat: 'Jatuh tempo tidak valid.'};
  if (!(jumlah > 0) || jumlah > 1e10) return {ok: false, galat: 'Jumlah bon wajib diisi.'};
  var bentuk = arah === 'Kita ngebon' && teks_(req.bentuk) === 'Barang' ? 'Barang' : 'Uang';
  var kategoriKas = bentuk === 'Barang' ? teks_(req.kategoriKas) : '';
  var masukKas = req.masukKas === false ? 'Tidak' : 'Ya';
  return denganKunci_(function () {
    var sh = siapkanBon_(ss, SH_BON, KEPALA_BON);
    var kepala = kepalaSheet_(sh);
    var semua = bacaBon_(ss);
    var lama = req.id ? semua.filter(function (b) { return b.id === teks_(req.id); })[0] : null;
    if (req.id && !lama) return {ok: false, kode: 'BERUBAH', galat: 'Bon ini sudah terhapus. Muat ulang, lalu coba lagi.'};
    // Kirim ulang dari HP (sinyal putus) tidak membuat bon dobel.
    if (!lama && req.idBaru && semua.some(function (b) { return b.id === teks_(req.idBaru); })) return bonDaftar_(ss, akses);
    var isi = {'Tanggal': tglDariIso_(tgl), 'Arah': arah, 'Nama': nama, 'Untuk': untuk, 'Jumlah (Rp)': Math.round(jumlah),
      'Jatuh tempo': tempo ? tglDariIso_(tempo) : '', 'Keterangan': teks_(req.keterangan), 'Bentuk': bentuk, 'Masuk Kas': masukKas, 'Kategori kas': kategoriKas};
    var r, peringatan = '';
    if (lama) {
      r = lama.baris;
      var baris = sh.getRange(r, 1, 1, kepala.length).getValues()[0];
      var teksLama = JSON.stringify(bonUntukAplikasi_(lama));
      Object.keys(isi).forEach(function (h) { var j = kepala.indexOf(h); if (j >= 0) baris[j] = isi[h]; });
      var jOleh = kepala.indexOf('Diisi oleh');
      if (jOleh >= 0) {
        var oleh = String(baris[jOleh] || '').replace(/ \(diubah .*\)$/, '');
        baris[jOleh] = oleh + (oleh === akses.nama ? '' : ' (diubah ' + akses.nama + ')');
      }
      sh.getRange(r, 1, 1, kepala.length).setValues([baris]);
      lama.jumlah = Math.round(jumlah);
      lama.tgl = tgl; lama.arah = arah; lama.nama = nama; lama.untuk = untuk; lama.bentuk = bentuk; lama.masukKas = masukKas === 'Ya'; lama.kategoriKas = kategoriKas;
      hitungBon_(lama);
      tulisHitunganBon_(sh, lama);
      catatLog_(ss, 'Ubah bon', SH_BON, r, teksLama, JSON.stringify(isi), akses.nama);
      peringatan = samakanKasBon_(ss, lama, akses);
    } else {
      isi['ID'] = teks_(req.idBaru) || idBaru_();
      isi['Timestamp'] = new Date();
      isi['Diisi oleh'] = akses.nama;
      isi['Dibayar (Rp)'] = 0; isi['Sisa (Rp)'] = Math.round(jumlah); isi['Status'] = 'Belum lunas'; isi['Tanggal lunas'] = '';
      sh.insertRowBefore(2);
      sh.getRange(2, 1, 1, kepala.length).setValues([kepala.map(function (h) { return isi[h] === undefined ? '' : isi[h]; })]);
      formatBarisBon_(sh, 2, kepala);
      catatLog_(ss, 'Tambah bon', SH_BON, 2, '', JSON.stringify({arah: arah, nama: nama, untuk: untuk, jumlah: Math.round(jumlah), tanggal: tgl}), akses.nama);
      peringatan = samakanKasBon_(ss, {id: isi['ID'], tgl: tgl, arah: arah, nama: nama, untuk: untuk, jumlah: Math.round(jumlah), bentuk: bentuk,
        masukKas: masukKas === 'Ya', kategoriKas: kategoriKas, bayar: []}, akses);
    }
    return hasilBon_(ss, akses, peringatan);
  });
}

function cekBayarBon_(req) {
  var tgl = teks_(req.tanggal);
  var jumlah = typeof req.jumlah === 'number' ? req.jumlah : angka_(req.jumlah);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return 'Tanggal bayar wajib diisi.';
  if (galatTanggal_(tgl)) return galatTanggal_(tgl);
  if (!(jumlah > 0)) return 'Jumlah bayar wajib diisi.';
  return '';
}

// Menulis satu pembayaran untuk bon b (baris Bayar Bon, hitungan bon, dan baris Kas). Hasil: teks peringatan Kas atau ''.
function tambahBayarBon_(ss, akses, b, id, tgl, jumlah, cara, ket) {
  var sh = siapkanBon_(ss, SH_BAYAR_BON, KEPALA_BAYAR_BON);
  var kepala = kepalaSheet_(sh);
  var isi = {'ID': id, 'Timestamp': new Date(), 'Tanggal': tglDariIso_(tgl), 'ID bon': b.id, 'Nama': b.nama,
    'Jumlah (Rp)': Math.round(jumlah), 'Cara': cara, 'Keterangan': ket, 'Diisi oleh': akses.nama};
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, kepala.length).setValues([kepala.map(function (h) { return isi[h] === undefined ? '' : isi[h]; })]);
  formatBarisBon_(sh, 2, kepala);
  var p = {id: id, w: Date.now(), tgl: tgl, jumlah: Math.round(jumlah), cara: cara};
  b.bayar.push(p);
  hitungBon_(b);
  tulisHitunganBon_(ss.getSheetByName(SH_BON), b);
  catatLog_(ss, 'Bayar bon', SH_BAYAR_BON, 2, '', JSON.stringify({nama: b.nama, untuk: b.untuk, jumlah: Math.round(jumlah), cara: cara, tanggal: tgl, sisa: b.sisa}), akses.nama);
  return aturKasBon_(ss, tandaKasBayar_(id), kasUntukBayar_(ss, b, p), akses);
}

// Bayar satu bon tertentu (cicil atau lunas).
function bonBayar_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mencatat pembayaran bon.'};
  var g = cekBayarBon_(req);
  if (g) return {ok: false, galat: g};
  var jumlah = Math.round(typeof req.jumlah === 'number' ? req.jumlah : angka_(req.jumlah));
  return denganKunci_(function () {
    var semua = bacaBon_(ss);
    var b = semua.filter(function (x) { return x.id === teks_(req.idBon); })[0];
    if (!b) return {ok: false, kode: 'BERUBAH', galat: 'Bon ini sudah terhapus. Muat ulang, lalu coba lagi.'};
    if (req.idBaru && b.bayar.some(function (p) { return p.id === teks_(req.idBaru); })) return bonDaftar_(ss, akses);
    if (jumlah > b.sisa) return {ok: false, galat: 'Lebih dari sisa bon (' + rpTeks_(b.sisa) + ').'};
    var pesan = tambahBayarBon_(ss, akses, b, teks_(req.idBaru) || idBaru_(), teks_(req.tanggal), jumlah, teks_(req.cara) || 'Tunai', teks_(req.keterangan));
    return hasilBon_(ss, akses, pesan);
  });
}

// Bayar bon satu orang sekaligus (cicil atau lunas). Uangnya dipakai untuk bon yang paling lama dulu.
function bonBayarOrang_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mencatat pembayaran bon.'};
  var g = cekBayarBon_(req);
  if (g) return {ok: false, galat: g};
  var nama = teks_(req.nama), arah = teks_(req.arah);
  if (!nama || ARAH_BON.indexOf(arah) < 0) return {ok: false, galat: 'Nama dan arah bon wajib diisi.'};
  var jumlah = Math.round(typeof req.jumlah === 'number' ? req.jumlah : angka_(req.jumlah));
  return denganKunci_(function () {
    var semua = bacaBon_(ss).filter(function (b) { return b.arah === arah && b.nama === nama; });
    var idDasar = teks_(req.idBaru) || idBaru_();
    // Kirim ulang dari HP (sinyal putus) tidak membuat pembayaran dobel.
    if (req.idBaru && semua.some(function (b) { return b.bayar.some(function (p) { return p.id.indexOf(idDasar + '-') === 0; }); })) return bonDaftar_(ss, akses);
    var terbuka = semua.filter(function (b) { return b.sisa > 0; }).sort(function (p, q) { return p.tgl < q.tgl ? -1 : p.tgl > q.tgl ? 1 : p.w - q.w; });
    if (!terbuka.length) return {ok: false, kode: 'BERUBAH', galat: nama + ' tidak punya bon yang belum lunas. Muat ulang, lalu coba lagi.'};
    var total = terbuka.reduce(function (t, b) { return t + b.sisa; }, 0);
    if (jumlah > total) return {ok: false, galat: 'Lebih dari sisa bon ' + nama + ' (' + rpTeks_(total) + ').'};
    var sisa = jumlah, pesan = [];
    terbuka.forEach(function (b, i) {
      if (sisa <= 0) return;
      var x = Math.min(b.sisa, sisa);
      pesan.push(tambahBayarBon_(ss, akses, b, idDasar + '-' + (i + 1), teks_(req.tanggal), x, teks_(req.cara) || 'Tunai', teks_(req.keterangan)));
      sisa -= x;
    });
    return hasilBon_(ss, akses, pesan.filter(function (x) { return x; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' '));
  });
}

// Menghapus bon (beserta semua pembayarannya) atau satu pembayaran. Isinya tetap tercatat di Log Aplikasi.
function bonHapus_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa menghapus bon.'};
  return denganKunci_(function () {
    var semua = bacaBon_(ss);
    var shB = ss.getSheetByName(SH_BON), shP = ss.getSheetByName(SH_BAYAR_BON);
    if (req.jenis === 'bayar') {
      var b = null, p = null;
      semua.forEach(function (x) { x.bayar.forEach(function (y) { if (y.id === teks_(req.id)) { b = x; p = y; } }); });
      if (!p) return {ok: false, kode: 'BERUBAH', galat: 'Pembayaran ini sudah terhapus. Muat ulang, lalu coba lagi.'};
      shP.deleteRow(p.baris);
      aturKasBon_(ss, tandaKasBayar_(p.id), null, akses);
      b.bayar = b.bayar.filter(function (y) { return y !== p; });
      hitungBon_(b);
      tulisHitunganBon_(shB, b);
      catatLog_(ss, 'Hapus bayar bon', SH_BAYAR_BON, p.baris, JSON.stringify({nama: b.nama, untuk: b.untuk, jumlah: p.jumlah, cara: p.cara, tanggal: p.tgl}), '', akses.nama);
      return bonDaftar_(ss, akses);
    }
    var bon = semua.filter(function (x) { return x.id === teks_(req.id); })[0];
    if (!bon) return {ok: false, kode: 'BERUBAH', galat: 'Bon ini sudah terhapus. Muat ulang, lalu coba lagi.'};
    bon.bayar.map(function (y) { return y.baris; }).sort(function (a, c) { return c - a; }).forEach(function (r) { shP.deleteRow(r); });
    shB.deleteRow(bon.baris);
    aturKasBon_(ss, tandaKasBon_(bon.id), null, akses);
    bon.bayar.forEach(function (y) { aturKasBon_(ss, tandaKasBayar_(y.id), null, akses); });
    catatLog_(ss, 'Hapus bon', SH_BON, bon.baris, JSON.stringify(bonUntukAplikasi_(bon)), '', akses.nama);
    return bonDaftar_(ss, akses);
  });
}

// ---------------------------------------------------------------- BATAS PERINGATAN
// Batas peringatan Dashboard (baris 15-23) diubah dari aplikasi. Angkanya tetap di sel yang sama:
// tab Pengaturan kolom B (sel kuning) dan Dashboard kolom D yang isinya angka biasa.
// Sebelum menulis, judul barisnya dicek supaya tidak menimpa sel lain kalau susunan sheet berubah.
// jenis: persen (aplikasi mengirim 15 untuk 15%), angka, rupiah. baris = baris peringatannya di Dashboard.
// ---------------------------------------------------------------- DATA PEMBELI
// Satu baris per pembeli di tab "Data Pembeli" (semua kolom teks, supaya No HP 08... tidak berubah jadi angka).
// Daftar pembeli di aplikasi = gabungan tab Data Pembeli, daftar pilihan "Pembeli", dan nama pembeli di tab Penjualan.
// Nama dicocokkan tanpa beda huruf besar/kecil. Total pembelian dari tab Penjualan (Total (Rp), atau Jumlah × Harga).

function siapkanPembeli_(ss) {
  var sh = ss.getSheetByName(SH_PEMBELI);
  if (sh) return sh;
  sh = ss.insertSheet(SH_PEMBELI);
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 2), KEPALA_PEMBELI.length).setNumberFormat('@');
  sh.getRange(1, 1, 1, KEPALA_PEMBELI.length).setValues([KEPALA_PEMBELI]).setFontWeight('bold');
  sh.getRange(2, 2, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sh.setFrozenRows(1);
  catatLog_(ss, 'Buat tab', SH_PEMBELI, '', '', KEPALA_PEMBELI.join(', '), 'Sistem');
  return sh;
}

function bacaKontakPembeli_(ss) {
  var sh = ss.getSheetByName(SH_PEMBELI);
  if (!sh || sh.getLastRow() < 2) return [];
  var kepala = kepalaSheet_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getValues().map(function (r, i) {
    var g = function (h) { var j = kepala.indexOf(h); return j >= 0 ? r[j] : ''; };
    var w = g('Timestamp');
    return {baris: i + 2, id: teks_(g('ID')), nama: teks_(g('Nama')), jenis: teks_(g('Jenis')), kontak: teks_(g('Nama kontak')),
      hp: teks_(g('No HP')), email: teks_(g('Email')), alamat: teks_(g('Alamat')), web: teks_(g('Website')), catatan: teks_(g('Catatan')),
      diubah: adalahTanggal_(w) ? Utilities.formatDate(w, API_ZONA, 'dd/MM/yyyy HH:mm') : teks_(w), oleh: teks_(g('Diubah oleh'))};
  }).filter(function (p) { return p.nama; });
}

function pilihanPembeli_(ss) {
  return bacaMaster_(ss, 'Pilihan').filter(function (m) { return m.nilai['Daftar'] === 'Pembeli'; });
}

function pembeliDaftar_(ss, akses) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa melihat data pembeli.'};
  var peta = {}, urut = [];
  var ambil = function (nama) {
    var k = normalNama_(nama);
    if (!k) return null;
    if (!peta[k]) {
      peta[k] = {key: k, nama: teks_(nama), id: '', jenis: '', kontak: '', hp: '', email: '', alamat: '', web: '', catatan: '', diubah: '', oleh: '',
        adaKontak: false, diDaftar: false, total: 0, trx: 0, satuan: {}, pertama: '', terakhir: '', belumLunas: 0, beli: []};
      urut.push(k);
    }
    return peta[k];
  };
  bacaKontakPembeli_(ss).forEach(function (c) {
    var p = ambil(c.nama);
    ['id', 'jenis', 'kontak', 'hp', 'email', 'alamat', 'web', 'catatan', 'diubah', 'oleh'].forEach(function (f) { p[f] = c[f]; });
    p.nama = c.nama; p.adaKontak = true;
  });
  pilihanPembeli_(ss).forEach(function (m) { var p = ambil(m.nilai['Pilihan']); if (p) p.diDaftar = true; });
  var produk = {};
  bacaMaster_(ss, 'Produk').forEach(function (m) { produk[m.nilai['Produk']] = m.nilai['Satuan'] || ''; });
  var sh = ss.getSheetByName('Penjualan');
  var semua = 0;
  if (sh && sh.getLastRow() >= 2) {
    var kepala = kepalaSheet_(sh);
    sh.getRange(2, 1, sh.getLastRow() - 1, kepala.length).getValues().forEach(function (r) {
      var g = function (h) { var j = kepala.indexOf(h); return j >= 0 ? r[j] : ''; };
      var tgl = tglKunci_(g('Tanggal')), nama = teks_(g('Pembeli'));
      if (!tgl || !nama) return;
      var p = ambil(nama);
      var jumlah = angka_(g('Jumlah')), harga = angka_(g('Harga satuan (Rp)'));
      var total = teks_(g('Total (Rp)')) !== '' ? angka_(g('Total (Rp)')) : Math.round(jumlah * harga);
      var satuan = teks_(g('Satuan')) || produk[teks_(g('Produk'))] || '';
      var status = teks_(g('Status bayar'));
      p.total += total; p.trx++; semua += total;
      if (satuan) p.satuan[satuan] = bulat_((p.satuan[satuan] || 0) + jumlah, 3);
      if (!p.pertama || tgl < p.pertama) p.pertama = tgl;
      if (!p.terakhir || tgl > p.terakhir) p.terakhir = tgl;
      if (status && status !== 'Lunas') p.belumLunas += total;
      p.beli.push({tgl: tgl, produk: teks_(g('Produk')), jumlah: jumlah, satuan: satuan, harga: harga, total: total, status: status, kirim: teks_(g('Pengiriman'))});
    });
  }
  var daftar = urut.map(function (k) {
    var p = peta[k];
    p.beli.sort(function (a, b) { return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : 0; });
    return p;
  });
  return {ok: true, daftar: daftar, totalSemua: semua, jenis: JENIS_PEMBELI};
}

// Nomor HP: angka, spasi, +, -, titik, kurung; minimal 8 angka.
function cekPembeli_(n) {
  if (!n.nama) return 'Nama pembeli wajib diisi.';
  if (n.nama.length > 80) return 'Nama terlalu panjang (paling banyak 80 huruf).';
  if (/[,\[\]|*?~]/.test(n.nama)) return 'Nama tidak boleh berisi koma, kurung siku, atau tanda | * ? ~.';
  if (n.jenis && JENIS_PEMBELI.indexOf(n.jenis) < 0) return 'Jenis pembeli tidak dikenal.';
  if (n.hp && (!/^[0-9+()\-. ]+$/.test(n.hp) || n.hp.replace(/[^0-9]/g, '').length < 8)) return 'No HP hanya angka, contoh 0812 3456 7890.';
  if (n.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n.email)) return 'Email belum benar, contoh nama@perusahaan.com.';
  if (n.web && (/\s/.test(n.web) || n.web.indexOf('.') < 0)) return 'Website belum benar, contoh www.perusahaan.com.';
  var batas = {kontak: 80, hp: 40, email: 120, alamat: 300, web: 200, catatan: 500};
  for (var k in batas) if (n[k].length > batas[k]) return 'Isian terlalu panjang.';
  return '';
}

function pembeliSimpan_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mengubah data pembeli.'};
  var v = req.nilai || {};
  var n = {nama: teks_(v['Nama']).replace(/\s+/g, ' '), jenis: teks_(v['Jenis']), kontak: teks_(v['Nama kontak']), hp: teks_(v['No HP']),
    email: teks_(v['Email']).toLowerCase(), alamat: teks_(v['Alamat']), web: teks_(v['Website']), catatan: teks_(v['Catatan'])};
  var galat = cekPembeli_(n);
  if (galat) return {ok: false, galat: galat};
  var hasil = denganKunci_(function () {
    var sh = siapkanPembeli_(ss);
    var semua = bacaKontakPembeli_(ss);
    var id = teks_(req.id);
    var lama = id ? semua.filter(function (c) { return c.id === id; })[0] : null;
    if (id && !lama) return {ok: false, galat: 'Data pembeli ini sudah berubah atau terhapus. Muat ulang.'};
    var kembar = semua.filter(function (c) { return c !== lama && normalNama_(c.nama) === normalNama_(n.nama); })[0];
    if (kembar) return {ok: false, galat: '"' + kembar.nama + '" sudah ada di data pembeli. Buka lalu ubah datanya.'};
    var pilihan = pilihanPembeli_(ss);
    var cariPilihan = function (nama) { return pilihan.filter(function (m) { return normalNama_(m.nilai['Pilihan']) === normalNama_(nama); })[0]; };
    var gantiNama = lama && normalNama_(lama.nama) !== normalNama_(n.nama);
    if (gantiNama) {
      // Nama yang sudah dipakai di Penjualan tidak diganti di sini: total pembelian dicocokkan lewat nama.
      var pj = bacaKolom_(ss, 'Penjualan', ['Pembeli']).some(function (r) { return normalNama_(r[0]) === normalNama_(lama.nama); });
      if (pj) return {ok: false, galat: 'Nama "' + lama.nama + '" sudah dipakai di catatan Penjualan, jadi tidak bisa diganti di sini supaya total pembeliannya tetap cocok. Tulis nama orangnya di "Nama kontak".'};
    }
    var kepala = kepalaSheet_(sh);
    var isi = {'ID': lama ? lama.id : idBaru_(), 'Timestamp': new Date(), 'Nama': n.nama, 'Jenis': n.jenis, 'Nama kontak': n.kontak, 'No HP': n.hp,
      'Email': n.email, 'Alamat': n.alamat, 'Website': n.web, 'Catatan': n.catatan, 'Diubah oleh': akses.nama};
    var baris = lama ? lama.baris : sh.getLastRow() + 1;
    pastikanBaris_(sh, baris);
    var row = kepala.map(function (h) { return isi[h] === undefined ? '' : isi[h]; });
    sh.getRange(baris, 1, 1, row.length).setNumberFormat('@');
    var jw = kepala.indexOf('Timestamp');
    if (jw >= 0) sh.getRange(baris, jw + 1).setNumberFormat('dd/MM/yyyy HH:mm');
    sh.getRange(baris, 1, 1, row.length).setValues([row]);
    // Supaya bisa dipilih di formulir Penjualan: nama baru ditambahkan ke daftar pilihan "Pembeli".
    var keDaftar = false;
    if (gantiNama && cariPilihan(lama.nama) && !cariPilihan(n.nama)) {
      tulisMaster_(ss, 'Pilihan', cariPilihan(lama.nama), {'Daftar': 'Pembeli', 'Pilihan': n.nama});
      keDaftar = true;
    } else if (!cariPilihan(n.nama)) {
      tambahMaster_(ss, 'Pilihan', {'Daftar': 'Pembeli', 'Pilihan': n.nama}, bacaMaster_(ss, 'Pilihan'));
      keDaftar = true;
    }
    catatLog_(ss, lama ? 'Ubah pembeli' : 'Tambah pembeli', SH_PEMBELI, baris, lama ? JSON.stringify(lama) : '', JSON.stringify(n), akses.nama);
    return {ok: true, id: isi['ID'], daftarBerubah: keDaftar};
  });
  if (!hasil.ok) return hasil;
  var r = pembeliDaftar_(ss, akses);
  r.id = hasil.id; r.daftarBerubah = hasil.daftarBerubah;
  return r;
}

// Menghapus kontak saja. Catatan Penjualan dan daftar pilihan Pembeli tidak diubah.
function pembeliHapus_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur yang bisa mengubah data pembeli.'};
  var hasil = denganKunci_(function () {
    var sh = ss.getSheetByName(SH_PEMBELI);
    var c = bacaKontakPembeli_(ss).filter(function (x) { return x.id && x.id === teks_(req.id); })[0];
    if (!sh || !c) return {ok: false, galat: 'Data pembeli ini sudah terhapus. Muat ulang.'};
    sh.deleteRow(c.baris);
    catatLog_(ss, 'Hapus pembeli', SH_PEMBELI, c.baris, JSON.stringify(c), '', akses.nama);
    return {ok: true};
  });
  return hasil.ok ? pembeliDaftar_(ss, akses) : hasil;
}

var BATAS_PERINGATAN = [
  {k: 'hargaBahan', sh: 'Pengaturan', sel: 'B6', judul: 'A6', cek: /harga bahan/i, jenis: 'persen', min: 1, maks: 100, baris: 15},
  {k: 'rendemen', sh: 'Pengaturan', sel: 'B7', judul: 'A7', cek: /rendemen/i, jenis: 'persen', min: 1, maks: 100, baris: 16},
  {k: 'ketelKosong', sh: 'Pengaturan', sel: 'B8', judul: 'A8', cek: /ketel kosong/i, jenis: 'angka', min: 1, maks: 7, baris: 17},
  {k: 'laba', sh: 'Dashboard', sel: 'D18', judul: 'A18', cek: /^laba usaha/i, jenis: 'rupiah', min: 0, maks: 1e10, baris: 18},
  {k: 'periodeLaba', sh: 'Pengaturan', sel: 'B16', judul: 'A16', cek: /periode laba/i, jenis: 'angka', min: 1, maks: 4, baris: 18, bawaan: 1,
    buat: ['Periode laba di peringatan (minggu)', 'Laba usaha di peringatan dijumlah untuk sekian minggu penuh terakhir. 1 = minggu terakhir saja.']},
  {k: 'pangsa', sh: 'Pengaturan', sel: 'B9', judul: 'A9', cek: /pangsa/i, jenis: 'persen', min: 10, maks: 100, baris: 19},
  {k: 'periodePangsa', sh: 'Pengaturan', sel: 'B11', judul: 'A11', cek: /periode pangsa/i, jenis: 'angka', min: 7, maks: 365, baris: 19},
  {k: 'jatahKeluarga', sh: 'Pengaturan', sel: 'B10', judul: 'A10', cek: /keluarga/i, jenis: 'rupiah', min: 0, maks: 1e10, bolehKosong: true, baris: 20},
  {k: 'belumDibayar', sh: 'Dashboard', sel: 'D21', judul: 'A21', cek: /belum dibayar/i, jenis: 'rupiah', min: 0, maks: 1e10, baris: 21},
  {k: 'keterangan', sh: 'Dashboard', sel: 'D22', judul: 'A22', cek: /keterangan/i, jenis: 'angka', min: 0, maks: 500, baris: 22},
  {k: 'kasTanpaKategori', sh: 'Dashboard', sel: 'D23', judul: 'A23', cek: /tanpa kategori/i, jenis: 'angka', min: 0, maks: 500, baris: 23}
];

// Memeriksa satu batas: sheet ada, judul baris cocok, sel batas berisi angka (bukan rumus). Kembali '' kalau aman.
function periksaBatas_(ss, b) {
  var sh = ss.getSheetByName(b.sh);
  if (!sh) return 'Tab ' + b.sh + ' tidak ada.';
  var judul = teks_(sh.getRange(b.judul).getDisplayValue());
  if (!judul && b.buat) return '';
  if (!b.cek.test(judul)) return 'Susunan tab ' + b.sh + ' berubah (' + b.judul + ': "' + judul + '"). Ubah langsung di Google Sheet.';
  if (teks_(sh.getRange(b.sel).getFormulas()[0][0])) return b.sh + '!' + b.sel + ' berisi rumus. Ubah langsung di Google Sheet.';
  return '';
}

function daftarBatas_(ss) {
  var dash = ss.getSheetByName('Dashboard');
  var status = dash ? dash.getRange('A15:F23').getDisplayValues() : [];
  return BATAS_PERINGATAN.map(function (b) {
    var rusak = periksaBatas_(ss, b);
    var sh = ss.getSheetByName(b.sh);
    var v = !rusak && sh ? sh.getRange(b.sel).getValue() : '';
    var nilai = teks_(v) === '' ? (b.bawaan !== undefined ? b.bawaan : null) : angka_(v);
    if (nilai !== null && b.jenis === 'persen') nilai = bulat_(Math.abs(nilai) * 100, 2);
    var r = status[b.baris - 15] || [];
    return {k: b.k, jenis: b.jenis, nilai: nilai, min: b.min, maks: b.maks, bolehKosong: !!b.bolehKosong, rusak: rusak || undefined,
      sekarang: {hal: teks_(r[0]), nilai: teks_(r[2]), status: teks_(r[4]), saran: teks_(r[5])}};
  });
}

function batas_(ss, akses) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur.'};
  return {ok: true, batas: daftarBatas_(ss)};
}

// req.nilai = {kunci: angka atau ''}. Hanya kunci yang dikirim yang diubah.
function batasSimpan_(ss, akses, req) {
  if (!akses.admin) return {ok: false, galat: 'Hanya pemilik atau pengguna yang boleh mengatur.'};
  var nilai = req.nilai || {};
  var tulis = [], salah = {};
  BATAS_PERINGATAN.forEach(function (b) {
    if (!(b.k in nilai)) return;
    var mentah = nilai[b.k];
    var kosong = mentah === '' || mentah === null || mentah === undefined;
    if (kosong && !b.bolehKosong) { salah[b.k] = 'Wajib diisi.'; return; }
    var x = kosong ? '' : (typeof mentah === 'number' ? mentah : angka_(mentah));
    if (!kosong && (!isFinite(x) || x < b.min || x > b.maks)) {
      salah[b.k] = 'Isi angka ' + b.min + ' sampai ' + (b.maks >= 1e9 ? 'berapa saja' : b.maks) + (b.jenis === 'persen' ? ' (persen)' : '') + '.';
      return;
    }
    if (!kosong && b.jenis !== 'persen' && Math.floor(x) !== x) { salah[b.k] = 'Tulis angka bulat.'; return; }
    var rusak = periksaBatas_(ss, b);
    if (rusak) { salah[b.k] = rusak; return; }
    tulis.push({b: b, nilai: kosong ? '' : (b.jenis === 'persen' ? bulat_(x / 100, 4) : x)});
  });
  if (Object.keys(salah).length) return {ok: false, galat: 'Ada batas yang belum benar.', salah: salah};
  var lama = {}, baru = {};
  tulis.forEach(function (t) {
    var sh = ss.getSheetByName(t.b.sh);
    var sel = sh.getRange(t.b.sel);
    lama[t.b.k] = sel.getValue();
    if (t.b.buat && !teks_(sh.getRange(t.b.judul).getDisplayValue())) {
      var baris = +t.b.judul.replace(/\D/g, '');
      sh.getRange(baris, 1).setValue(t.b.buat[0]);
      sh.getRange(baris, 3).setValue(t.b.buat[1]);
      sel.setNumberFormat('0');
    }
    sel.setValue(t.nilai);
    baru[t.b.k] = t.nilai;
  });
  if (tulis.length) {
    SpreadsheetApp.flush();
    catatLog_(ss, 'Ubah batas peringatan', 'Pengaturan/Dashboard', 0, JSON.stringify(lama), JSON.stringify(baru), akses.nama);
  }
  return {ok: true, batas: daftarBatas_(ss)};
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
