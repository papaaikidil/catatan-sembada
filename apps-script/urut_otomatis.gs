/**
 * SEMBADA KARYA WANGI – Urutkan otomatis entri form
 *
 * Gunanya: setiap ada entri baru dari Google Form, tab tujuannya langsung
 * diurutkan berdasarkan Tanggal, jadi entri TERBARU selalu ada di PALING ATAS
 * (baris 2, tepat di bawah judul).
 *
 * Cara pasang (sekali saja):
 *   1. Hapus semua isi editor, lalu tempel seluruh isi file ini.
 *   2. Klik ikon simpan.
 *   3. Pilih fungsi "pasangUrutOtomatis" di bagian atas editor.
 *   4. Klik Jalankan, lalu izinkan aksesnya.
 *   5. Tunggu tulisan "Selesai" di log. Setelah itu tidak perlu apa-apa lagi.
 *
 * Yang diurutkan hanya kolom isian form (judul hijau tua).
 * Kolom Hari dan kolom abu-abu dihitung otomatis, jadi ikut menyesuaikan sendiri.
 */

var TAB_URUT = ['Ambil Bahan', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
var KOLOM_TANGGAL = 3;    // kolom C
var KOLOM_TIMESTAMP = 2;  // kolom B

/** Jalankan SEKALI untuk memasang pengurutan otomatis. */
function pasangUrutOtomatis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Hapus pemicu lama dengan nama yang sama supaya tidak dobel.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'urutkanSetelahIsi') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('urutkanSetelahIsi').forSpreadsheet(ss).onFormSubmit().create();
  urutkanSemuaSekarang();
  Logger.log('Selesai. Entri baru dari form akan otomatis masuk di paling atas.');
}

/** Dipanggil otomatis oleh Google setiap ada entri form baru. */
function urutkanSetelahIsi(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    Utilities.sleep(1500); // beri waktu form selesai menulis baris
    var sh = (e && e.range) ? e.range.getSheet() : null;
    if (sh && TAB_URUT.indexOf(sh.getName()) >= 0) urutkanTab_(sh);
  } finally {
    lock.releaseLock();
  }
}

/** Boleh dijalankan manual kapan saja untuk merapikan semua tab. */
function urutkanSemuaSekarang() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  TAB_URUT.forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    if (sh) urutkanTab_(sh);
  });
}

function urutkanTab_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < KOLOM_TANGGAL) return;

  // Kolom isian form: dari kolom B sampai sebelum kolom rumus (abu-abu) pertama.
  var rumusJudul = sh.getRange(1, 1, 1, lastCol).getFormulas()[0];
  var c = KOLOM_TANGGAL;
  while (c <= lastCol && rumusJudul[c - 1] === '') c++;
  var kolomAkhirForm = c - 1;
  var jumlahKolom = kolomAkhirForm - KOLOM_TIMESTAMP + 1;
  if (jumlahKolom < 2) return;

  // Baris terakhir yang berisi Timestamp atau Tanggal.
  var maxBaris = sh.getMaxRows();
  if (maxBaris < 3) return;
  var isi = sh.getRange(2, KOLOM_TIMESTAMP, maxBaris - 1, 2).getValues();
  var barisAkhir = 1;
  for (var i = isi.length - 1; i >= 0; i--) {
    if (isi[i][0] !== '' || isi[i][1] !== '') { barisAkhir = i + 2; break; }
  }
  if (barisAkhir < 3) return;

  // 1. Form menulis baris baru tanpa format (misalnya 7000, bukan Rp7,000).
  //    Samakan format semua baris dengan baris paling bawah. Baris paling bawah
  //    adalah data paling lama, jadi formatnya pasti sudah rapi.
  sh.getRange(barisAkhir, 1, 1, lastCol).copyTo(
    sh.getRange(2, 1, barisAkhir - 2, lastCol),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

  // 2. Urutkan: tanggal terbaru di atas. Kalau tanggalnya sama, yang diisi belakangan di atas.
  sh.getRange(2, KOLOM_TIMESTAMP, barisAkhir - 1, jumlahKolom).sort([
    {column: KOLOM_TANGGAL, ascending: false},
    {column: KOLOM_TIMESTAMP, ascending: false}
  ]);
}
