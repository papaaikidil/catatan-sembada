// =====================================================================
// SEMBADA KARYA WANGI - API untuk aplikasi Catatan Sembada (versi 6)
//
// Tempel file ini sebagai file "api" di project Apps Script "Sembada Sheet"
// (project yang sama dengan kode form dan urut_otomatis).
//
// Kalau kode ini diperbarui: Terapkan > Kelola deployment > ikon pensil >
// Versi: "Versi baru" > Terapkan. Alamat /exec tetap sama.
//
// Versi 6:
//  - Pengguna (PIN per orang) di tab "Pengguna".
//  - Karyawan dan alat suling di tab "Karyawan" dan "Alat Suling".
//  - Absensi satu baris per orang per hari di tab "Absensi Harian".
//    Tab "Absensi" (format lama, satu baris per hari) hanya dibaca: isian baru di
//    sana (misalnya dari Google Form lama) otomatis dipindahkan ke "Absensi Harian".
//  - Tampilan aplikasi (nama, logo, warna, tombol, kartu) di tab "Pengaturan Aplikasi".
//  - Pertanyaan tambahan formulir di tab "Formulir".
// Semua tab itu diatur dari aplikasi oleh pemilik. Jangan ubah judul kolomnya.
// =====================================================================

var API_ID_SHEET = '11erbcsOh7G0BKWFLmsGqvWNcQiyz0mSogFLX5AS_8AI';
var API_ZONA = 'Asia/Jakarta';
var API_TAB = ['Ambil Bahan', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
var API_VERSI = 6;
var API_LOG = 'Log Aplikasi';   // tab tersembunyi: catatan setiap perubahan dan penghapusan
var API_BATAS_GAGAL = 30;      // PIN salah sebanyak ini dalam 15 menit = dikunci sementara
var API_SIMPAN_ID = 300;       // jumlah id entri terakhir yang diingat untuk mencegah dobel

var SH_ABSENSI = 'Absensi Harian';
var SH_ABSENSI_LAMA = 'Absensi';
var SH_KARYAWAN = 'Karyawan';
var SH_ALAT = 'Alat Suling';
var SH_PENGGUNA = 'Pengguna';
var SH_APLIKASI = 'Pengaturan Aplikasi';
var SH_FORMULIR = 'Formulir';

var KEPALA_ABSENSI = ['Hari', 'Timestamp', 'Tanggal', 'Nama', 'Tim', 'Pekerjaan', 'Alat', 'Jumlah sulingan', 'Upah (Rp)',
  'Pos upah', 'Pekerjaan lain', 'Kerja lain untuk', 'Keterangan', 'Diisi oleh'];
var KEPALA_KARYAWAN = ['Nama', 'Tim', 'Alat', 'Aktif', 'Catatan'];
var KEPALA_ALAT = ['Nama alat', 'Aktif', 'Catatan'];
var KEPALA_PENGGUNA = ['Nama', 'PIN', 'Peran', 'Boleh mengisi', 'Absen untuk', 'Aktif', 'Catatan'];
var KEPALA_APLIKASI = ['Kunci', 'Nilai', 'Keterangan'];
var KEPALA_FORMULIR = ['Tab', 'Kolom', 'Label', 'Bantuan', 'Jenis', 'Wajib', 'Pilihan', 'Tampil', 'Urutan', 'Asal'];
var TAB_BISA_DIATUR = ['Ambil Bahan', 'Saring Minyak', 'Penjualan', 'Kas'];
var JENIS_TAMBAHAN = ['teks', 'paragraf', 'angka', 'rupiah', 'desimal', 'pilih', 'centang', 'tanggal'];
var PERAN = ['Pemilik', 'Mandor', 'Pekerja'];

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

  var a = req.aksi;
  if (a === 'masuk') return {ok: true, nama: akses.nama, peran: akses.peran, tab: akses.tab, semua: akses.semua,
    mandor: akses.mandor, kelompokAbsensi: akses.kelompokAbsensi, versiApi: API_VERSI};
  if (a === 'config') return config_(ss, akses, req);
  if (a === 'simpan') return simpan_(ss, akses, req);
  if (a === 'terbaru') return terbaru_(ss, akses, req);
  if (a === 'ringkasan') return ringkasan_(ss, akses);
  if (a === 'logo') return logo_(ss);
  if (a === 'ubah') return ubah_(ss, akses, req);
  if (a === 'hapus') return hapus_(ss, akses, req);
  // Pengaturan, khusus pemilik.
  if (!akses.semua && /^(pengguna|karyawan|alat|tampilan|formulir|pin)/.test(a)) {
    return {ok: false, galat: 'Hanya pemilik yang boleh mengatur ini.'};
  }
  if (a === 'penggunaDaftar') return penggunaDaftar_(ss, akses);
  if (a === 'penggunaSimpan') return denganKunci_(function () { return penggunaSimpan_(ss, akses, req); });
  if (a === 'penggunaHapus') return denganKunci_(function () { return penggunaHapus_(ss, akses, req); });
  if (a === 'karyawanSimpan') return denganKunci_(function () { return karyawanSimpan_(ss, akses, req); });
  if (a === 'alatSimpan') return denganKunci_(function () { return alatSimpan_(ss, akses, req); });
  if (a === 'tampilanSimpan') return denganKunci_(function () { return tampilanSimpan_(ss, akses, req); });
  if (a === 'formulirSimpan') return denganKunci_(function () { return formulirSimpan_(ss, akses, req); });
  // Untuk aplikasi versi lama (sebelum ada tab Pengguna).
  if (a === 'pinDaftar') return pinDaftar_(ss, akses);
  if (a === 'pinUbah') return denganKunci_(function () { return pinUbah_(ss, akses, req); });
  return {ok: false, galat: 'Aksi tidak dikenal: ' + a};
}

function denganKunci_(f) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return f(); } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- ALAT BANTU

