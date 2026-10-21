// =====================================================================
// SEMBADA KARYA WANGI - API untuk aplikasi Catatan Sembada
//
// Tempel file ini sebagai file baru bernama "api" di project Apps Script
// "Sembada Sheet" (project yang sama dengan kode form dan urut_otomatis).
// Lalu: Terapkan > Deployment baru > Aplikasi web
//   - Jalankan sebagai: Saya
//   - Yang memiliki akses: Siapa saja
//
// Kalau kode ini diperbarui: Terapkan > Kelola deployment > ikon pensil >
// Versi: "Versi baru" > Terapkan. Alamat /exec tetap sama.
//
// Aplikasi mengirim semua permintaan lewat POST dengan PIN.
// PIN dan hak isi diatur di tab Pengaturan, baris 20 sampai 29.
// Kolom E ("Absensi khusus"): isi Pengumpul atau Tim suling supaya PIN itu hanya
// bisa mengabsen kelompoknya sendiri dengan pilihan sesuai jobdesk. Kosong = semua.
// =====================================================================

var API_ID_SHEET = '11erbcsOh7G0BKWFLmsGqvWNcQiyz0mSogFLX5AS_8AI';
var API_ZONA = 'Asia/Jakarta';
var API_TAB = ['Ambil Bahan', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
var API_VERSI = 5;
var API_LOG = 'Log Aplikasi';   // tab tersembunyi: catatan setiap perubahan dan penghapusan
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

  if (req.aksi === 'masuk') return {ok: true, peran: akses.peran, tab: akses.tab, semua: akses.semua,
    kelompokAbsensi: akses.kelompokAbsensi, versiApi: API_VERSI};
  if (req.aksi === 'config') return config_(ss, akses);
  if (req.aksi === 'simpan') return simpan_(ss, akses, req);
  if (req.aksi === 'terbaru') return terbaru_(ss, akses, req);
  if (req.aksi === 'ringkasan') return ringkasan_(ss, akses);
  if (req.aksi === 'pinDaftar') return pinDaftar_(ss, akses);
  if (req.aksi === 'pinUbah') return pinUbah_(ss, akses, req);
  if (req.aksi === 'ubah') return ubah_(ss, akses, req);
  if (req.aksi === 'hapus') return hapus_(ss, akses, req);
  return {ok: false, galat: 'Aksi tidak dikenal: ' + req.aksi};
}

// ---------------------------------------------------------------- PIN

