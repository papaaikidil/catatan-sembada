// =====================================================================
// SEMBADA KARYA WANGI - API untuk aplikasi Catatan Sembada
//
// Tempel file ini sebagai file baru bernama "api" di project Apps Script
// "Sembada Sheet" (project yang sama dengan kode form dan urut_otomatis).
// Lalu: Terapkan > Deployment baru > Aplikasi web
//   - Jalankan sebagai: Saya
//   - Yang memiliki akses: Siapa saja
//
// Aplikasi mengirim semua permintaan lewat POST dengan PIN.
// PIN dan hak isi diatur di tab Pengaturan, baris 20 sampai 29.
// =====================================================================

var API_ID_SHEET = '11erbcsOh7G0BKWFLmsGqvWNcQiyz0mSogFLX5AS_8AI';
var API_ZONA = 'Asia/Jakarta';
var API_TAB = ['Ambil Bahan', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
var API_VERSI = 1;
var API_BATAS_GAGAL = 30;      // PIN salah sebanyak ini dalam 15 menit = dikunci sementara
var API_SIMPAN_ID = 300;       // jumlah id entri terakhir yang diingat untuk mencegah dobel

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
  var akses = cekPin_(ss, req.pin);
  if (akses && akses.kunci) return {ok: false, kode: 'KUNCI', galat: 'Terlalu banyak PIN salah. Coba lagi 15 menit lagi.'};
  if (!akses) return {ok: false, kode: 'PIN', galat: 'PIN salah.'};

  if (req.aksi === 'masuk') return {ok: true, peran: akses.peran, tab: akses.tab, semua: akses.semua, versiApi: API_VERSI};
  if (req.aksi === 'config') return config_(ss, akses);
  if (req.aksi === 'simpan') return simpan_(ss, akses, req);
  if (req.aksi === 'terbaru') return terbaru_(ss, akses, req);
  if (req.aksi === 'ringkasan') return ringkasan_(ss, akses);
  return {ok: false, galat: 'Aksi tidak dikenal: ' + req.aksi};
}

// ---------------------------------------------------------------- PIN

function cekPin_(ss, pin) {
  var cache = CacheService.getScriptCache();
  var gagal = Number(cache.get('pinGagal') || 0);
  if (gagal >= API_BATAS_GAGAL) return {kunci: true};

  pin = String(pin === undefined || pin === null ? '' : pin).trim();
  if (pin) {
    var baris = ss.getSheetByName('Pengaturan').getRange('A20:C29').getDisplayValues();
    for (var i = 0; i < baris.length; i++) {
      var p = String(baris[i][1]).trim();
      if (p && p === pin) {
        var boleh = String(baris[i][2]).trim();
        var semua = boleh.toLowerCase() === 'semua';
        var tab = semua ? API_TAB.slice() : boleh.split(',').map(function (t) { return t.trim(); })
          .filter(function (t) { return API_TAB.indexOf(t) >= 0; });
        return {peran: String(baris[i][0]).trim(), tab: tab, semua: semua};
      }
    }
  }
  cache.put('pinGagal', String(gagal + 1), 900);
  return null;
}

// ---------------------------------------------------------------- CONFIG

function config_(ss, akses) {
  var daftar = {};
  var satuanProduk = {};
  var arahKas = {};
  var sh = ss.getSheetByName('Daftar');
  var nilai = sh.getDataRange().getDisplayValues();
  var kepala = nilai[0];
  for (var c = 0; c < kepala.length; c++) {
    var k = String(kepala[c]).trim();
    if (!k) continue;
    var isi = [];
    for (var r = 1; r < nilai.length; r++) {
      var v = String(nilai[r][c]).trim();
      if (v) isi.push(v);
    }
    daftar[k] = isi;
  }
  var cProduk = kepala.indexOf('Produk'), cSatuan = kepala.indexOf('Satuan');
  var cKategori = kepala.indexOf('Kategori kas'), cArah = kepala.indexOf('Arah');
  for (var b = 1; b < nilai.length; b++) {
    if (cProduk >= 0 && cSatuan >= 0 && nilai[b][cProduk]) satuanProduk[String(nilai[b][cProduk]).trim()] = String(nilai[b][cSatuan]).trim();
    if (cKategori >= 0 && cArah >= 0 && nilai[b][cKategori]) arahKas[String(nilai[b][cKategori]).trim()] = String(nilai[b][cArah]).trim();
  }

  var tarif = [];
  var tsh = ss.getSheetByName('Tarif Upah');
  var tn = Math.max(tsh.getLastRow() - 1, 1);
  tsh.getRange(2, 1, tn, 3).getValues().forEach(function (row) {
    var pilihan = String(row[0]).trim();
    if (pilihan) tarif.push({pilihan: pilihan, untuk: String(row[1]).trim(), upah: Number(row[2]) || 0});
  });

  var kepalaTab = {};
  akses.tab.forEach(function (t) {
    var s = ss.getSheetByName(t);
    if (s) kepalaTab[t] = kolomForm_(s).kepala;
  });

  return {ok: true, peran: akses.peran, tab: akses.tab, semua: akses.semua, versiApi: API_VERSI,
    daftar: daftar, satuanProduk: satuanProduk, arahKas: arahKas, tarif: tarif, kepala: kepalaTab};
}

// Kolom isian form: kolom B (Timestamp) sampai sebelum kolom rumus (abu-abu) pertama.
function kolomForm_(sh) {
  var lastCol = sh.getLastColumn();
  var judul = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var rumus = sh.getRange(1, 1, 1, lastCol).getFormulas()[0];
  var akhir = 2;                                   // indeks 0-based, mulai dari kolom C
  while (akhir < lastCol && rumus[akhir] === '') akhir++;
  return {kepala: judul.slice(1, akhir).map(function (j) { return String(j).trim(); }), lastCol: lastCol};
}