function adalahTanggal_(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}
function teks_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function ya_(v) { return !/^(tidak|no|0|false|nonaktif)$/i.test(teks_(v)); }   // kosong dianggap Ya
function tglIso_(d) { return Utilities.formatDate(d, API_ZONA, 'yyyy-MM-dd'); }
function tglIndo_(iso) { return String(iso).split('-').reverse().join('/'); }
function pecahDaftar_(s) {
  return teks_(s).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
}
function namaSheet_(tab) { return tab === 'Absensi' ? SH_ABSENSI : tab; }
function rpTeks_(n) { return 'Rp' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

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

// Baris data sebuah tab sederhana (judul di baris 1). Kolom dibaca sebagai teks.
function bacaTabel_(sh, lebar) {
  if (!sh) return [];
  var akhir = sh.getLastRow();
  if (akhir < 2) return [];
  return sh.getRange(2, 1, akhir - 1, lebar).getDisplayValues().map(function (r, i) {
    return {baris: i + 2, nilai: r.map(teks_)};
  }).filter(function (x) { return x.nilai[0]; });
}

// ---------------------------------------------------------------- PENGGUNA & PIN

function cekPin_(ss, pin) {
  var cache = CacheService.getScriptCache();
  var gagal = Number(cache.get('pinGagal') || 0);
  if (gagal >= API_BATAS_GAGAL) return {kunci: true};

  pin = teks_(pin);
  if (pin) {
    var daftar = bacaPengguna_(ss);
    for (var i = 0; i < daftar.length; i++) {
      var u = daftar[i];
      if (u.aktif && u.pin && u.pin === pin) return aksesDari_(u, ss);
    }
  }
  cache.put('pinGagal', String(gagal + 1), 900);
  return null;
}

// Daftar pengguna dari tab Pengguna. Kalau tab itu belum ada, pakai tabel PIN lama di Pengaturan.
function bacaPengguna_(ss) {
  var sh = ss.getSheetByName(SH_PENGGUNA);
  if (sh) {
    return bacaTabel_(sh, KEPALA_PENGGUNA.length).map(function (x) {
      var v = x.nilai;
      return {baris: x.baris, nama: v[0], pin: v[1], peran: normalPeran_(v[2]), boleh: v[3], absenUntuk: v[4],
        aktif: ya_(v[5]), catatan: v[6], sumber: 'Pengguna'};
    });
  }
  var lama = ss.getSheetByName('Pengaturan');
  if (!lama) return [];
  return lama.getRange('A20:E29').getDisplayValues().map(function (r, i) {
    var boleh = teks_(r[2]);
    var peran = /^semua$/i.test(boleh) ? 'Pemilik' : (/mandor/i.test(r[0]) ? 'Mandor' : 'Pekerja');
    return {baris: 20 + i, nama: teks_(r[0]), pin: teks_(r[1]), peran: peran, boleh: boleh,
      absenUntuk: teks_(r[4]) ? 'Semua ' + teks_(r[4]) : '', aktif: true, catatan: '', sumber: 'Pengaturan'};
  }).filter(function (u) { return u.nama; });
}

function normalPeran_(p) {
  p = teks_(p).toLowerCase();
  if (p === 'pemilik') return 'Pemilik';
  if (p === 'mandor') return 'Mandor';
  return 'Pekerja';
}

function aksesDari_(u, ss) {
  var pemilik = u.peran === 'Pemilik';
  var mandor = u.peran === 'Mandor';
  var tab = (pemilik || /^semua$/i.test(u.boleh)) ? API_TAB.slice()
    : pecahDaftar_(u.boleh).filter(function (t) { return API_TAB.indexOf(t) >= 0; });
  var absen = pecahDaftar_(u.absenUntuk);
  if ((mandor || absen.length) && tab.indexOf('Absensi') < 0) tab.push('Absensi');
  tab.sort(function (a, b) { return API_TAB.indexOf(a) - API_TAB.indexOf(b); });
  var akses = {nama: u.nama, peran: u.peran, tab: tab, semua: pemilik, mandor: mandor, baris: u.baris,
    sumber: u.sumber, jobdeskSaja: !pemilik && !mandor,
    absenUntuk: (pemilik || mandor || !absen.length || absen.some(function (x) { return /^semua$/i.test(x); })) ? null : absen};
  akses.kelompokAbsensi = kelompokLama_(akses, ss);
  return akses;
}

// Untuk aplikasi versi lama: nama tim kalau PIN ini hanya mengabsen satu tim.
function kelompokLama_(akses, ss) {
  if (!akses.jobdeskSaja || akses.tab.indexOf('Absensi') < 0) return '';
  var nama = akses.absenUntuk;
  if (!nama) return '';
  var tim = {};
  var karyawan = bacaKaryawan_(ss);
  nama.forEach(function (n) {
    var m = /^Semua (.+)$/i.exec(n);
    if (m) { tim[m[1]] = 1; return; }
    karyawan.forEach(function (k) { if (k.nama === n) tim[k.tim] = 1; });
  });
  var t = Object.keys(tim);
  return t.length === 1 ? t[0] : '';
}

// Nama karyawan yang boleh diabsen PIN ini. null = semua.
function namaBoleh_(akses, karyawan) {
  if (!akses.absenUntuk) return null;
  var out = [];
  akses.absenUntuk.forEach(function (n) {
    var m = /^Semua (.+)$/i.exec(n);
    karyawan.forEach(function (k) {
      if ((m && k.tim === m[1]) || k.nama === n) { if (out.indexOf(k.nama) < 0) out.push(k.nama); }
    });
  });
  return out;
}

function penggunaDaftar_(ss, akses) {
  return {ok: true, pengguna: bacaPengguna_(ss).map(function (u) {
    return {baris: u.baris, nama: u.nama, pin: u.pin, peran: u.peran, boleh: u.boleh, absenUntuk: u.absenUntuk,
      aktif: u.aktif, catatan: u.catatan, saya: u.baris === akses.baris && u.sumber === akses.sumber};
  }), sumber: ss.getSheetByName(SH_PENGGUNA) ? 'Pengguna' : 'Pengaturan'};
}

// Tambah (tanpa baris) atau ubah (dengan baris) satu pengguna.
function penggunaSimpan_(ss, akses, req) {
  var sh = siapkanSheet_(ss, SH_PENGGUNA, KEPALA_PENGGUNA);
  var p = req.pengguna || {};
  var nama = teks_(p.nama), pin = teks_(p.pin), peran = normalPeran_(p.peran);
  if (!nama) return {ok: false, galat: 'Nama wajib diisi.'};
  if (/[,\[\]]/.test(nama)) return {ok: false, galat: 'Nama tidak boleh berisi koma atau kurung siku.'};
  if (!/^\d{4,8}$/.test(pin)) return {ok: false, galat: 'PIN harus 4 sampai 8 angka.'};
  var boleh = peran === 'Pemilik' ? 'Semua' : (Array.isArray(p.boleh) ? p.boleh : pecahDaftar_(p.boleh))
    .filter(function (t) { return API_TAB.indexOf(t) >= 0 && t !== 'Absensi'; }).join(', ');
  var absen = peran === 'Pekerja' ? (Array.isArray(p.absenUntuk) ? p.absenUntuk : pecahDaftar_(p.absenUntuk)).join(', ') : '';
  var aktif = p.aktif === false || p.aktif === 'Tidak' ? 'Tidak' : 'Ya';
  var semua = bacaPengguna_(ss);
  var baris = Number(p.baris) || 0;
  var lama = baris ? semua.filter(function (u) { return u.baris === baris; })[0] : null;
  if (baris && !lama) return {ok: false, galat: 'Pengguna ini sudah berubah. Muat ulang daftar.'};
  for (var i = 0; i < semua.length; i++) {
    var u = semua[i];
    if (u.baris === baris) continue;
    if (u.pin === pin) return {ok: false, galat: 'PIN itu sudah dipakai ' + u.nama + '. Pilih angka lain.'};
    if (u.nama.toLowerCase() === nama.toLowerCase()) return {ok: false, galat: 'Nama ' + nama + ' sudah ada.'};
  }
  var saya = lama && lama.baris === akses.baris;
  if (saya && (peran !== 'Pemilik' || aktif !== 'Ya')) return {ok: false, galat: 'Anda tidak bisa menurunkan atau menonaktifkan akun Anda sendiri.'};
  var isi = [nama, pin, peran, boleh, absen, aktif, teks_(p.catatan)];
  if (lama) {
    sh.getRange(baris, 1, 1, isi.length).setValues([isi]);
  } else {
    baris = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(baris, 1, 1, isi.length).setValues([isi]);
  }
  sh.getRange(baris, 2).setNumberFormat('@');
  sh.getRange(baris, 2).setValue(pin);
  catatLog_(ss, lama ? 'Ubah pengguna' : 'Tambah pengguna', SH_PENGGUNA, baris,
    lama ? [lama.nama, lama.peran, lama.boleh, lama.absenUntuk, lama.aktif ? 'Ya' : 'Tidak'].join(' | ') : '',
    [nama, peran, boleh, absen, aktif].join(' | ') + (lama && lama.pin !== pin ? ' | PIN diganti' : ''), akses.nama);
  return {ok: true, baris: baris, pinSaya: saya ? pin : undefined};
}

function penggunaHapus_(ss, akses, req) {
  var sh = ss.getSheetByName(SH_PENGGUNA);
  if (!sh) return {ok: false, galat: 'Tab Pengguna belum ada.'};
  var baris = Number(req.baris);
  var u = bacaPengguna_(ss).filter(function (x) { return x.baris === baris; })[0];
  if (!u || u.nama !== teks_(req.nama)) return {ok: false, galat: 'Pengguna ini sudah berubah. Muat ulang daftar.'};
  if (baris === akses.baris) return {ok: false, galat: 'Anda tidak bisa menghapus akun Anda sendiri.'};
  sh.deleteRow(baris);
  catatLog_(ss, 'Hapus pengguna', SH_PENGGUNA, baris, [u.nama, u.peran, u.boleh, u.absenUntuk].join(' | '), '', akses.nama);
  return {ok: true};
}

// Aplikasi versi lama: kelola PIN saja.
function pinDaftar_(ss, akses) {
  return {ok: true, daftar: bacaPengguna_(ss).map(function (u) {
    return {baris: u.baris, peran: u.nama, pin: u.pin, boleh: u.peran === 'Pemilik' ? 'Semua' : u.boleh,
      saya: u.baris === akses.baris};
  })};
}

function pinUbah_(ss, akses, req) {
  var baris = Number(req.baris);
  var pin = teks_(req.pinBaru);
  if (pin && !/^\d{4,8}$/.test(pin)) return {ok: false, galat: 'PIN harus 4 sampai 8 angka.'};
  if (!pin && baris === akses.baris) return {ok: false, galat: 'PIN pemilik tidak boleh dikosongkan.'};
  var semua = bacaPengguna_(ss);
  var u = semua.filter(function (x) { return x.baris === baris; })[0];
  if (!u) return {ok: false, galat: 'Baris PIN tidak dikenal.'};
  for (var i = 0; i < semua.length; i++) {
    if (semua[i].baris !== baris && pin && semua[i].pin === pin) return {ok: false, galat: 'PIN itu sudah dipakai ' + semua[i].nama + '. Pilih angka lain.'};
  }
  var sh = ss.getSheetByName(u.sumber === 'Pengguna' ? SH_PENGGUNA : 'Pengaturan');
  var sel = sh.getRange(baris, 2);
  sel.setNumberFormat('@');
  sel.setValue(pin);
  catatLog_(ss, 'Ubah PIN', u.sumber, baris, u.nama + ': ' + (u.pin ? 'ada' : 'kosong'), u.nama + ': ' + (pin ? 'diganti' : 'dimatikan'), akses.nama);
  return {ok: true};
}

// ---------------------------------------------------------------- KARYAWAN & ALAT

function bacaKaryawan_(ss) {
  return bacaTabel_(ss.getSheetByName(SH_KARYAWAN), KEPALA_KARYAWAN.length).map(function (x) {
    var v = x.nilai;
    return {baris: x.baris, nama: v[0], tim: v[1], alat: v[2], aktif: ya_(v[3]), catatan: v[4]};
  });
}

function bacaAlat_(ss) {
  return bacaTabel_(ss.getSheetByName(SH_ALAT), KEPALA_ALAT.length).map(function (x) {
    return {baris: x.baris, nama: x.nilai[0], aktif: ya_(x.nilai[1]), catatan: x.nilai[2]};
  });
}

function bacaTarifApi_(ss) {
  var tarif = [];
  var tsh = ss.getSheetByName('Tarif Upah');
  var tn = Math.max(tsh.getLastRow() - 1, 1);
  tsh.getRange(2, 1, tn, 5).getValues().forEach(function (row) {
    var pilihan = teks_(row[0]);
    if (pilihan) tarif.push({pilihan: pilihan, untuk: teks_(row[1]), upah: Number(row[2]) || 0, jenis: teks_(row[3]),
      sulingan: Number(row[4]) || 0});
  });
  return tarif;
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

function namaAman_(nama) {
  if (!nama) return 'Nama wajib diisi.';
  if (nama.length > 40) return 'Nama terlalu panjang (maksimal 40 huruf).';
  if (/[,\[\]|*?~]/.test(nama)) return 'Nama tidak boleh berisi koma, kurung siku, atau tanda * ? ~ |.';
  if (/^semua\b/i.test(nama)) return 'Nama tidak boleh diawali kata "Semua".';
  return '';
}

// Tambah karyawan baru, atau ubah tim / alat / status aktif. Nama tidak bisa diganti (riwayat upah memakai nama).
function karyawanSimpan_(ss, akses, req) {
  var sh = siapkanSheet_(ss, SH_KARYAWAN, KEPALA_KARYAWAN);
  var k = req.karyawan || {};
  var nama = teks_(k.nama), tim = teks_(k.tim), alat = teks_(k.alat);
  var aktif = k.aktif === false || k.aktif === 'Tidak' ? 'Tidak' : 'Ya';
  var ref = bacaReferensi_(ss);
  var lama = ref.karyawan.filter(function (x) { return x.nama.toLowerCase() === nama.toLowerCase(); })[0];
  if (k.baru && lama) return {ok: false, galat: 'Karyawan bernama ' + lama.nama + ' sudah ada' + (lama.aktif ? '.' : ' (nonaktif). Aktifkan saja yang lama.')};
  if (!k.baru && !lama) return {ok: false, galat: 'Karyawan ' + nama + ' tidak ditemukan. Muat ulang daftar.'};
  if (k.baru) { var g = namaAman_(nama); if (g) return {ok: false, galat: g}; }
  if (!tim) return {ok: false, galat: 'Pilih tim.'};
  if (daftarTim_(ref).indexOf(tim) < 0) return {ok: false, galat: 'Tim ' + tim + ' belum ada di Tarif Upah.'};
  if (alat && !ref.alat.some(function (a) { return a.nama === alat; })) return {ok: false, galat: 'Alat ' + alat + ' tidak dikenal.'};
  var isi = [lama ? lama.nama : nama, tim, alat, aktif, lama ? lama.catatan : teks_(k.catatan)];
  var baris = lama ? lama.baris : Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(baris, 1, 1, isi.length).setValues([isi]);
  catatLog_(ss, lama ? 'Ubah karyawan' : 'Tambah karyawan', SH_KARYAWAN, baris,
    lama ? [lama.tim, lama.alat, lama.aktif ? 'Ya' : 'Tidak'].join(' | ') : '', isi.slice(0, 4).join(' | '), akses.nama);
  return {ok: true};
}

function alatSimpan_(ss, akses, req) {
  var sh = siapkanSheet_(ss, SH_ALAT, KEPALA_ALAT);
  var a = req.alat || {};
  var nama = teks_(a.nama);
  var aktif = a.aktif === false || a.aktif === 'Tidak' ? 'Tidak' : 'Ya';
  var semua = bacaAlat_(ss);
  var lama = semua.filter(function (x) { return x.nama.toLowerCase() === nama.toLowerCase(); })[0];
  if (a.baru && lama) return {ok: false, galat: 'Alat ' + lama.nama + ' sudah ada.'};
  if (!a.baru && !lama) return {ok: false, galat: 'Alat ' + nama + ' tidak ditemukan. Muat ulang daftar.'};
  if (a.baru) { var g = namaAman_(nama); if (g) return {ok: false, galat: g.replace('Nama', 'Nama alat')}; }
  if (lama && aktif === 'Tidak' && semua.filter(function (x) { return x.aktif && x.nama !== lama.nama; }).length === 0) {
    return {ok: false, galat: 'Minimal harus ada satu alat suling yang aktif.'};
  }
  var isi = [lama ? lama.nama : nama, aktif, lama ? lama.catatan : teks_(a.catatan)];
  var baris = lama ? lama.baris : Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(baris, 1, 1, isi.length).setValues([isi]);
  catatLog_(ss, lama ? 'Ubah alat' : 'Tambah alat', SH_ALAT, baris, lama ? (lama.aktif ? 'Aktif' : 'Nonaktif') : '', isi.slice(0, 2).join(' | '), akses.nama);
  return {ok: true};
}

// ---------------------------------------------------------------- PENGATURAN APLIKASI (TAMPILAN)

function bacaAplikasi_(ss) {
  var out = {};
  bacaTabel_(ss.getSheetByName(SH_APLIKASI), 2).forEach(function (x) { out[x.nilai[0]] = x.nilai[1]; });
  return out;
}

function simpanAplikasi_(ss, kunci, nilai, ket) {
  var sh = siapkanSheet_(ss, SH_APLIKASI, KEPALA_APLIKASI, true);
  sh.getRange('B:B').setNumberFormat('@');           // nilai selalu teks (warna, JSON, logo)
  var data = bacaTabel_(sh, 1);
  var ada = data.filter(function (x) { return x.nilai[0] === kunci; })[0];
  var baris = ada ? ada.baris : Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(baris, 1, 1, 2).setValues([[kunci, nilai]]);
  if (!ada && ket) sh.getRange(baris, 3).setValue(ket);
}

function jsonAman_(s, bawaan) {
  try { var v = JSON.parse(s); return v === null || v === undefined ? bawaan : v; } catch (e) { return bawaan; }
}

function tampilan_(ss) {
  var a = bacaAplikasi_(ss);
  var logo = a.logo || '';
  return {namaUsaha: a.namaUsaha || '', namaAplikasi: a.namaAplikasi || '', warna: a.warna || '',
    menuBeranda: jsonAman_(a.menuBeranda, null), kartuRingkasan: jsonAman_(a.kartuRingkasan, null),
    kartuBeranda: jsonAman_(a.kartuBeranda, null),
    logoTanda: logo ? Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, logo, Utilities.Charset.UTF_8)) : ''};
}