function cekPin_(ss, pin) {
  var cache = CacheService.getScriptCache();
  var gagal = Number(cache.get('pinGagal') || 0);
  if (gagal >= API_BATAS_GAGAL) return {kunci: true};

  pin = String(pin === undefined || pin === null ? '' : pin).trim();
  if (pin) {
    var baris = ss.getSheetByName('Pengaturan').getRange('A20:E29').getDisplayValues();
    for (var i = 0; i < baris.length; i++) {
      var p = String(baris[i][1]).trim();
      if (p && p === pin) {
        var boleh = String(baris[i][2]).trim();
        var semua = boleh.toLowerCase() === 'semua';
        var tab = semua ? API_TAB.slice() : boleh.split(',').map(function (t) { return t.trim(); })
          .filter(function (t) { return API_TAB.indexOf(t) >= 0; });
        var kelompok = semua ? '' : String(baris[i][4] || '').trim();
        return {peran: String(baris[i][0]).trim(), tab: tab, semua: semua, baris: 20 + i,
          kelompokAbsensi: tab.indexOf('Absensi') >= 0 ? kelompok : ''};
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

  var tarif = bacaTarifApi_(ss);

  var kepalaTab = {};
  akses.tab.forEach(function (t) {
    var s = ss.getSheetByName(t);
    if (s) kepalaTab[t] = kolomForm_(s).kepala;
  });

  return {ok: true, peran: akses.peran, tab: akses.tab, semua: akses.semua, versiApi: API_VERSI,
    kelompokAbsensi: akses.kelompokAbsensi, daftar: daftar, satuanProduk: satuanProduk, arahKas: arahKas, tarif: tarif, kepala: kepalaTab};
}

function bacaTarifApi_(ss) {
  var tarif = [];
  var tsh = ss.getSheetByName('Tarif Upah');
  var tn = Math.max(tsh.getLastRow() - 1, 1);
  tsh.getRange(2, 1, tn, 4).getValues().forEach(function (row) {
    var pilihan = String(row[0]).trim();
    if (pilihan) tarif.push({pilihan: pilihan, untuk: String(row[1]).trim(), upah: Number(row[2]) || 0, jenis: String(row[3]).trim()});
  });
  return tarif;
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
    var catatId = function () {
      if (!id) return;
      ids.push(id);
      if (ids.length > API_SIMPAN_ID) ids = ids.slice(ids.length - API_SIMPAN_ID);
      props.setProperty('idMasuk', JSON.stringify(ids));
    };
    if (tab === 'Absensi') {
      var larangan = cekAbsensiKelompok_(akses, nilai, bacaTarifApi_(ss));
      if (larangan) return {ok: false, galat: larangan};
      // Satu tanggal = satu baris. Kalau tanggalnya sudah ada, isian digabung ke baris itu.
      var gabung = gabungAbsensi_(sh, info, nilai);
      if (gabung) {
        if (gabung.ok) catatId();
        return gabung;
      }
    }
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

    catatId();
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
}

// PIN kelompok (pengumpul / tim suling) hanya boleh mengabsen kelompoknya sendiri,
// dengan pilihan sesuai jobdesk. Kerja harian dan kerja lain diisi mandor atau pemilik.
function cekAbsensiKelompok_(akses, nilai, tarif) {
  var k = akses.kelompokAbsensi;
  if (!k) return '';
  var jobdesk = /suling/i.test(k) ? 'Penyulingan' : 'Pengumpulan';
  var kunci = Object.keys(nilai);
  for (var i = 0; i < kunci.length; i++) {
    var h = kunci[i];
    if (h === 'Tanggal' || h === 'Keterangan') continue;
    if (nilai[h] === '' || nilai[h] === null || nilai[h] === undefined) continue;
    var m = /^(.+) \[(.+)\]$/.exec(h);
    if (!m || m[1] !== k) return 'PIN ini hanya untuk absensi ' + k + '. Isian "' + h + '" diisi mandor atau pemilik.';
    var t = tarif.filter(function (x) { return x.pilihan === String(nilai[h]); })[0];
    if (!t || (t.jenis !== 'Libur' && t.jenis !== jobdesk)) {
      return '"' + nilai[h] + '" bukan pekerjaan ' + k.toLowerCase() + '. Kerja harian dan kerja lain diisi mandor.';
    }
  }
  return '';
}

// Menggabungkan isian absensi ke baris tanggal yang sama. null = belum ada baris tanggal itu.
function gabungAbsensi_(sh, info, nilai) {
  var tgl = String(nilai['Tanggal'] || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return null;
  var akhir = sh.getLastRow();
  if (akhir < 2) return null;
  var semua = sh.getRange(2, 2, akhir - 1, info.kepala.length).getValues();
  var r = -1;
  for (var i = 0; i < semua.length; i++) {
    var d = semua[i][1];
    if (adalahTanggal_(d) && Utilities.formatDate(d, API_ZONA, 'yyyy-MM-dd') === tgl) { r = i; break; }
  }
  if (r < 0) return null;
  var lama = semua[r], baru = lama.slice();
  var bentrok = [], asing = [], berubah = false;
  Object.keys(nilai).forEach(function (h) {
    var j = info.kepala.indexOf(h);
    if (j < 1) { asing.push(h); return; }
    if (h === 'Tanggal') return;
    var v = ubahNilai_(h, nilai[h]);
    if (v === '') return;
    var ada = lama[j] === null || lama[j] === undefined ? '' : lama[j];
    if (h === 'Keterangan') {
      if (String(ada).indexOf(String(v)) < 0) { baru[j] = ada ? ada + ' | ' + v : v; berubah = true; }
    } else if (h === 'Ada kerja lain dengan upah khusus hari ini?') {
      var gabungan = (ada === 'Ya' || v === 'Ya') ? 'Ya' : (ada || v);
      if (gabungan !== ada) { baru[j] = gabungan; berubah = true; }
    } else if (ada === '') {
      baru[j] = v; berubah = true;
    } else if (String(ada) !== String(v)) {
      var m = /^(.+) \[(.+)\]$/.exec(h);
      bentrok.push((m ? m[2] : h) + ' sudah tercatat "' + ada + '"');
    }
  });
  if (asing.length) return {ok: false, galat: 'Kolom tidak ditemukan di tab Absensi: ' + asing.join(', ') + '.'};
  if (bentrok.length) {
    return {ok: false, kode: 'SUDAH', galat: 'Absensi ' + tgl.split('-').reverse().join('/') + ': ' + bentrok.join('; ') +
      '. Kalau salah, pemilik bisa mengubahnya lewat Riwayat.'};
  }
  if (!berubah) return {ok: true, dobel: true};
  sh.getRange(r + 2, 2, 1, baru.length).setValues([baru]);
  SpreadsheetApp.flush();
  if (typeof urutkanTab_ === 'function') urutkanTab_(sh);
  return {ok: true, gabung: true};
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
  var n = Math.max(1, Math.min(Number(req.n) || 10, 60));
  var sh = ss.getSheetByName(tab);
  var lastCol = sh.getLastColumn();
  var kepala = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var tampil = sh.getRange(2, 1, n, lastCol).getDisplayValues();
  var hasil = {ok: true, tab: tab, kepala: kepala, baris: []};
  var info = akses.semua ? kolomForm_(sh) : null;
  var mentah = akses.semua ? sh.getRange(2, 2, n, info.kepala.length).getValues() : null;
  if (akses.semua) hasil.data = [];
  for (var i = 0; i < tampil.length; i++) {
    if (!tampil[i][1] && !tampil[i][2]) continue;
    hasil.baris.push(tampil[i]);
    if (akses.semua) hasil.data.push({nomor: i + 2, tanda: tandaBaris_(mentah[i]), nilai: nilaiMentah_(info.kepala, mentah[i])});
  }
  return hasil;
}

// ---------------------------------------------------------------- RINGKASAN

function ringkasan_(ss, akses) {
  if (!akses.semua) return {ok: false, galat: 'Ringkasan hanya untuk pemilik.'};
  var dash = ss.getSheetByName('Dashboard');
  var rek = ss.getSheetByName('Rekap Mingguan');
  var rekBln = ss.getSheetByName('Rekap Bulanan');
  var tgl = function (d) { return adalahTanggal_(d) ? Utilities.formatDate(d, API_ZONA, 'dd/MM/yyyy') : String(d || ''); };
  var angka = function (v) { return typeof v === 'number' ? v : null; };

  // Kolom upah per pekerja (untuk gajian) di Rekap Mingguan: "Upah <nama> (Rp)", mulai kolom W.
  var lebarRek = Math.max(26, rek.getLastColumn());
  var kepalaRek = rek.getRange(4, 1, 1, lebarRek).getDisplayValues()[0];
  var kolomOrang = [];
  for (var c = 22; c < kepalaRek.length; c++) {
    var cocok = /^Upah (.+) \(Rp\)$/.exec(String(kepalaRek[c]).trim());
    if (cocok) kolomOrang.push({i: c, nama: cocok[1].replace(/^tim suling$/i, 'Tim suling')});
  }
  var minggu = function (v) {
    return {upahOrang: kolomOrang.map(function (k) { return {nama: k.nama, upah: angka(v[k.i]) || 0}; }),
      mulai: tgl(v[0]), sampai: tgl(v[1]), trip: angka(v[2]), bahanKg: angka(v[3]), beliBahan: angka(v[4]),
      hargaBahan: angka(v[5]), biayaJalan: angka(v[6]), sulingan: angka(v[7]), ketelKosong: angka(v[8]),
      minyak: angka(v[10]), minyakPerSulingan: angka(v[11]), rendemen: angka(v[12]), upahPengumpul: angka(v[13]),
      upahPenyuling: angka(v[14]), operasional: angka(v[15]), biayaProduksi: angka(v[16]), biayaPerKg: angka(v[17]),
      terjual: angka(v[18]), penjualan: angka(v[19]), laba: angka(v[20]), upahHarian: angka(v[21])};
  };
  var bulan = function (v) {
    return {bulan: adalahTanggal_(v[0]) ? Utilities.formatDate(v[0], API_ZONA, 'MM/yyyy') : String(v[0]),
      penjualan: angka(v[19]), biayaProduksi: angka(v[16]), laba: angka(v[20]), pengembangan: angka(v[21]),
      cicilan: angka(v[22]), labaSetelahCicilan: angka(v[23]), keluarga: angka(v[24]), proyekBahan: angka(v[25]),
      upahHarian: angka(v[26]), pembiayaan: angka(v[27]), pemasukanLain: angka(v[28]), belumDibayar: angka(v[29]),
      perubahanKas: angka(v[30])};
  };
  // Semua baris rekap dari baris 5 sampai baris periode berjalan, terbaru di depan.
  var semua = function (sh, akhir, lebar, ubah) {
    if (!(akhir >= 5)) return [];
    return sh.getRange(5, 1, akhir - 4, lebar).getValues().map(ubah).reverse();
  };
  var rMinggu = Number(dash.getRange('N5').getValue());
  var rPenuh = Number(dash.getRange('N6').getValue());
  var rBulan = Number(dash.getRange('N8').getValue());
  var semuaMinggu = semua(rek, rMinggu, lebarRek, minggu);
  var semuaBulan = semua(rekBln, rBulan, 31, bulan);

  var peringatan = dash.getRange('A15:F23').getDisplayValues().map(function (r) {
    return {hal: r[0], nilai: r[2], batas: r[3], status: r[4], saran: r[5]};
  }).filter(function (p) { return p.hal; });

  return {ok: true, dataSampai: dash.getRange('B2').getDisplayValue(),
    mingguBerjalan: semuaMinggu[0] || null,
    mingguPenuh: rPenuh >= 5 && rMinggu >= rPenuh ? semuaMinggu[rMinggu - rPenuh] || null : null,
    bulanIni: semuaBulan[0] || null,
    semuaMinggu: semuaMinggu, semuaBulan: semuaBulan,
    peringatan: peringatan};
}

// ---------------------------------------------------------------- PEMILIK: PIN

function pinDaftar_(ss, akses) {
  if (!akses.semua) return {ok: false, galat: 'Hanya pemilik yang boleh mengatur PIN.'};
  var data = ss.getSheetByName('Pengaturan').getRange('A20:E29').getDisplayValues();
  var daftar = [];
  for (var i = 0; i < data.length; i++) {
    if (!String(data[i][0]).trim()) continue;
    daftar.push({baris: 20 + i, peran: String(data[i][0]).trim(), pin: String(data[i][1]).trim(),
      boleh: String(data[i][2]).trim() + (String(data[i][4] || '').trim() ? ' (absensi ' + String(data[i][4]).trim() + ' saja)' : ''),
      saya: akses.baris === 20 + i});
  }
  return {ok: true, daftar: daftar};
}

function pinUbah_(ss, akses, req) {
  if (!akses.semua) return {ok: false, galat: 'Hanya pemilik yang boleh mengatur PIN.'};
  var baris = Number(req.baris);
  var pin = String(req.pinBaru === undefined || req.pinBaru === null ? '' : req.pinBaru).trim();
  if (!(baris >= 20 && baris <= 29)) return {ok: false, galat: 'Baris PIN tidak dikenal.'};
  if (pin && !/^\d{4,8}$/.test(pin)) return {ok: false, galat: 'PIN harus 4 sampai 8 angka.'};
  if (!pin && baris === akses.baris) return {ok: false, galat: 'PIN pemilik tidak boleh dikosongkan.'};
  var sh = ss.getSheetByName('Pengaturan');
  var data = sh.getRange('A20:C29').getDisplayValues();
  if (!String(data[baris - 20][0]).trim()) return {ok: false, galat: 'Baris PIN tidak dikenal.'};
  for (var i = 0; i < data.length; i++) {
    if (20 + i !== baris && pin && String(data[i][1]).trim() === pin) {
      return {ok: false, galat: 'PIN itu sudah dipakai ' + data[i][0] + '. Pilih angka lain.'};
    }
  }
  var lama = String(data[baris - 20][1]).trim();
  var sel = sh.getRange(baris, 2);
  sel.setNumberFormat('@');
  sel.setValue(pin);
  catatLog_(ss, 'Ubah PIN', 'Pengaturan', baris, data[baris - 20][0] + ': ' + (lama ? 'ada' : 'kosong'),
    data[baris - 20][0] + ': ' + (pin ? 'diganti' : 'dimatikan'), akses.peran);
  return {ok: true};
}

// ---------------------------------------------------------------- PEMILIK: UBAH & HAPUS CATATAN

function ubah_(ss, akses, req) {
  if (!akses.semua) return {ok: false, galat: 'Hanya pemilik yang boleh mengubah catatan.'};
  var tab = String(req.tab || '');
  if (API_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Tab tidak dikenal.'};
  var nilai = req.nilai || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = ss.getSheetByName(tab);
    var info = kolomForm_(sh);
    var r = cariBaris_(sh, info, Number(req.nomor), String(req.tanda || ''));
    if (!r) return {ok: false, kode: 'BERUBAH', galat: 'Catatan ini sudah berubah atau terhapus. Muat ulang Riwayat, lalu coba lagi.'};
    var lama = sh.getRange(r, 2, 1, info.kepala.length).getValues()[0];
    var baru = lama.slice();
    var asing = [];
    Object.keys(nilai).forEach(function (k) {
      var j = info.kepala.indexOf(k);
      if (j >= 1) baru[j] = ubahNilai_(k, nilai[k]);
      else asing.push(k);
    });
    if (asing.length) return {ok: false, galat: 'Kolom tidak ditemukan di tab ' + tab + ': ' + asing.join(', ') + '.'};
    sh.getRange(r, 2, 1, baru.length).setValues([baru]);
    SpreadsheetApp.flush();
    if (typeof urutkanTab_ === 'function') urutkanTab_(sh);
    catatLog_(ss, 'Ubah', tab, r, JSON.stringify(nilaiMentah_(info.kepala, lama)), JSON.stringify(nilaiMentah_(info.kepala, baru)), akses.peran);
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
}

function hapus_(ss, akses, req) {
  if (!akses.semua) return {ok: false, galat: 'Hanya pemilik yang boleh menghapus catatan.'};
  var tab = String(req.tab || '');
  if (API_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Tab tidak dikenal.'};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = ss.getSheetByName(tab);
    var info = kolomForm_(sh);
    var r = cariBaris_(sh, info, Number(req.nomor), String(req.tanda || ''));
    if (!r) return {ok: false, kode: 'BERUBAH', galat: 'Catatan ini sudah berubah atau terhapus. Muat ulang Riwayat, lalu coba lagi.'};
    var lama = sh.getRange(r, 2, 1, info.kepala.length).getValues()[0];
    sh.deleteRow(r);
    catatLog_(ss, 'Hapus', tab, r, JSON.stringify(nilaiMentah_(info.kepala, lama)), '', akses.peran);
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
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

// Nilai baris untuk diisi ulang di formulir: tanggal jadi yyyy-mm-dd, angka tetap angka.
function nilaiMentah_(kepala, nilai) {
  var out = {};
  for (var j = 1; j < kepala.length; j++) {
    var v = nilai[j];
    if (adalahTanggal_(v)) v = /^Tanggal/.test(kepala[j]) ? Utilities.formatDate(v, API_ZONA, 'yyyy-MM-dd') : Utilities.formatDate(v, API_ZONA, 'dd/MM/yyyy HH:mm');
    out[kepala[j]] = v;
  }
  return out;
}

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

function adalahTanggal_(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}
