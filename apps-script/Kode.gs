/**
 * Sembada Karya Wangi: pembuat 5 Google Form untuk Catatan Usaha.
 *
 * Cara pakai (sekali saja, dari laptop):
 * 1. Di Google Sheet Catatan Usaha, buka menu Ekstensi > Apps Script.
 * 2. Hapus isi yang ada, tempel seluruh isi file ini, lalu klik ikon simpan.
 * 3. Pilih fungsi buatSemuaForm di bagian atas, lalu klik Jalankan.
 * 4. Izinkan akses saat diminta (Tinjau izin > pilih akun > Izinkan).
 *
 * Yang dikerjakan skrip:
 * - membuat cadangan file Sheet ini di Google Drive,
 * - membuat 5 form (Ambil Bahan, Saring Minyak, Absensi Harian, Penjualan, Kas Masuk & Keluar),
 * - menyambungkan tiap form ke tab yang sesuai, sambil memindahkan data lama ke tab itu,
 * - menulis tautan form di tab Panduan.
 *
 * Setiap form punya pertanyaan Keterangan untuk hal yang tidak seperti biasa.
 * Keterangan 14 hari terakhir dikumpulkan di bagian bawah tab Dashboard.
 *
 * Kalau daftar pekerja, daerah, pembeli, produk, kategori kas, atau tarif upah diubah,
 * jalankan perbaruiPilihanForm supaya pilihan di form ikut berubah.
 */

var DAFTAR = 'Daftar';
var TARIF = 'Tarif Upah';
var PANDUAN = 'Panduan';
var ZONA = 'Asia/Jakarta';

var POLA_ANGKA = '^[0-9]+$';
var PESAN_ANGKA = 'Tulis angka saja tanpa titik atau koma, contoh 250000';
var POLA_DESIMAL = '^[0-9]+([.][0-9]+)?$';
var PESAN_DESIMAL = 'Tulis angka. Untuk desimal pakai titik, contoh 3.28';