function logo_(ss) {
  var a = bacaAplikasi_(ss);
  return {ok: true, logo: a.logo || '', tanda: tampilan_(ss).logoTanda};
}

function tampilanSimpan_(ss, akses, req) {
  var t = req.tampilan || {};
  var ket = {namaUsaha: 'Nama usaha di aplikasi', namaAplikasi: 'Judul aplikasi', warna: 'Warna utama (#RRGGBB)',
    logo: 'Logo (gambar kecil, diunggah dari aplikasi)', menuBeranda: 'Urutan tombol catatan di Beranda',
    kartuRingkasan: 'Kartu yang tampil di Ringkasan', kartuBeranda: 'Kartu yang tampil di Beranda'};
  var diubah = [];
  if (t.namaUsaha !== undefined) { if (teks_(t.namaUsaha).length > 60) return {ok: false, galat: 'Nama usaha terlalu panjang.'}; simpanAplikasi_(ss, 'namaUsaha', teks_(t.namaUsaha), ket.namaUsaha); diubah.push('nama usaha'); }
  if (t.namaAplikasi !== undefined) { if (teks_(t.namaAplikasi).length > 40) return {ok: false, galat: 'Judul aplikasi terlalu panjang.'}; simpanAplikasi_(ss, 'namaAplikasi', teks_(t.namaAplikasi), ket.namaAplikasi); diubah.push('judul'); }
  if (t.warna !== undefined) {
    if (t.warna && !/^#[0-9a-fA-F]{6}$/.test(t.warna)) return {ok: false, galat: 'Kode warna tidak valid.'};
    simpanAplikasi_(ss, 'warna', t.warna || '', ket.warna); diubah.push('warna');
  }
  if (t.logo !== undefined) {
    if (t.logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(t.logo)) return {ok: false, galat: 'Gambar logo tidak valid.'};
    if (t.logo.length > 45000) return {ok: false, galat: 'Gambar logo terlalu besar.'};
    simpanAplikasi_(ss, 'logo', t.logo || '', ket.logo); diubah.push('logo');
  }
  ['menuBeranda', 'kartuRingkasan', 'kartuBeranda'].forEach(function (k) {
    if (t[k] === undefined) return;
    var v = t[k] === null ? '' : JSON.stringify((t[k] || []).map(teks_).filter(function (x) { return x; }).slice(0, 60));
    simpanAplikasi_(ss, k, v, ket[k]); diubah.push(k);
  });
  catatLog_(ss, 'Ubah tampilan', SH_APLIKASI, '', '', diubah.join(', '), akses.nama);
  return {ok: true, tampilan: tampilan_(ss)};
}

// ---------------------------------------------------------------- FORMULIR (PERTANYAAN)

function bacaFormulir_(ss) {
  var out = {};
  bacaTabel_(ss.getSheetByName(SH_FORMULIR), KEPALA_FORMULIR.length).forEach(function (x) {
    var v = x.nilai;
    if (!out[v[0]]) out[v[0]] = [];
    out[v[0]].push({kolom: v[1], label: v[2], bantuan: v[3], jenis: v[4], wajib: ya_(v[5]) && v[5] !== '',
      pilihan: v[6] ? v[6].split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s; }) : [],
      tampil: ya_(v[7]), urutan: Number(v[8]) || 0, asal: v[9] || 'Bawaan'});
  });
  return out;
}

