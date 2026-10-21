// Sheet tiruan yang meniru struktur Google Sheet "Sembada" yang asli (judul kolom, kolom rumus, data contoh).
const { buatSheet, tgl, formatTanggal } = require('./tiruan7');

const isoHari = n => formatTanggal(new Date(Date.now() + n * 864e5), 'yyyy-MM-dd');

function buatData(opsi) {
  opsi = opsi || {};
  const h0 = isoHari(0), h1 = isoHari(-1), h2 = isoHari(-2), h9 = isoHari(-9);
  const s = {};
  s['Ambil Bahan'] = buatSheet('Ambil Bahan', [
    ['Hari', 'Timestamp', 'Tanggal', 'Pengumpul', 'Daerah', 'Kondisi bahan', 'Berat bahan (kg)', 'Uang dibawa (Rp)', 'Uang sisa (Rp)',
      'Biaya lain di jalan (Rp)', 'Keterangan biaya lain', 'Keterangan', 'Uang beli bahan (Rp)', 'Harga bahan per kg (Rp)'],
    ['Rabu', new Date(Date.now() - 864e5), tgl(h1), 'Rofik, Pak Muh, Mas Romadi', 'Plosokerep, Tanen', 'Cuma sedikit yang kering', 1323, 550000, 30000, 20000,
      'Tambah angin + Es poci', '', 500000, 378],
    ['Kamis', new Date(Date.now() - 9 * 864e5), tgl(h9), 'Pak Muh, Mas Romadi', 'Blimbing (Mbok Mi), Tanen', 'Tidak dicatat', 1091, 550000, 56000, 15000, 'es', '', 479000, 439]
  ], [0, 12, 13]);
  s['Saring Minyak'] = buatSheet('Saring Minyak', [
    ['Hari', 'Timestamp', 'Tanggal saring', 'Jumlah sulingan yang disaring', 'Minyak (kg)', 'Hidrosol diambil (liter)', 'Kondisi bahan', 'Kondisi alat',
      'Stok minyak di gudang (kg)', 'Keterangan', 'Minyak per sulingan (kg)'],
    ['Jumat', new Date(Date.now() - 9 * 864e5), tgl(h9), 3, 5.44, '', 'Tidak dicatat', 'Normal', '', '3 x suling', 1.81]
  ], [0, 10]);
  s['Absensi Harian'] = buatSheet('Absensi Harian', [
    ['Hari', 'Timestamp', 'Tanggal', 'Nama', 'Tim', 'Pekerjaan', 'Alat', 'Jumlah sulingan', 'Upah (Rp)', 'Pos upah', 'Pekerjaan lain', 'Kerja lain untuk', 'Keterangan', 'Diisi oleh'],
    ['Selasa', new Date(Date.now() - 2 * 864e5), tgl(h2), 'Rofik', 'Pengumpul', '1 trip', '', 0, 76000, 'Pengumpulan', '', '', '', 'Absensi lama'],
    ['Selasa', new Date(Date.now() - 2 * 864e5), tgl(h2), 'Pak Muh', 'Pengumpul', 'Kerja lain', '', 0, 115000, 'Harian & lain', 'ngaci kolam', 'Proyek bangunan & lainnya', '', 'Absensi lama'],
    ['Selasa', new Date(Date.now() - 2 * 864e5), tgl(h2), 'Eko & Pak Gatot', 'Tim suling', '2x suling', 'Ketel 1', 2, 180000, 'Penyulingan', '', '', '', 'Absensi lama'],
    ['Kamis', new Date(Date.now() - 9 * 864e5), tgl(h9), 'Eko & Pak Gatot', 'Tim suling', '3x suling', 'Ketel 1', 3, 295000, 'Penyulingan', '', '', 'bahan basah', 'Absensi lama']
  ], [0]);
  s['Absensi'] = buatSheet('Absensi', [['Hari', 'Timestamp', 'Tanggal', 'Pengumpul [Rofik]', 'Pengumpul [Pak Muh]', 'Tim suling [Eko & Pak Gatot]', 'Keterangan',
    'Ada kerja lain dengan upah khusus hari ini?', 'Pekerjaan lain', 'Kerja lain untuk', 'Upah kerja lain Rofik (Rp)', 'Upah kerja lain Pak Muh (Rp)',
    'Upah kerja lain Eko & Pak Gatot (Rp)', 'Upah Rofik']], [0, 13]);
  s['Penjualan'] = buatSheet('Penjualan', [
    ['Hari', 'Timestamp', 'Tanggal', 'Pembeli', 'Produk', 'Jumlah', 'Harga satuan (Rp)', 'Status bayar', 'Pengiriman', 'Keterangan', 'Satuan', 'Total (Rp)', 'Minyak terjual (kg)'],
    ['Rabu', new Date(Date.now() - 864e5), tgl(h1), 'Lusiani', 'Minyak jeruk purut (campur)', 15.94, 600000, 'Belum dibayar', 'kirim', '', 'kg', 9564000, 15.94]
  ], [0, 10, 11, 12]);
  s['Kas'] = buatSheet('Kas', [
    ['Hari', 'Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Kelompok', 'Arah'],
    ['Rabu', new Date(Date.now() - 864e5), tgl(h1), 'Proyek bangunan', 200000, 'service disel', 'Proyek lain', 'Keluar']
  ], [0, 6, 7]);
  s['Pengguna'] = buatSheet('Pengguna', [['Nama', 'PIN', 'Peran', 'Boleh mengisi', 'Absen untuk', 'Aktif', 'Catatan'],
    ['Mas Wildan', '250610', 'Pemilik', 'Semua', '', 'Ya', 'Jangan dibagikan.'],
    ['Rofik', '5420', 'Pekerja', 'Ambil Bahan', 'Rofik', 'Ya', ''],
    ['Pak Muh', '9912', 'Pekerja', 'Ambil Bahan', 'Pak Muh', 'Ya', ''],
    ['Mas Romadi', '1508', 'Pekerja', 'Ambil Bahan', 'Mas Romadi', 'Ya', ''],
    ['Eko', '9937', 'Pekerja', '', 'Eko & Pak Gatot', 'Ya', ''],
    ['Pak Gatot', '6596', 'Pekerja', '', 'Eko & Pak Gatot', 'Ya', ''],
    ['Pengumpul (PIN lama bersama)', '8888', 'Pekerja', 'Ambil Bahan', 'Semua Pengumpul', 'Ya', 'Hapus nanti'],
    ['Tim suling (PIN lama bersama)', '9999', 'Pekerja', '', 'Semua Tim suling', 'Ya', 'Hapus nanti']]);
  s['Karyawan'] = buatSheet('Karyawan', [['Nama', 'Tim', 'Alat', 'Aktif', 'Catatan', 'No HP', 'Tanggal keluar'],
    ['Rofik', 'Pengumpul', '', 'Ya', ''], ['Pak Muh', 'Pengumpul', '', 'Ya', ''], ['Mas Romadi', 'Pengumpul', '', 'Ya', ''],
    ['Eko & Pak Gatot', 'Tim suling', 'Ketel 1', 'Ya', 'Satu regu; upah dihitung untuk berdua.']]);
  s['Alat Suling'] = buatSheet('Alat Suling', [['Nama alat', 'Aktif', 'Catatan'], ['Ketel 1', 'Ya', 'Alat suling yang sekarang']]);
  const tarif = [['Pilihan', 'Untuk', 'Upah (Rp)', 'Jenis kerja', 'Jumlah sulingan', 'Upah pengumpulan', 'Upah penyulingan', 'Upah kerja harian', opsi.tanpaAktif ? '' : 'Aktif', 'Catatan'],
    ['Libur', 'Semua', 0, 'Libur', 0, 0, 0, 0, '', 'Sumber tarif: Laporan_2026.xlsx.'],
    ['1 trip', 'Pengumpul', 76000, 'Pengumpulan', 0, 76000, 0, 0, '', 'Upah tim suling dihitung untuk berdua.'],
    ['2 trip', 'Pengumpul', 126000, 'Pengumpulan', 0, 126000, 0, 0, '', 'Menambah pilihan: isi baris baru.'],
    ['Harian kenek', 'Pengumpul', 100000, 'Kerja harian', 0, 0, 0, 100000, '', 'Jangan menulis apa pun di kolom A di bawah tabel.'],
    ['1x suling', 'Tim suling', 90000, 'Penyulingan', 1, 0, 90000, 0],
    ['2x suling', 'Tim suling', 180000, 'Penyulingan', 2, 0, 180000, 0],
    ['3x suling', 'Tim suling', 295000, 'Penyulingan', 3, 0, 295000, 0],
    ['Harian 2 orang', 'Tim suling', 200000, 'Kerja harian', 0, 0, 0, 200000],
    ['Kerja lain', 'Semua', 0, 'Kerja lain', 0, 0, 0, 0]];
  if (!opsi.tanpaNyuling) tarif.push(['Nyuling (upah dari produksi)', 'Tim suling', 0, 'Penyulingan', 0, 0, 0, 0]);
  s['Tarif Upah'] = buatSheet('Tarif Upah', tarif);
  for (let r = 2; r <= tarif.length; r++) {
    s['Tarif Upah'].rumus[r + ',6'] = '=IF(R[0]C4="Pengumpulan",R[0]C3,0)';
    s['Tarif Upah'].rumus[r + ',7'] = '=IF(R[0]C4="Penyulingan",R[0]C3,0)';
    s['Tarif Upah'].rumus[r + ',8'] = '=IF(R[0]C4="Kerja harian",R[0]C3,0)';
  }
  s['Daftar'] = buatSheet('Daftar', [
    ['Pengumpul', '', 'Tim suling', '', 'Daerah', '', 'Kondisi bahan', '', 'Kondisi alat', '', 'Pembeli', '', 'Produk', 'Satuan', 'Dihitung sebagai minyak',
      opsi.tanpaHarga ? '' : 'Harga biasa (Rp)', 'Kategori kas', 'Arah', 'Kelompok', '', 'Status bayar', '', 'Kerja lain untuk'],
    ['Rofik', '', 'Eko & Pak Gatot', '', 'Aryojeding', '', 'Segar semua', '', 'Normal', '', 'Lusiani', '', 'Minyak jeruk purut (campur)', 'kg', 'Ya', 600000,
      'Bensin & servis pikap', 'Keluar', 'Operasional usaha', '', 'Lunas', '', 'Perawatan alat suling'],
    ['Pak Muh', '', '', '', 'Banjarejo', '', 'Cuma sedikit yang kering', '', 'Ketel bocor', '', 'Bapak', '', 'Minyak batang jeruk purut', 'kg', 'Ya', '',
      'Proyek bangunan', 'Keluar', 'Proyek lain', '', 'Belum dibayar', '', 'Penyulingan'],
    ['Mas Romadi', '', '', '', 'Plosokerep', '', 'Agak kering semua', '', 'Spiral bocor', '', '', '', 'Hidrosol', 'liter', 'Tidak', '',
      'Keluarga & pribadi', 'Keluar', 'Keluarga & pribadi', '', '', '', 'Pengumpulan bahan'],
    ['', '', '', '', 'Tanen', '', '', '', '', '', '', '', '', '', '', '', 'Pinjaman masuk', 'Masuk', 'Pembiayaan', '', '', '', 'Proyek bangunan & lainnya']
  ]);
  s['Daftar'].rumus['2,1'] = '=IFERROR(FILTER(Karyawan!$A$2:$A,Karyawan!$B$2:$B="Pengumpul"),"")';
  s['Pengaturan Aplikasi'] = buatSheet('Pengaturan Aplikasi', [['Kunci', 'Nilai', 'Keterangan'],
    ['namaUsaha', 'Sembada Karya Wangi', ''], ['namaAplikasi', 'Catatan Sembada', ''], ['absensiLamaSampai', 'ms 1792539290290', '']]);
  // Rekap: baris 5 dan seterusnya = minggu/bulan. Hanya kolom yang dibaca API yang diisi.
  const senin = (iso) => { const d = new Date(iso + 'T00:00:00Z'); const h = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - h * 864e5).toISOString().slice(0, 10); };
  const s0 = senin(h0), sLalu = new Date(new Date(s0 + 'T00:00:00Z').getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const sDepan = new Date(new Date(s0 + 'T00:00:00Z').getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const plus6 = iso => new Date(new Date(iso + 'T00:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10);
  const barisMinggu = (m, isi) => [tgl(m), tgl(plus6(m))].concat(isi);
  const kosong20 = Array(20).fill(0);
  s['Rekap Mingguan'] = buatSheet('Rekap Mingguan', [['Rekap mingguan'], [''], [''], ['Minggu mulai', 'Sampai'],
    barisMinggu(sLalu, [5, 5400, 1605000, 297, 125000, 6, 3, 4, 6.46, 1.62, 0.0012, 1140000, 540000, 30000, 3440000, 532508, 0, 0, -3440000, 0]),
    barisMinggu(s0, [1, 1323, 500000, 378, 20000, 2, 3, 0, 0, '', 0, 228000, 180000, 25000, 773000, '', 15.94, 9564000, 8791000, 730000]),
    barisMinggu(sDepan, kosong20)]);
  const bulanIni = h0.slice(0, 8) + '01';
  s['Rekap Bulanan'] = buatSheet('Rekap Bulanan', [['Rekap bulanan'], [''], [''], ['Bulan', 'Akhir bulan'],
    [tgl(bulanIni), tgl(bulanIni)].concat([12, 13000, 4000000, 300, 300000, 20, 6, 20, 30, 1.5, 0.002, 2000000, 1800000, 100000, 8000000, 266000,
      15.94, 9564000, 1564000, 0, 3632000, -2068000, 428000, 200000, 2860000, 0, 0, 9564000, -14000000])]);
  s['Dashboard'] = buatSheet('Dashboard', Array.from({ length: 23 }, () => []));
  s['Dashboard'].data[1] = ['Data sampai', tgl(h1)];
  s['Dashboard'].data[14] = ['Harga bahan per kg vs rata-rata', '', 'Rp378', '15%', 'PERHATIAN', 'Bandingkan harga antar daerah.'];
  s['Dashboard'].data[15] = ['Rendemen', '', '0,26%', '20%', 'Aman', ''];
  return s;
}

module.exports = { buatData, isoHari };
