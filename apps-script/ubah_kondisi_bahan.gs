/**
 * SEMBADA KARYA WANGI – Ganti pertanyaan "Jenis bahan" menjadi "Kondisi bahan"
 *
 * Mengubah form Ambil Bahan dan Saring Minyak.
 * Cara pakai (sekali saja):
 *   1. Pilih fungsi "ubahKeKondisiBahan" di bagian atas editor.
 *   2. Klik Jalankan, lalu izinkan aksesnya kalau diminta.
 *   3. Tunggu tulisan "Selesai" di log. File ini boleh dihapus sesudahnya.
 */

var PILIHAN_KONDISI_BAHAN = [
  'Segar semua',
  'Cuma sedikit yang kering',
  'Setengah bagian kering',
  'Agak kering semua'
];

var BANTUAN_KONDISI_BAHAN = {
  'Ambil Bahan': 'Kondisi bahan yang diambil pada trip ini, dilihat secara keseluruhan.',
  'Saring Minyak': 'Kondisi bahan yang disuling sejak saringan terakhir, dilihat secara keseluruhan.'
};

function ubahKeKondisiBahan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hasil = [];

  Object.keys(BANTUAN_KONDISI_BAHAN).forEach(function (namaTab) {
    var sh = ss.getSheetByName(namaTab);
    if (!sh || !sh.getFormUrl()) {
      hasil.push(namaTab + ': form tidak ditemukan, dilewati.');
      return;
    }
    var form = FormApp.openByUrl(sh.getFormUrl());
    var item = form.getItems().filter(function (it) {
      var judul = it.getTitle();
      return judul === 'Jenis bahan' || judul === 'Kondisi bahan';
    })[0];
    if (!item) {
      hasil.push(namaTab + ': pertanyaan Jenis bahan tidak ditemukan, dilewati.');
      return;
    }

    var bantuan = BANTUAN_KONDISI_BAHAN[namaTab];
    var tipe = item.getType();
    if (tipe === FormApp.ItemType.MULTIPLE_CHOICE) {
      item.asMultipleChoiceItem().setTitle('Kondisi bahan').setHelpText(bantuan)
        .setChoiceValues(PILIHAN_KONDISI_BAHAN).showOtherOption(false);
    } else if (tipe === FormApp.ItemType.LIST) {
      item.asListItem().setTitle('Kondisi bahan').setHelpText(bantuan)
        .setChoiceValues(PILIHAN_KONDISI_BAHAN);
    } else if (tipe === FormApp.ItemType.CHECKBOX) {
      item.asCheckboxItem().setTitle('Kondisi bahan').setHelpText(bantuan)
        .setChoiceValues(PILIHAN_KONDISI_BAHAN);
    } else {
      hasil.push(namaTab + ': jenis pertanyaan tidak dikenal, dilewati.');
      return;
    }

    // Pastikan judul kolom di tab ikut berganti.
    var judulKolom = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var c = judulKolom.indexOf('Jenis bahan');
    if (c >= 0) sh.getRange(1, c + 1).setValue('Kondisi bahan');

    hasil.push(namaTab + ': OK');
  });

  Logger.log(hasil.join('\n'));
  Logger.log('Selesai. Pertanyaan Kondisi bahan sudah terpasang di form.');
}