// Mengganti pengaturan pertanyaan satu tab. Pertanyaan tambahan baru dibuatkan kolom di tab tujuan.
function formulirSimpan_(ss, akses, req) {
  var tab = teks_(req.tab);
  if (TAB_BISA_DIATUR.indexOf(tab) < 0) return {ok: false, galat: 'Pertanyaan tab ' + tab + ' tidak bisa diatur dari aplikasi.'};
  var bidang = Array.isArray(req.bidang) ? req.bidang : [];
  var sh = ss.getSheetByName(tab);
  var info = kolomForm_(sh);
  var dipakai = {};
  var baris = [], kolomBaru = [];
  for (var i = 0; i < bidang.length; i++) {
    var b = bidang[i] || {};
    var kolom = teks_(b.kolom), asal = b.asal === 'Tambahan' ? 'Tambahan' : 'Bawaan';
    if (!kolom) return {ok: false, galat: 'Ada pertanyaan tanpa nama.'};
    if (dipakai[kolom.toLowerCase()]) return {ok: false, galat: 'Pertanyaan "' + kolom + '" ada dua kali.'};
    dipakai[kolom.toLowerCase()] = 1;
    var label = teks_(b.label);
    if (label.length > 80 || teks_(b.bantuan).length > 200) return {ok: false, galat: 'Tulisan pertanyaan "' + kolom + '" terlalu panjang.'};
    var jenis = '', pilihan = '', wajib = '';
    if (asal === 'Tambahan') {
      if (/[\[\]\n]/.test(kolom) || kolom.length > 60) return {ok: false, galat: 'Nama pertanyaan "' + kolom + '" tidak boleh berisi kurung siku dan maksimal 60 huruf.'};
      if (/^(hari|timestamp)$/i.test(kolom) || /^tanggal$/i.test(kolom)) return {ok: false, galat: 'Nama "' + kolom + '" sudah dipakai aplikasi.'};
      jenis = teks_(b.jenis);
      if (JENIS_TAMBAHAN.indexOf(jenis) < 0) return {ok: false, galat: 'Jenis isian "' + jenis + '" tidak dikenal.'};
      pilihan = (Array.isArray(b.pilihan) ? b.pilihan : []).map(teks_).filter(function (x) { return x; });
      if ((jenis === 'pilih' || jenis === 'centang') && pilihan.length < 2) return {ok: false, galat: 'Pertanyaan "' + kolom + '" perlu minimal 2 pilihan.'};
      if (pilihan.some(function (x) { return x.indexOf(';') >= 0; })) return {ok: false, galat: 'Pilihan tidak boleh berisi tanda titik koma.'};
      pilihan = pilihan.join('; ');
      wajib = b.wajib ? 'Ya' : 'Tidak';
      var ada = info.kepala.indexOf(kolom) >= 0;
      var adaLain = !ada && sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].some(function (h) { return teks_(h) === kolom; });
      if (adaLain) return {ok: false, galat: 'Nama "' + kolom + '" sudah dipakai kolom rumus di tab ' + tab + '.'};
      if (!ada) kolomBaru.push(kolom);
    } else if (info.kepala.indexOf(kolom) < 0) {
      return {ok: false, galat: 'Kolom "' + kolom + '" tidak ada di tab ' + tab + '.'};
    }
    baris.push([tab, kolom, label, teks_(b.bantuan), jenis, wajib, pilihan, b.tampil === false ? 'Tidak' : 'Ya', Number(b.urutan) || (i + 1) * 10, asal]);
  }
  // Kolom baru disisipkan setelah kolom isian terakhir (sebelum kolom rumus abu-abu).
  kolomBaru.forEach(function (kolom) {
    var akhir = kolomForm_(sh).kepala.length + 1;     // kolom isian terakhir (1 = A)
    sh.insertColumnAfter(akhir);
    sh.getRange(1, akhir).copyTo(sh.getRange(1, akhir + 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sh.getRange(1, akhir + 1).setValue(kolom);
  });
  var f = siapkanSheet_(ss, SH_FORMULIR, KEPALA_FORMULIR, true);
  var lama = bacaTabel_(f, KEPALA_FORMULIR.length).filter(function (x) { return x.nilai[0] === tab; });
  for (var j = lama.length - 1; j >= 0; j--) f.deleteRow(lama[j].baris);
  if (baris.length) {
    var mulai = Math.max(f.getLastRow(), 1) + 1;
    f.getRange(mulai, 1, baris.length, KEPALA_FORMULIR.length).setValues(baris);
  }
  catatLog_(ss, 'Ubah formulir', tab, '', '', baris.length + ' pertanyaan diatur' + (kolomBaru.length ? ', kolom baru: ' + kolomBaru.join(', ') : ''), akses.nama);
  return {ok: true, kolomBaru: kolomBaru, kepala: kolomForm_(sh).kepala};
}

// ---------------------------------------------------------------- CONFIG

function config_(ss, akses, req) {
  var daftar = {};
  var satuanProduk = {};
  var arahKas = {};
  var sh = ss.getSheetByName('Daftar');
  var nilai = sh.getDataRange().getDisplayValues();
  var kepala = nilai[0];
  for (var c = 0; c < kepala.length; c++) {
    var k = teks_(kepala[c]);
    if (!k) continue;
    var isi = [];
    for (var r = 1; r < nilai.length; r++) {
      var v = teks_(nilai[r][c]);
      if (v) isi.push(v);
    }
    daftar[k] = isi;
  }
  var cProduk = kepala.indexOf('Produk'), cSatuan = kepala.indexOf('Satuan');
  var cKategori = kepala.indexOf('Kategori kas'), cArah = kepala.indexOf('Arah');
  for (var b = 1; b < nilai.length; b++) {
    if (cProduk >= 0 && cSatuan >= 0 && nilai[b][cProduk]) satuanProduk[teks_(nilai[b][cProduk])] = teks_(nilai[b][cSatuan]);
    if (cKategori >= 0 && cArah >= 0 && nilai[b][cKategori]) arahKas[teks_(nilai[b][cKategori])] = teks_(nilai[b][cArah]);
  }

  var ref = bacaReferensi_(ss);
  // Pilihan "Pengumpul" di Ambil Bahan mengikuti karyawan aktif tim Pengumpul.
  if (ref.karyawan.length) {
    daftar['Pengumpul'] = ref.karyawan.filter(function (x) { return x.aktif && x.tim === 'Pengumpul'; }).map(function (x) { return x.nama; });
  }

  var klienBaru = Number(req && req.klien) >= 2;
  var kepalaTab = {};
  akses.tab.forEach(function (t) {
    if (t === 'Absensi' && !klienBaru) { kepalaTab[t] = kepalaAbsensiLama_(ref); return; }
    var s = ss.getSheetByName(namaSheet_(t));
    if (s) kepalaTab[t] = kolomForm_(s).kepala;
  });

  return {ok: true, nama: akses.nama, peran: akses.peran, tab: akses.tab, semua: akses.semua, mandor: akses.mandor,
    jobdeskSaja: akses.jobdeskSaja, absenUntuk: namaBoleh_(akses, ref.karyawan), versiApi: API_VERSI,
    kelompokAbsensi: akses.kelompokAbsensi, daftar: daftar, satuanProduk: satuanProduk, arahKas: arahKas,
    tarif: ref.tarif, kepala: kepalaTab,
    karyawan: ref.karyawan.map(function (x) { return {nama: x.nama, tim: x.tim, alat: x.alat, aktif: x.aktif}; }),
    alat: ref.alat.map(function (x) { return {nama: x.nama, aktif: x.aktif}; }),
    tim: daftarTim_(ref), tampilan: tampilan_(ss), formulir: bacaFormulir_(ss)};
}

// Judul kolom absensi format lama (untuk aplikasi versi lama yang masih terbuka di HP).
function kepalaAbsensiLama_(ref) {
  var aktif = ref.karyawan.filter(function (k) { return k.aktif; });
  return ['Timestamp', 'Tanggal'].concat(aktif.map(function (k) { return k.tim + ' [' + k.nama + ']'; }),
    ['Keterangan', 'Ada kerja lain dengan upah khusus hari ini?', 'Pekerjaan lain', 'Kerja lain untuk'],
    aktif.map(function (k) { return 'Upah kerja lain ' + k.nama + ' (Rp)'; }));
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

// ---------------------------------------------------------------- SIMPAN

function simpan_(ss, akses, req) {
  var tab = teks_(req.tab);
  if (akses.tab.indexOf(tab) < 0) return {ok: false, galat: 'PIN ini tidak boleh mengisi ' + tab + '.'};
  var nilai = req.nilai || {};
  var id = teks_(req.id);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var props = PropertiesService.getScriptProperties();
    var ids = [];
    try { ids = JSON.parse(props.getProperty('idMasuk') || '[]'); } catch (e) { ids = []; }
    if (id && ids.indexOf(id) >= 0) return {ok: true, dobel: true};
    var catatId = function () {
      if (!id) return;
      ids.push(id);
      if (ids.length > API_SIMPAN_ID) ids = ids.slice(ids.length - API_SIMPAN_ID);
      props.setProperty('idMasuk', JSON.stringify(ids));
    };

    if (tab === 'Absensi') {
      pindahkanAbsensiLama_(ss);
      var hasil = simpanAbsensi_(ss, akses, nilai);
      if (hasil.ok) catatId();
      return hasil;
    }

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
    rapikan_(sh, info.lastCol);
    catatId();
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {                // isian tanggal dari aplikasi
    return Utilities.parseDate(s, API_ZONA, 'yyyy-MM-dd');
  }
  return s;
}

// ---------------------------------------------------------------- ABSENSI (SATU BARIS PER ORANG PER HARI)
//
// Isian dari aplikasi baru: {Tanggal, Keterangan, baris: [{nama, pekerjaan, alat, upah, pekerjaanLain, kerjaLainUntuk}]}
// Isian format lama (aplikasi versi lama / Google Form): {"Tim [Nama]": pilihan, "Upah kerja lain Nama (Rp)": angka, ...}

function simpanAbsensi_(ss, akses, nilai) {
  var sh = siapkanSheet_(ss, SH_ABSENSI, KEPALA_ABSENSI);
  var ref = bacaReferensi_(ss);
  var entri = Array.isArray(nilai.baris) ? entriBaru_(nilai) : entriLama_(nilai);
  if (!entri.length) return {ok: false, galat: 'Isi minimal satu orang.'};
  var g = periksaEntri_(entri, akses, ref);
  if (g) return {ok: false, galat: g};
  var waktu = new Date();
  var oleh = akses.nama || akses.peran;
  return tulisAbsensi_(ss, sh, entri.map(function (e) { return barisAbsensi_(e, ref, oleh, waktu); }), {});
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

// Memeriksa hak dan isian. sistem = true untuk pemindahan data lama (tanpa cek hak).
function periksaEntri_(entri, akses, ref, sistem) {
  var boleh = sistem ? null : namaBoleh_(akses, ref.karyawan);
  var alatAktif = ref.alat.filter(function (a) { return a.aktif; }).map(function (a) { return a.nama; });
  var sudah = {};
  for (var i = 0; i < entri.length; i++) {
    var e = entri[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.tanggal)) return 'Tanggal tidak valid.';
    if (!sistem && e.tanggal > tglIso_(new Date())) return 'Tanggal tidak boleh setelah hari ini.';
    if (!e.nama) continue;                                         // hanya keterangan
    var k = ref.karyawan.filter(function (x) { return x.nama === e.nama; })[0];
    if (!k) { if (sistem) continue; return e.nama + ' tidak ada di daftar karyawan.'; }
    if (!sistem && !k.aktif && !akses.semua) return e.nama + ' sudah tidak aktif.';
    if (boleh && boleh.indexOf(e.nama) < 0) return 'PIN ini tidak boleh mengabsen ' + e.nama + '.';
    var t = ref.tarif.filter(function (x) { return x.pilihan === e.pekerjaan; })[0];
    if (!t) { if (sistem) continue; return '"' + e.pekerjaan + '" tidak ada di Tarif Upah.'; }
    if (!sistem && !/^semua$/i.test(t.untuk) && t.untuk !== k.tim) return '"' + e.pekerjaan + '" bukan pilihan untuk ' + k.tim + '.';
    if (!sistem && akses.jobdeskSaja && (t.jenis === 'Kerja harian' || t.jenis === 'Kerja lain')) {
      return '"' + e.pekerjaan + '" bukan pekerjaan rutin ' + e.nama + '. Kerja harian dan kerja lain diisi mandor atau pemilik.';
    }
    if (t.jenis === 'Kerja lain' && !(e.upah >= 0)) return 'Upah kerja lain ' + e.nama + ' tidak valid.';
    if (t.jenis === 'Penyulingan') {
      if (e.alat && ref.alat.length && !ref.alat.some(function (a) { return a.nama === e.alat; })) return 'Alat "' + e.alat + '" tidak dikenal.';
      if (!e.alat) e.alat = (k.alat && alatAktif.indexOf(k.alat) >= 0) ? k.alat : (alatAktif.length === 1 ? alatAktif[0] : '');
      if (!e.alat && alatAktif.length > 1 && !sistem) return 'Pilih alat suling yang dipakai ' + e.nama + '.';
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
  return [waktu, Utilities.parseDate(e.tanggal, API_ZONA, 'yyyy-MM-dd'), e.nama, k ? k.tim : '', e.pekerjaan || '',
    e.alat || '', e.nama ? (t ? t.sulingan : 0) : 0, e.nama ? upah : 0, e.nama ? posUpah_(jenis, e.kerjaLainUntuk) : '',
    lain ? (e.pekerjaanLain || '') : '', lain ? (e.kerjaLainUntuk || '') : '', e.keterangan || '', oleh];
}

function kunciAbsensi_(r) {
  var tgl = adalahTanggal_(r[1]) ? tglIso_(r[1]) : teks_(r[1]);
  if (!teks_(r[2])) return tgl + '||ket|' + teks_(r[11]);
  return tgl + '|' + teks_(r[2]) + '|' + (teks_(r[4]) === 'Kerja lain' ? 'lain' : 'utama');
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
      '. Kalau salah, pemilik bisa mengubahnya lewat Riwayat.'};
  }
  if (!tulis.length) return {ok: true, dobel: true, ditambah: 0, bentrok: bentrok};
  sh.insertRowsBefore(2, tulis.length);
  sh.getRange(2, 2, tulis.length, 13).setValues(tulis);
  SpreadsheetApp.flush();
  rapikan_(sh, KEPALA_ABSENSI.length);
  return {ok: true, ditambah: tulis.length, dobel: dobel > 0 ? dobel : undefined, bentrok: bentrok};
}

// Isian baru di tab Absensi lama (format satu baris per hari) dipindahkan ke Absensi Harian.
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

// ---------------------------------------------------------------- TERBARU

function terbaru_(ss, akses, req) {
  var tab = teks_(req.tab);
  if (akses.tab.indexOf(tab) < 0) return {ok: false, galat: 'PIN ini tidak boleh melihat ' + tab + '.'};
  if (tab === 'Absensi') cobaPindahkanAbsensiLama_(ss);
  var n = Math.max(1, Math.min(Number(req.n) || 10, 60));
  var sh = ss.getSheetByName(namaSheet_(tab));
  if (!sh) return {ok: true, tab: tab, kepala: [], baris: []};
  var lastCol = sh.getLastColumn();
  var kepala = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  // Pekerja hanya melihat absensi orang yang boleh ia absen.
  var saring = null;
  if (tab === 'Absensi' && akses.absenUntuk) saring = namaBoleh_(akses, bacaKaryawan_(ss));
  var ambil = saring ? Math.min(Math.max(sh.getLastRow() - 1, 1), 400) : n;
  var tampil = sh.getRange(2, 1, ambil, lastCol).getDisplayValues();
  var hasil = {ok: true, tab: tab, kepala: kepala, baris: []};
  var info = akses.semua ? kolomForm_(sh) : null;
  var mentah = akses.semua ? sh.getRange(2, 2, ambil, info.kepala.length).getValues() : null;
  if (akses.semua) hasil.data = [];
  for (var i = 0; i < tampil.length && hasil.baris.length < n; i++) {
    if (!tampil[i][1] && !tampil[i][2]) continue;
    if (saring && saring.indexOf(teks_(tampil[i][3])) < 0) continue;
    hasil.baris.push(tampil[i]);
    if (akses.semua) hasil.data.push({nomor: i + 2, tanda: tandaBaris_(mentah[i]), nilai: nilaiMentah_(info.kepala, mentah[i])});
  }
  return hasil;
}

// ---------------------------------------------------------------- RINGKASAN

function ringkasan_(ss, akses) {
  if (!akses.semua) return {ok: false, galat: 'Ringkasan hanya untuk pemilik.'};
  cobaPindahkanAbsensiLama_(ss);
  SpreadsheetApp.flush();
  var dash = ss.getSheetByName('Dashboard');
  var rek = ss.getSheetByName('Rekap Mingguan');
  var rekBln = ss.getSheetByName('Rekap Bulanan');
  var tgl = function (d) { return adalahTanggal_(d) ? Utilities.formatDate(d, API_ZONA, 'dd/MM/yyyy') : teks_(d); };
  var angka = function (v) { return typeof v === 'number' ? v : null; };

  // Kolom upah per pekerja (untuk gajian) di Rekap Mingguan: "Upah <nama> (Rp)", mulai kolom W.
  var lebarRek = Math.max(26, rek.getLastColumn());
  var kepalaRek = rek.getRange(4, 1, 1, lebarRek).getDisplayValues()[0];
  var kolomOrang = [];
  for (var c = 22; c < kepalaRek.length; c++) {
    var cocok = /^Upah (.+) \(Rp\)$/.exec(teks_(kepalaRek[c]));
    if (cocok) kolomOrang.push({i: c, nama: cocok[1].replace(/^tim suling$/i, 'Tim suling')});
  }
  var perAlat = sulinganPerAlat_(ss);
  var minggu = function (v) {
    var mulai = tgl(v[0]);
    return {upahOrang: kolomOrang.map(function (k) { return {nama: k.nama, upah: angka(v[k.i]) || 0}; })
        .filter(function (o) { return o.upah !== 0; }),
      alat: perAlat[mulai] || [],
      mulai: mulai, sampai: tgl(v[1]), trip: angka(v[2]), bahanKg: angka(v[3]), beliBahan: angka(v[4]),
      hargaBahan: angka(v[5]), biayaJalan: angka(v[6]), sulingan: angka(v[7]), ketelKosong: angka(v[8]),
      sulinganDisaring: angka(v[9]), minyak: angka(v[10]), minyakPerSulingan: angka(v[11]), rendemen: angka(v[12]),
      upahPengumpul: angka(v[13]), upahPenyuling: angka(v[14]), operasional: angka(v[15]), biayaProduksi: angka(v[16]),
      biayaPerKg: angka(v[17]), terjual: angka(v[18]), penjualan: angka(v[19]), laba: angka(v[20]), upahHarian: angka(v[21])};
  };
  var bulan = function (v) {
    return {bulan: adalahTanggal_(v[0]) ? Utilities.formatDate(v[0], API_ZONA, 'MM/yyyy') : teks_(v[0]),
      penjualan: angka(v[19]), biayaProduksi: angka(v[16]), laba: angka(v[20]), pengembangan: angka(v[21]),
      cicilan: angka(v[22]), labaSetelahCicilan: angka(v[23]), keluarga: angka(v[24]), proyekBahan: angka(v[25]),
      upahHarian: angka(v[26]), pembiayaan: angka(v[27]), pemasukanLain: angka(v[28]), belumDibayar: angka(v[29]),
      perubahanKas: angka(v[30]), minyak: angka(v[10]), sulingan: angka(v[7])};
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

// Sulingan per alat per minggu (Senin), beserta operatornya: {"dd/MM/yyyy": [{nama, sulingan, operator: [{nama, sulingan}]}]}
function sulinganPerAlat_(ss) {
  var sh = ss.getSheetByName(SH_ABSENSI);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var data = sh.getRange(2, 3, sh.getLastRow() - 1, 6).getValues();   // C Tanggal .. H Jumlah sulingan
  var kumpul = {};
  data.forEach(function (r) {
    var s = Number(r[5]) || 0;
    if (!s || !adalahTanggal_(r[0])) return;
    var hari = Number(Utilities.formatDate(r[0], API_ZONA, 'u'));          // 1 = Senin
    var senin = Utilities.formatDate(new Date(r[0].getTime() - (hari - 1) * 86400000), API_ZONA, 'dd/MM/yyyy');
    var alat = teks_(r[4]) || '(tanpa alat)';
    var m = kumpul[senin] || (kumpul[senin] = {});
    var a = m[alat] || (m[alat] = {nama: alat, sulingan: 0, op: {}});
    a.sulingan += s;
    var nama = teks_(r[1]);
    a.op[nama] = (a.op[nama] || 0) + s;
  });
  Object.keys(kumpul).forEach(function (senin) {
    out[senin] = Object.keys(kumpul[senin]).sort().map(function (k) {
      var a = kumpul[senin][k];
      return {nama: a.nama, sulingan: a.sulingan, operator: Object.keys(a.op).map(function (n) { return {nama: n, sulingan: a.op[n]}; })};
    });
  });
  return out;
}

// ---------------------------------------------------------------- PEMILIK: UBAH & HAPUS CATATAN

function ubah_(ss, akses, req) {
  if (!akses.semua) return {ok: false, galat: 'Hanya pemilik yang boleh mengubah catatan.'};
  var tab = teks_(req.tab);
  if (API_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Tab tidak dikenal.'};
  var nilai = req.nilai || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = ss.getSheetByName(namaSheet_(tab));
    var info = kolomForm_(sh);
    var r = cariBaris_(sh, info, Number(req.nomor), teks_(req.tanda));
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
    }
    sh.getRange(r, 2, 1, baru.length).setValues([baru]);
    SpreadsheetApp.flush();
    if (typeof urutkanTab_ === 'function') urutkanTab_(sh);
    catatLog_(ss, 'Ubah', tab, r, JSON.stringify(nilaiMentah_(info.kepala, lama)), JSON.stringify(nilaiMentah_(info.kepala, baru)), akses.nama);
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
}

// Mengubah satu baris absensi: upah, pos, dan sulingan dihitung ulang dari Tarif Upah.
function ubahAbsensi_(ss, akses, sh, r, lama, nilai) {
  var ref = bacaReferensi_(ss);
  var e = {tanggal: teks_(nilai['Tanggal']), nama: teks_(nilai['Nama']), pekerjaan: teks_(nilai['Pekerjaan']),
    alat: teks_(nilai['Alat']), upah: Number(nilai['Upah (Rp)']) || 0, pekerjaanLain: teks_(nilai['Pekerjaan lain']),
    kerjaLainUntuk: teks_(nilai['Kerja lain untuk']), keterangan: teks_(nilai['Keterangan'])};
  if (!e.nama && !e.keterangan) return {ok: false, galat: 'Pilih nama karyawan.'};
  if (e.nama && !e.pekerjaan) return {ok: false, galat: 'Pilih pekerjaan.'};
  var g = periksaEntri_([e], akses, ref);
  if (g) return {ok: false, galat: g};
  var baris = barisAbsensi_(e, ref, teks_(lama[12]) || akses.nama, lama[0]);
  if (teks_(lama[12]).indexOf('diubah') < 0) baris[12] = (teks_(lama[12]) || '?') + ' (diubah ' + akses.nama + ')';
  // Tidak boleh bentrok dengan baris lain.
  var akhir = sh.getLastRow();
  var semua = sh.getRange(2, 2, akhir - 1, 13).getValues();
  var k = kunciAbsensi_(baris);
  for (var i = 0; i < semua.length; i++) {
    if (i + 2 !== r && adalahTanggal_(semua[i][1]) && kunciAbsensi_(semua[i]) === k) {
      return {ok: false, galat: e.nama + ' sudah punya catatan ' + (e.pekerjaan === 'Kerja lain' ? 'kerja lain' : 'absensi') +
        ' lain di tanggal itu. Ubah atau hapus yang itu.'};
    }
  }
  return {ok: true, baris: baris};
}

function hapus_(ss, akses, req) {
  if (!akses.semua) return {ok: false, galat: 'Hanya pemilik yang boleh menghapus catatan.'};
  var tab = teks_(req.tab);
  if (API_TAB.indexOf(tab) < 0) return {ok: false, galat: 'Tab tidak dikenal.'};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = ss.getSheetByName(namaSheet_(tab));
    var info = kolomForm_(sh);
    var r = cariBaris_(sh, info, Number(req.nomor), teks_(req.tanda));
    if (!r) return {ok: false, kode: 'BERUBAH', galat: 'Catatan ini sudah berubah atau terhapus. Muat ulang Riwayat, lalu coba lagi.'};
    var lama = sh.getRange(r, 2, 1, info.kepala.length).getValues()[0];
    sh.deleteRow(r);
    catatLog_(ss, 'Hapus', tab, r, JSON.stringify(nilaiMentah_(info.kepala, lama)), '', akses.nama);
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
    if (adalahTanggal_(v)) {
      var hanyaTgl = /^Tanggal/.test(kepala[j]) || (kepala[j] !== 'Timestamp' && Utilities.formatDate(v, API_ZONA, 'HH:mm') === '00:00');
      v = hanyaTgl ? Utilities.formatDate(v, API_ZONA, 'yyyy-MM-dd') : Utilities.formatDate(v, API_ZONA, 'dd/MM/yyyy HH:mm');
    }
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