var FORMS = [
  {
    sheet: 'Ambil Bahan',
    judul: 'Ambil Bahan',
    deskripsi: 'Diisi pengumpul setiap pulang mengambil bahan. Satu isian untuk satu trip.',
    soal: [
      {jenis: 'tanggal', judul: 'Tanggal'},
      {jenis: 'centang', judul: 'Pengumpul', daftar: 'Pengumpul', bantuan: 'Centang semua yang ikut trip ini.'},
      {jenis: 'centang', judul: 'Daerah', daftar: 'Daerah', lainnya: true},
      {jenis: 'pilih', judul: 'Kondisi bahan', daftar: 'Kondisi bahan'},
      {jenis: 'desimal', judul: 'Berat bahan (kg)', bantuan: 'Hasil timbang, contoh 1075.'},
      {jenis: 'angka', judul: 'Uang dibawa (Rp)', bantuan: 'Contoh 300000.'},
      {jenis: 'angka', judul: 'Uang sisa (Rp)', bantuan: 'Uang yang kembali setelah beli bahan.'},
      {jenis: 'angka', judul: 'Biaya lain di jalan (Rp)', bantuan: 'Es, tali rafia, tambal ban, tukar koin. Isi 0 kalau tidak ada.'},
      {jenis: 'teks', judul: 'Keterangan biaya lain', wajib: false},
      {jenis: 'paragraf', judul: 'Keterangan', wajib: false,
        bantuan: 'Isi kalau ada yang tidak seperti biasa, misalnya harga bahan naik, bahan basah, ganti daerah, atau pikap bermasalah. Kosongkan kalau semua biasa.'}
    ]
  },
  {
    sheet: 'Saring Minyak',
    judul: 'Saring Minyak',
    deskripsi: 'Diisi tim suling setiap kali menyaring minyak.',
    soal: [
      {jenis: 'tanggal', judul: 'Tanggal saring'},
      {jenis: 'angka', judul: 'Jumlah sulingan yang disaring', bantuan: 'Berapa kali suling sejak saringan terakhir.'},
      {jenis: 'desimal', judul: 'Minyak (kg)', bantuan: 'Pakai titik untuk desimal, contoh 3.28.'},
      {jenis: 'desimal', judul: 'Hidrosol diambil (liter)', wajib: false},
      {jenis: 'pilih', judul: 'Kondisi bahan', daftar: 'Kondisi bahan'},
      {jenis: 'centang', judul: 'Kondisi alat', daftar: 'Kondisi alat', lainnya: true},
      {jenis: 'desimal', judul: 'Stok minyak di gudang (kg)', wajib: false, bantuan: 'Timbang semua minyak yang ada setelah disaring.'},
      {jenis: 'paragraf', judul: 'Keterangan', wajib: false,
        bantuan: 'Isi kalau ada yang tidak seperti biasa, misalnya minyak lebih sedikit, bahan terlalu kering atau basah, alat rusak, atau minyak dicampur. Kosongkan kalau semua biasa.'}
    ]
  },
  {
    sheet: 'Absensi',
    judul: 'Absensi Harian',
    deskripsi: 'Diisi setiap sore. Pilih Libur untuk yang tidak bekerja hari ini. ' +
      'Pilih Kerja lain untuk pekerjaan di luar tarif biasa, lalu isi upahnya di halaman berikutnya.',
    soal: [
      {jenis: 'tanggal', judul: 'Tanggal'},
      {jenis: 'kisi', judul: 'Pengumpul', baris: 'Pengumpul', tarif: 'Pengumpul'},
      {jenis: 'kisi', judul: 'Tim suling', baris: 'Tim suling', tarif: 'Tim suling'},
      {jenis: 'paragraf', judul: 'Keterangan', wajib: false,
        bantuan: 'Isi kalau ada yang tidak seperti biasa, misalnya ada yang izin, pulang lebih awal, ketel tidak jalan, atau hujan. Kosongkan kalau semua biasa.'},
      {jenis: 'cabang', judul: 'Ada kerja lain dengan upah khusus hari ini?',
        bantuan: 'Pilih Ya kalau ada yang mengerjakan pekerjaan di luar tarif biasa, misalnya menambal kolam bocor.'},
      {jenis: 'bagian', judul: 'Kerja lain hari ini',
        bantuan: 'Upah di sini ditambahkan ke upah dari tabel absensi. Kosongkan untuk yang tidak ikut.'},
      {jenis: 'teks', judul: 'Pekerjaan lain', bantuan: 'Contoh: tambal kolam bocor.'},
      {jenis: 'pilih', judul: 'Kerja lain untuk', daftar: 'Kerja lain untuk'},
      {jenis: 'upahLain', judulDepan: 'Upah kerja lain ', daftarOrang: ['Pengumpul', 'Tim suling']}
    ]
  },
  {
    sheet: 'Penjualan',
    judul: 'Penjualan',
    deskripsi: 'Satu isian untuk satu produk. Kalau pembeli mengambil minyak dan hidrosol, isi dua kali.',
    soal: [
      {jenis: 'tanggal', judul: 'Tanggal'},
      {jenis: 'pilih', judul: 'Pembeli', daftar: 'Pembeli', lainnya: true},
      {jenis: 'pilih', judul: 'Produk', daftar: 'Produk'},
      {jenis: 'desimal', judul: 'Jumlah', bantuan: 'kg untuk minyak, liter untuk hidrosol. Pakai titik untuk desimal.'},
      {jenis: 'angka', judul: 'Harga satuan (Rp)', bantuan: 'Harga per kg atau per liter, contoh 600000.'},
      {jenis: 'pilih', judul: 'Status bayar', daftar: 'Status bayar'},
      {jenis: 'teks', judul: 'Pengiriman', wajib: false},
      {jenis: 'paragraf', judul: 'Keterangan', wajib: false,
        bantuan: 'Isi kalau ada yang tidak seperti biasa, misalnya harga beda dari biasanya, dibayar sebagian, atau ada potongan. Kosongkan kalau semua biasa.'}
    ]
  },
  {
    sheet: 'Kas',
    judul: 'Kas Masuk & Keluar',
    deskripsi: 'Untuk uang keluar atau masuk selain beli bahan, upah pekerja, dan penjualan. Ketiganya sudah dicatat di form lain.',
    soal: [
      {jenis: 'tanggal', judul: 'Tanggal'},
      {jenis: 'daftar', judul: 'Kategori', daftar: 'Kategori kas'},
      {jenis: 'angka', judul: 'Jumlah (Rp)'},
      {jenis: 'teks', judul: 'Keterangan',
        bantuan: 'Untuk apa uangnya, contoh: bensin Grandmax, jatah keluarga, semen 10 sak. Kalau tidak seperti biasa (harga naik, beli mendadak), tulis alasannya juga.'}
    ]
  }
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sembada')
    .addItem('Pasang 5 form (sekali saja)', 'buatSemuaForm')
    .addItem('Perbarui pilihan form', 'perbaruiPilihanForm')
    .addToUi();
}

function buatSemuaForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var belum = FORMS.filter(function (spec) {
    var sh = ss.getSheetByName(spec.sheet);
    return sh && !sh.getFormUrl();
  });
  if (belum.length === 0) {
    ss.toast('Semua form sudah terpasang. Tidak ada yang diubah.', 'Sembada', 10);
    return;
  }
  // Periksa semua tab dulu sebelum mengubah apa pun.
  belum.forEach(function (spec) { periksaJudulKolom_(ss, spec); });

  var stempel = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH.mm');
  var file = DriveApp.getFileById(ss.getId());
  var cadangan = file.makeCopy(ss.getName() + ' (cadangan ' + stempel + ')');
  Logger.log('Cadangan dibuat: ' + cadangan.getUrl());

  var hasil = [];
  belum.forEach(function (spec) {
    ss.toast('Memasang form ' + spec.judul + '...', 'Sembada', 30);
    var form = pasangForm_(ss, spec, file);
    hasil.push(spec.judul + ': ' + form.getPublishedUrl());
  });
  Logger.log(hasil.join('\n'));
  ss.toast('Selesai. Tautan form ada di tab Panduan, kolom E.', 'Sembada', 15);
}

function perbaruiPilihanForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var n = 0;
  FORMS.forEach(function (spec) {
    var sh = ss.getSheetByName(spec.sheet);
    if (!sh || !sh.getFormUrl()) return;
    var form = FormApp.openByUrl(sh.getFormUrl());
    var items = form.getItems();
    soalLengkap_(ss, spec).forEach(function (s) {
      if (!s.daftar && !s.tarif) return;
      var item = items.filter(function (it) { return it.getTitle() === s.judul; })[0];
      if (!item) return;
      var t = item.getType();
      if (t === FormApp.ItemType.CHECKBOX) item.asCheckboxItem().setChoiceValues(bacaDaftar_(ss, s.daftar));
      else if (t === FormApp.ItemType.MULTIPLE_CHOICE) item.asMultipleChoiceItem().setChoiceValues(bacaDaftar_(ss, s.daftar));
      else if (t === FormApp.ItemType.LIST) item.asListItem().setChoiceValues(bacaDaftar_(ss, s.daftar));
      else if (t === FormApp.ItemType.GRID) item.asGridItem().setColumns(bacaTarif_(ss, s.tarif));
      n++;
    });
  });
  ss.toast(n + ' pertanyaan diperbarui. Nama pekerja di Absensi tidak ikut berubah; untuk itu ubah form-nya langsung.', 'Sembada', 15);
}

// ---------------------------------------------------------------------------

// Daftar pertanyaan lengkap: isian upah kerja lain dibuat satu per pekerja dari tab Daftar.
function soalLengkap_(ss, spec) {
  var out = [];
  spec.soal.forEach(function (s) {
    if (s.jenis === 'upahLain') {
      s.daftarOrang.forEach(function (kelompok) {
        bacaDaftar_(ss, kelompok).forEach(function (nama) {
          out.push({jenis: 'angka', judul: s.judulDepan + nama + ' (Rp)', wajib: false,
            bantuan: kelompok === 'Tim suling' ? 'Upah untuk berdua. Kosongkan kalau tidak ikut.' : 'Kosongkan kalau tidak ikut.'});
        });
      });
    } else {
      out.push(s);
    }
  });
  return out;
}