// ---------------------------------------------------------------- SIMPAN

function simpan_(ss, akses, req) {
  var tab = String(req.tab || '');
  if (akses.tab.indexOf(tab) < 0) return {ok: false, galat: 'PIN ini tidak boleh mengisi ' + tab + '.'};
  var nilai = req.nilai || {};
  var id = String(req.id || '');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var props = PropertiesService.getScriptProperties();
    var ids = [];
    try { ids = JSON.parse(props.getProperty('idMasuk') || '[]'); } catch (e) { ids = []; }
    if (id && ids.indexOf(id) >= 0) return {ok: true, dobel: true};

    var sh = ss.getSheetByName(tab);
    var info = kolomForm_(sh);
    var baris = susunBaris_(info.kepala, nilai, new Date());
    if (baris.asing.length) {
      return {ok: false, galat: 'Kolom tidak ditemukan di tab ' + tab + ': ' + baris.asing.join(', ') +
        '. Buka menu Akun > Perbarui pilihan, lalu kirim ulang.'};
    }
    sh.insertRowBefore(2);
    sh.getRange(2, 2, 1, baris.isi.length).setValues([baris.isi]);
    SpreadsheetApp.flush();
    if (typeof urutkanTab_ === 'function') {
      urutkanTab_(sh);                             // dari urut_otomatis.gs: urutkan + rapikan format
    } else if (sh.getLastRow() >= 3) {
      sh.getRange(3, 1, 1, info.lastCol).copyTo(sh.getRange(2, 1, 1, info.lastCol),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    }

    if (id) {
      ids.push(id);
      if (ids.length > API_SIMPAN_ID) ids = ids.slice(ids.length - API_SIMPAN_ID);
      props.setProperty('idMasuk', JSON.stringify(ids));
    }
    return {ok: true};
  } finally {
    lock.releaseLock();
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
  if (/^Tanggal/.test(judul) && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return Utilities.parseDate(s, API_ZONA, 'yyyy-MM-dd');
  }
  return s;
}

// ---------------------------------------------------------------- TERBARU

function terbaru_(ss, akses, req) {
  var tab = String(req.tab || '');
  if (akses.tab.indexOf(tab) < 0) return {ok: false, galat: 'PIN ini tidak boleh melihat ' + tab + '.'};
  var n = Math.max(1, Math.min(Number(req.n) || 10, 30));
  var sh = ss.getSheetByName(tab);
  var lastCol = sh.getLastColumn();
  var kepala = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var baris = sh.getRange(2, 1, n, lastCol).getDisplayValues().filter(function (r) { return r[1] || r[2]; });
  return {ok: true, tab: tab, kepala: kepala, baris: baris};
}

// ---------------------------------------------------------------- RINGKASAN

function ringkasan_(ss, akses) {
  if (!akses.semua) return {ok: false, galat: 'Ringkasan hanya untuk pemilik.'};
  var dash = ss.getSheetByName('Dashboard');
  var rek = ss.getSheetByName('Rekap Mingguan');
  var rekBln = ss.getSheetByName('Rekap Bulanan');
  var tgl = function (d) { return d instanceof Date ? Utilities.formatDate(d, API_ZONA, 'dd/MM/yyyy') : String(d || ''); };
  var angka = function (v) { return typeof v === 'number' ? v : null; };

  var minggu = function (r) {
    if (!(r >= 5)) return null;
    var v = rek.getRange(r, 1, 1, 26).getValues()[0];
    return {mulai: tgl(v[0]), sampai: tgl(v[1]), trip: angka(v[2]), bahanKg: angka(v[3]), beliBahan: angka(v[4]),
      hargaBahan: angka(v[5]), biayaJalan: angka(v[6]), sulingan: angka(v[7]), ketelKosong: angka(v[8]),
      minyak: angka(v[10]), minyakPerSulingan: angka(v[11]), rendemen: angka(v[12]), upahPengumpul: angka(v[13]),
      upahPenyuling: angka(v[14]), operasional: angka(v[15]), biayaProduksi: angka(v[16]), biayaPerKg: angka(v[17]),
      terjual: angka(v[18]), penjualan: angka(v[19]), laba: angka(v[20]), upahHarian: angka(v[21])};
  };
  var bulan = function (r) {
    if (!(r >= 5)) return null;
    var v = rekBln.getRange(r, 1, 1, 31).getValues()[0];
    return {bulan: v[0] instanceof Date ? Utilities.formatDate(v[0], API_ZONA, 'MM/yyyy') : String(v[0]),
      penjualan: angka(v[19]), biayaProduksi: angka(v[16]), laba: angka(v[20]), pengembangan: angka(v[21]),
      cicilan: angka(v[22]), labaSetelahCicilan: angka(v[23]), keluarga: angka(v[24]), proyekBahan: angka(v[25]),
      upahHarian: angka(v[26]), pembiayaan: angka(v[27]), pemasukanLain: angka(v[28]), belumDibayar: angka(v[29]),
      perubahanKas: angka(v[30])};
  };

  var peringatan = dash.getRange('A15:F23').getDisplayValues().map(function (r) {
    return {hal: r[0], nilai: r[2], batas: r[3], status: r[4], saran: r[5]};
  }).filter(function (p) { return p.hal; });

  return {ok: true, dataSampai: dash.getRange('B2').getDisplayValue(),
    mingguBerjalan: minggu(Number(dash.getRange('N5').getValue())),
    mingguPenuh: minggu(Number(dash.getRange('N6').getValue())),
    bulanIni: bulan(Number(dash.getRange('N8').getValue())),
    peringatan: peringatan};
}