// Judul kolom jawaban sesuai urutan yang dibuat Google Form (tanpa kolom stempel waktu).
function judulJawaban_(ss, spec) {
  var out = [];
  soalLengkap_(ss, spec).forEach(function (s) {
    if (s.jenis === 'bagian') return;
    if (s.jenis === 'kisi') {
      bacaDaftar_(ss, s.baris).forEach(function (b) { out.push(s.judul + ' [' + b + ']'); });
    } else {
      out.push(s.judul);
    }
  });
  return out;
}

function periksaJudulKolom_(ss, spec) {
  var sh = ss.getSheetByName(spec.sheet);
  var harap = judulJawaban_(ss, spec);
  var ada = sh.getRange(1, 2, 1, harap.length).getDisplayValues()[0];
  for (var i = 0; i < harap.length; i++) {
    if (String(ada[i]).trim() !== harap[i]) {
      throw new Error('Tab ' + spec.sheet + ', kolom ' + (i + 2) + ': judulnya "' + ada[i] + '", seharusnya "' + harap[i] +
        '". Kembalikan judul kolomnya, lalu jalankan lagi. Belum ada yang diubah.');
    }
  }
}

function pasangForm_(ss, spec, fileSheet) {
  var lama = ss.getSheetByName(spec.sheet);
  var posisi = lama.getIndex();
  var harap = judulJawaban_(ss, spec);
  var nForm = 1 + harap.length;              // kolom stempel waktu + jawaban

  var form = FormApp.create(spec.judul + ' | Sembada Karya Wangi');
  form.setDescription(spec.deskripsi);
  form.setConfirmationMessage('Terima kasih, data sudah tersimpan.');
  var cabang = null;
  soalLengkap_(ss, spec).forEach(function (s) {
    if (s.jenis === 'bagian') {
      var halaman = form.addPageBreakItem().setTitle(s.judul);
      if (s.bantuan) halaman.setHelpText(s.bantuan);
      if (cabang) {
        cabang.setChoices([cabang.createChoice('Ya', halaman),
                           cabang.createChoice('Tidak', FormApp.PageNavigationType.SUBMIT)]);
        cabang = null;
      }
      return;
    }
    var item = tambahSoal_(ss, form, s);
    if (s.jenis === 'cabang') cabang = item;
  });
  if (cabang) cabang.setChoiceValues(['Ya', 'Tidak']);

  // Sambungkan ke Sheet ini dan cari tab jawaban yang baru dibuat.
  var sebelum = ss.getSheets().map(function (s) { return s.getSheetId(); });
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  var baru = null;
  for (var coba = 0; coba < 15 && !baru; coba++) {
    SpreadsheetApp.flush();
    var semua = SpreadsheetApp.openById(ss.getId()).getSheets();
    for (var i = 0; i < semua.length; i++) {
      if (sebelum.indexOf(semua[i].getSheetId()) < 0) { baru = semua[i]; break; }
    }
    if (!baru) Utilities.sleep(1000);
  }
  if (!baru) throw new Error('Tab jawaban untuk ' + spec.judul + ' tidak ditemukan. Form sudah dibuat: ' + form.getEditUrl());

  var kepalaBaru = baru.getRange(1, 1, 1, baru.getLastColumn()).getDisplayValues()[0];
  var cocok = kepalaBaru.length === nForm;
  for (var j = 1; cocok && j < nForm; j++) cocok = String(kepalaBaru[j]).trim() === harap[j - 1];
  if (!cocok) {
    form.removeDestination();
    ss.deleteSheet(baru);
    throw new Error('Judul kolom form ' + spec.judul + ' tidak cocok dengan tab ' + spec.sheet +
      '. Form tidak disambungkan dan data tidak dipindah. Form: ' + form.getEditUrl());
  }

  // Tab jawaban baru berupa "tabel" Google Sheets yang melarang rumus di baris judul.
  // Melepas tabel ikut menghapus isinya, jadi judul kolom ditulis ulang sesudahnya.
  hapusTabel_(ss, baru);
  baru.getRange(1, 1, 1, kepalaBaru.length).setValues([kepalaBaru]);
  SpreadsheetApp.flush();

  // Pindahkan data lama (hanya kolom isian, bukan kolom otomatis).
  var namaLama = spec.sheet + ' (lama)';
  lama.setName(namaLama);
  baru.setName(spec.sheet);
  var barisAkhir = lama.getLastRow();
  var kolomAkhir = lama.getLastColumn();
  var lebar = Math.max(kolomAkhir, nForm);
  if (baru.getMaxColumns() < lebar) baru.insertColumnsAfter(baru.getMaxColumns(), lebar - baru.getMaxColumns());
  if (baru.getMaxRows() < barisAkhir + 200) baru.insertRowsAfter(baru.getMaxRows(), barisAkhir + 200 - baru.getMaxRows());
  if (barisAkhir > 1) {
    var data = lama.getRange(2, 1, barisAkhir - 1, nForm).getValues().filter(function (r) {
      return r.slice(1).some(function (v) { return v !== '' && v !== null; });
    });
    if (data.length) baru.getRange(2, 1, data.length, nForm).setValues(data);
  }

  // Salin kolom otomatis (rumus di baris judul) ke kanan kolom isian.
  for (var c = nForm + 1; c <= kolomAkhir; c++) {
    var sel = lama.getRange(1, c);
    var rumus = sel.getFormula();
    if (rumus) baru.getRange(1, c).setFormula(rumus);
    else baru.getRange(1, c).setValue(sel.getValue());
  }

  // Format, lebar kolom, dan validasi ikut disalin.
  lama.getRange(1, 1, 1, lebar).copyTo(baru.getRange(1, 1, 1, lebar), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  var sisaBaris = baru.getMaxRows() - 1;
  if (lama.getMaxRows() > 1 && sisaBaris > 0) {
    lama.getRange(2, 1, 1, lebar).copyTo(baru.getRange(2, 1, sisaBaris, lebar), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    lama.getRange(2, 1, 1, lebar).copyTo(baru.getRange(2, 1, sisaBaris, lebar), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }
  for (var k = 1; k <= lebar; k++) baru.setColumnWidth(k, lama.getColumnWidth(k));
  baru.setFrozenRows(1);

  // Arahkan semua rumus rekap dari tab lama ke tab baru, lalu hapus tab lama.
  ss.createTextFinder("'" + namaLama + "'!").matchFormulaText(true).replaceAllWith("'" + spec.sheet + "'!");
  SpreadsheetApp.flush();
  var sisa = ss.createTextFinder("'" + namaLama + "'!").matchFormulaText(true).findAll().length;
  if (sisa > 0) {
    throw new Error(sisa + ' rumus masih menunjuk ke tab "' + namaLama + '". Tab lama tidak dihapus. Hubungi Claude dengan pesan ini.');
  }
  ss.deleteSheet(lama);
  ss.setActiveSheet(baru);
  ss.moveActiveSheet(posisi);

  // Taruh form di folder yang sama dengan Sheet, lalu tulis tautannya di Panduan.
  try {
    var folder = fileSheet.getParents().hasNext() ? fileSheet.getParents().next() : null;
    if (folder) DriveApp.getFileById(form.getId()).moveTo(folder);
  } catch (e) {
    Logger.log('Form tidak dipindah ke folder: ' + e);
  }
  tulisTautan_(ss, spec.sheet, form);
  return form;
}

// Melepas format tabel lewat Sheets API. Isi tab ikut terhapus, jadi panggil ini sebelum ada data.
function hapusTabel_(ss, sheet) {
  var kepala = {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()};
  var dasar = 'https://sheets.googleapis.com/v4/spreadsheets/' + ss.getId();
  var res = UrlFetchApp.fetch(dasar + '?fields=sheets(properties.sheetId,tables.tableId)', {headers: kepala, muteHttpExceptions: true});
  if (res.getResponseCode() !== 200) throw new Error('Gagal membaca tabel: ' + res.getContentText());
  var ids = [];
  (JSON.parse(res.getContentText()).sheets || []).forEach(function (sh) {
    if (sh.properties.sheetId === sheet.getSheetId() && sh.tables) {
      sh.tables.forEach(function (t) { ids.push(t.tableId); });
    }
  });
  if (!ids.length) return;
  var hapus = UrlFetchApp.fetch(dasar + ':batchUpdate', {
    method: 'post', contentType: 'application/json', headers: kepala, muteHttpExceptions: true,
    payload: JSON.stringify({requests: ids.map(function (id) { return {deleteTable: {tableId: id}}; })})
  });
  if (hapus.getResponseCode() !== 200) throw new Error('Gagal melepas format tabel: ' + hapus.getContentText());
  SpreadsheetApp.flush();
}

function tambahSoal_(ss, form, s) {
  var wajib = s.wajib !== false;
  var item;
  if (s.jenis === 'tanggal') {
    item = form.addDateItem();
  } else if (s.jenis === 'centang') {
    item = form.addCheckboxItem().setChoiceValues(bacaDaftar_(ss, s.daftar));
    if (s.lainnya) item.showOtherOption(true);
  } else if (s.jenis === 'pilih') {
    item = form.addMultipleChoiceItem().setChoiceValues(bacaDaftar_(ss, s.daftar));
    if (s.lainnya) item.showOtherOption(true);
  } else if (s.jenis === 'cabang') {
    item = form.addMultipleChoiceItem();   // pilihan Ya/Tidak dipasang setelah halaman berikutnya dibuat
  } else if (s.jenis === 'daftar') {
    item = form.addListItem().setChoiceValues(bacaDaftar_(ss, s.daftar));
  } else if (s.jenis === 'angka' || s.jenis === 'desimal') {
    var pola = s.jenis === 'angka' ? POLA_ANGKA : POLA_DESIMAL;
    var pesan = s.jenis === 'angka' ? PESAN_ANGKA : PESAN_DESIMAL;
    item = form.addTextItem().setValidation(
      FormApp.createTextValidation().setHelpText(pesan).requireTextMatchesPattern(pola).build());
  } else if (s.jenis === 'teks') {
    item = form.addTextItem();
  } else if (s.jenis === 'paragraf') {
    item = form.addParagraphTextItem();
  } else if (s.jenis === 'kisi') {
    item = form.addGridItem().setRows(bacaDaftar_(ss, s.baris)).setColumns(bacaTarif_(ss, s.tarif));
  } else {
    throw new Error('Jenis pertanyaan tidak dikenal: ' + s.jenis);
  }
  item.setTitle(s.judul).setRequired(wajib);
  if (s.bantuan) item.setHelpText(s.bantuan);
  return item;
}

function bacaDaftar_(ss, judul) {
  var sh = ss.getSheetByName(DAFTAR);
  var kepala = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  var c = kepala.indexOf(judul);
  if (c < 0) throw new Error('Kolom "' + judul + '" tidak ada di tab ' + DAFTAR + '.');
  var n = Math.max(sh.getLastRow() - 1, 1);
  var isi = sh.getRange(2, c + 1, n, 1).getDisplayValues().map(function (r) { return String(r[0]).trim(); });
  isi = isi.filter(function (v) { return v !== ''; });
  if (!isi.length) throw new Error('Daftar "' + judul + '" di tab ' + DAFTAR + ' masih kosong.');
  return isi;
}

function bacaTarif_(ss, untuk) {
  var sh = ss.getSheetByName(TARIF);
  var n = Math.max(sh.getLastRow() - 1, 1);
  var isi = sh.getRange(2, 1, n, 2).getDisplayValues();
  var out = [];
  isi.forEach(function (r) {
    var pilihan = String(r[0]).trim();
    if (pilihan && (r[1] === untuk || r[1] === 'Semua') && out.indexOf(pilihan) < 0) out.push(pilihan);
  });
  if (!out.length) throw new Error('Tidak ada pilihan tarif untuk ' + untuk + ' di tab ' + TARIF + '.');
  return out;
}

function tulisTautan_(ss, namaTab, form) {
  var sh = ss.getSheetByName(PANDUAN);
  if (!sh) return;
  var nilai = sh.getRange(1, 4, sh.getLastRow(), 1).getDisplayValues();
  for (var i = 0; i < nilai.length; i++) {
    if (nilai[i][0] === namaTab) {
      var sel = sh.getRange(i + 1, 5);
      sel.setValue(form.getPublishedUrl());
      sel.setNote('Untuk mengubah pertanyaan form: ' + form.getEditUrl());
      return;
    }
  }
}
