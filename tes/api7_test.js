// Uji logika api.gs versi 7 dengan Google Sheet tiruan. Jalankan: node tes/api7_test.js
const assert = require('assert');
const fs = require('fs');
const { muat, tgl, isDate, formatTanggal } = require('./tiruan7');
const { buatData, isoHari } = require('./data_sembada');
const J = o => JSON.parse(JSON.stringify(o));
let langkah = 0;
const cek = nama => { langkah++; console.log('  ✓ ' + nama); };

// ------------------------------------------------------------------ 0. Tidak ada nama ganda dengan file Apps Script lain
const nama = {};
['Kode.gs', 'urut_otomatis.gs', 'ubah_kondisi_bahan.gs', 'api.gs'].forEach(f => {
  const isi = fs.readFileSync(__dirname + '/../apps-script/' + f, 'utf8');
  const re = /^(?:function\s+([A-Za-z0-9_$]+)|var\s+([A-Za-z0-9_$]+))/gm;
  let m;
  while ((m = re.exec(isi))) {
    const n = m[1] || m[2];
    assert.ok(!nama[n] || nama[n] === f, 'Nama ganda "' + n + '" di ' + f + ' dan ' + nama[n]);
    nama[n] = f;
  }
});
cek('tidak ada fungsi/variabel ganda dengan Kode.gs, urut_otomatis.gs, ubah_kondisi_bahan.gs');

const sheets = buatData();
const { ctx, ss, panggil, props, cache } = muat(sheets);
// urutkanTab_ tiruan: urutkan kolom isian (B..) berdasarkan Tanggal lalu Timestamp, terbaru di atas.
ctx.urutkanTab_ = sh => {
  const info = ctx.kolomForm_(sh);
  const akhir = sh.getLastRow();
  if (akhir >= 3) sh.getRange(2, 2, akhir - 1, info.kepala.length).sort([{ column: 3, ascending: false }, { column: 2, ascending: false }]);
};
const hariIni = isoHari(0), kemarin = isoHari(-1), lusa = isoHari(-2), besok = isoHari(1);
const objek = n => { const sh = sheets[n]; const k = sh.data[0]; return sh.data.slice(1).filter(r => r.some(v => v !== '' && v !== undefined)).map(r => Object.fromEntries(k.map((h, j) => [h, r[j] === undefined ? '' : r[j]]))); };

// ------------------------------------------------------------------ 1. Masuk
let r = panggil({ aksi: 'masuk', pin: '250610' });
assert.strictEqual(r.kode, 'PERBARUI', 'aplikasi lama (PIN) diminta memperbarui');
assert.ok(!sheets['Akun Aplikasi'], 'akun belum dibuat sebelum ada yang masuk');
r = panggil({ aksi: 'masuk', pengguna: 'Wildan', sandi: '250610' });
assert.strictEqual(r.ok, true, JSON.stringify(r));
let tokPemilik = r.token;
assert.strictEqual(r.akses.pemilik, true); assert.strictEqual(r.akses.admin, true); assert.strictEqual(r.akses.nama, 'Mas Wildan');
assert.strictEqual(r.akses.tab.length, 6); assert.strictEqual(r.versiApi, 7);
const akun = objek('Akun Aplikasi');
assert.deepStrictEqual(akun.map(a => a['Nama pengguna']), ['wildan', 'rofik', 'pakmuh', 'romadi', 'eko', 'pakgatot'], 'PIN bersama tidak dibuatkan akun');
assert.deepStrictEqual(akun.map(a => a['Boleh mengisi']), ['Semua', 'Ambil Bahan', 'Ambil Bahan', 'Ambil Bahan', 'Produksi Suling', 'Produksi Suling']);
assert.ok(akun.every(a => a['Sandi (terenkripsi)'] && a['Garam'] && !/^\d+$/.test(a['Sandi (terenkripsi)'])), 'sandi terenkripsi');
assert.ok(!JSON.stringify(sheets['Akun Aplikasi'].data).includes('5420'), 'PIN tidak tersimpan terbuka');
assert.deepStrictEqual(J(sheets['Pengguna'].data[2]), ['Rofik', '5420', 'Pekerja', 'Ambil Bahan', 'Rofik', 'Ya', ''], 'tab Pengguna lama tidak diubah');
cek('akun dibuat dari PIN lama: wildan, rofik, pakmuh, romadi, eko, pakgatot');

r = panggil({ aksi: 'masuk', pengguna: 'rofik', sandi: '5420' });
assert.ok(r.ok); const tokRofik = r.token;
assert.deepStrictEqual(J(r.akses.tab), ['Ambil Bahan']); assert.strictEqual(r.akses.admin, false);
r = panggil({ aksi: 'masuk', pengguna: 'eko', sandi: '9937' });
assert.ok(r.ok); const tokEko = r.token;
assert.deepStrictEqual(J(r.akses.tab), ['Produksi Suling']);
for (let i = 0; i < 5; i++) assert.strictEqual(panggil({ aksi: 'masuk', pengguna: 'romadi', sandi: '0000' }).kode, 'SALAH');
assert.strictEqual(panggil({ aksi: 'masuk', pengguna: 'romadi', sandi: '1508' }).kode, 'KUNCI', 'dikunci setelah 5 kali salah');
assert.strictEqual(panggil({ aksi: 'config', token: 'palsu' }).kode, 'SESI');
cek('masuk dengan nama pengguna + sandi, salah 5x dikunci, token palsu ditolak');

// ------------------------------------------------------------------ 2. Config
r = panggil({ aksi: 'config', token: tokPemilik });
assert.ok(r.ok, JSON.stringify(r));
assert.deepStrictEqual(r.master['Alat Suling'].map(m => m.nilai['Nama alat']), ['Ketel 1']);
assert.deepStrictEqual(r.master['Karyawan'].map(m => m.nilai['Nama']), ['Rofik', 'Pak Muh', 'Mas Romadi', 'Eko & Pak Gatot']);
assert.strictEqual(r.master['Karyawan'][3].nilai['Alat'], 'Ketel 1');
assert.strictEqual(r.master['Tarif Upah'].length, 10);
assert.strictEqual(r.master['Tarif Upah'][5].nilai['Jumlah sulingan'], 2);
assert.deepStrictEqual(r.master['Pilihan'].filter(m => m.nilai['Daftar'] === 'Daerah').map(m => m.nilai['Pilihan']), ['Aryojeding', 'Banjarejo', 'Plosokerep', 'Tanen']);
assert.deepStrictEqual(r.master['Pilihan'].filter(m => m.nilai['Daftar'] === 'Kerja lain untuk').length, 4);
assert.deepStrictEqual(r.master['Produk'].map(m => [m.nilai['Produk'], m.nilai['Satuan'], m.nilai['Harga biasa (Rp)']]),
  [['Minyak jeruk purut (campur)', 'kg', 600000], ['Minyak batang jeruk purut', 'kg', ''], ['Hidrosol', 'liter', '']]);
assert.deepStrictEqual(r.master['Kategori Kas'].map(m => m.nilai['Kategori']), ['Bensin & servis pikap', 'Proyek bangunan', 'Keluarga & pribadi', 'Pinjaman masuk']);
assert.deepStrictEqual(J(r.skema['Karyawan'].kolom[1].opsi), ['Pengumpul', 'Tim suling']);
assert.ok(r.skema['Pilihan'].hapus && !r.skema['Karyawan'].hapus && r.skema['Karyawan'].keluar);
assert.strictEqual(r.pengaturan.namaAplikasi, 'Catatan Sembada');
r = panggil({ aksi: 'config', token: tokRofik });
assert.strictEqual(r.skema, null, 'skema hanya untuk yang boleh mengatur');
cek('config: data induk dibaca dari tab Karyawan, Alat Suling, Tarif Upah, Daftar');

// ------------------------------------------------------------------ 3. Simpan Ambil Bahan (umum)
const ambilAwal = sheets['Ambil Bahan'].data.length;
const isiAmbil = { 'Tanggal': hariIni, 'Pengumpul': ['Rofik', 'Pak Muh'], 'Daerah': ['Tanen', 'Gilang'], 'Kondisi bahan': 'Segar semua',
  'Berat bahan (kg)': 1075, 'Uang dibawa (Rp)': 550000, 'Uang sisa (Rp)': 40000, 'Biaya lain di jalan (Rp)': 10000, 'Keterangan': ' hujan ' };
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Ambil Bahan', id: 'a1', nilai: isiAmbil });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(sheets['Ambil Bahan'].data.length, ambilAwal + 1);
let ab = objek('Ambil Bahan')[0];
assert.strictEqual(ab['Pengumpul'], 'Rofik, Pak Muh'); assert.strictEqual(ab['Keterangan'], 'hujan'); assert.ok(isDate(ab['Tanggal']));
assert.strictEqual(ab['Uang beli bahan (Rp)'], '', 'kolom rumus tidak ditulis');
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Ambil Bahan', id: 'a1', nilai: isiAmbil });
assert.strictEqual(r.dobel, true); assert.strictEqual(sheets['Ambil Bahan'].data.length, ambilAwal + 1, 'kirim ulang tidak dobel');
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Ambil Bahan', id: 'a2', nilai: Object.assign({}, isiAmbil, { 'Tanggal': besok }) });
assert.ok(/setelah hari ini/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Ambil Bahan', id: 'a3', nilai: { 'Tanggal': hariIni, 'Kolom aneh': 1 } });
assert.ok(/Kolom aneh/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Kas', id: 'a4', nilai: { 'Tanggal': hariIni } });
assert.ok(/tidak boleh mengisi Kas/.test(r.galat));
assert.ok(sheets['Log Aplikasi'].data.some(x => x[1] === 'Tambah' && x[2] === 'Ambil Bahan' && x[6] === 'Rofik'), 'dicatat di Log siapa yang mengisi');
cek('simpan Ambil Bahan: tidak dobel, tanggal besok ditolak, kolom asing ditolak, hak akses dicek');

// ------------------------------------------------------------------ 4. Produksi Suling
assert.ok(!sheets['Produksi Suling']);
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p1', nilai: { 'Tanggal': hariIni, 'Keterangan': 'lancar' },
  baris: [{ 'Alat suling': 'Ketel 1', 'Jumlah sulingan': 2, 'Operator': 'Eko & Pak Gatot', 'Kondisi alat': 'Normal' }] });
assert.strictEqual(r.ok, true, JSON.stringify(r));
let ps = objek('Produksi Suling');
assert.deepStrictEqual(sheets['Produksi Suling'].data[0], ['(rumus)', 'Timestamp', 'Tanggal', 'Alat suling', 'Operator', 'Jumlah sulingan', 'Kondisi alat',
  'Keterangan', 'Upah (Rp)', 'Diisi oleh', 'ID', 'ID isian']);
assert.strictEqual(ps.length, 1); assert.strictEqual(ps[0]['Upah (Rp)'], 180000); assert.strictEqual(ps[0]['Diisi oleh'], 'Eko');
assert.strictEqual(ps[0]['ID'], 'p1-1'); assert.strictEqual(ps[0]['ID isian'], 'p1');
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p2', nilai: { 'Tanggal': hariIni },
  baris: [{ 'Alat suling': 'Ketel 1', 'Jumlah sulingan': 3, 'Operator': 'Eko & Pak Gatot' }] });
assert.strictEqual(r.kode, 'SUDAH'); assert.ok(/sudah tercatat 2 sulingan/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p3', nilai: { 'Tanggal': hariIni },
  baris: [{ 'Alat suling': 'Ketel 1', 'Jumlah sulingan': 2, 'Operator': 'Eko & Pak Gatot' }] });
assert.strictEqual(r.dobel, true, 'isian sama persis dilewati');
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p4', nilai: { 'Tanggal': kemarin },
  baris: [{ 'Alat suling': 'Ketel 1', 'Jumlah sulingan': 4, 'Operator': 'Eko & Pak Gatot' }] });
assert.ok(r.ok);
ps = objek('Produksi Suling');
assert.strictEqual(ps[1]['Upah (Rp)'], 295000 + 90000, '4x = tarif 3x + 1x');
assert.strictEqual(formatTanggal(ps[0]['Tanggal'], 'yyyy-MM-dd'), hariIni, 'urut: tanggal terbaru di atas');
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p5', nilai: { 'Tanggal': lusa },
  baris: [{ 'Alat suling': 'Ketel 1', 'Jumlah sulingan': 1 }] });
assert.ok(/operator/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p6', nilai: { 'Tanggal': lusa },
  baris: [{ 'Alat suling': 'Ketel 9', 'Jumlah sulingan': 0 }] });
assert.ok(/tidak dikenal/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p7', nilai: { 'Tanggal': isoHari(-3) },
  baris: [{ 'Alat suling': 'Ketel 1', 'Jumlah sulingan': 0, 'Kondisi alat': 'Ketel bocor' }] });
assert.ok(r.ok, 'alat tidak jalan (0) boleh tanpa operator');
assert.strictEqual(objek('Produksi Suling')[2]['Upah (Rp)'], 0);
cek('Produksi Suling: tab dibuat, upah dari tarif 1x/2x/3x, bentrok & dobel dicek, urut tanggal');

// ------------------------------------------------------------------ 5. Absensi (satu orang untuk semua)
const ahAwal = objek('Absensi Harian').length;
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Absensi', id: 'b0', nilai: { 'Tanggal': hariIni }, baris: [{ 'Nama': 'Rofik', 'Pekerjaan': '1 trip' }] });
assert.ok(/tidak boleh mengisi Absensi/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Absensi', id: 'b1', nilai: { 'Tanggal': hariIni, 'Keterangan': 'hujan sore' }, baris: [
  { 'Nama': 'Rofik', 'Pekerjaan': '1 trip' },
  { 'Nama': 'Pak Muh', 'Pekerjaan': 'Harian kenek', 'Pekerjaan lain': 'tambal kolam', 'Upah kerja lain (Rp)': 50000, 'Kerja lain untuk': 'Proyek bangunan & lainnya' },
  { 'Nama': 'Mas Romadi', 'Pekerjaan lain': 'angkut kayu', 'Upah kerja lain (Rp)': 70000, 'Kerja lain untuk': 'Perawatan alat suling' },
  { 'Nama': 'Eko & Pak Gatot', 'Pekerjaan': 'Nyuling (upah dari produksi)' }] });
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.ditambah, 5);
let ah = objek('Absensi Harian').filter(x => formatTanggal(x['Tanggal'], 'yyyy-MM-dd') === hariIni);
const baris = n => ah.filter(x => x['Nama'] === n);
assert.strictEqual(baris('Rofik')[0]['Upah (Rp)'], 76000); assert.strictEqual(baris('Rofik')[0]['Pos upah'], 'Pengumpulan');
assert.strictEqual(baris('Pak Muh').length, 2);
const lainMuh = baris('Pak Muh').find(x => x['Pekerjaan'] === 'Kerja lain');
assert.strictEqual(lainMuh['Upah (Rp)'], 50000); assert.strictEqual(lainMuh['Pekerjaan lain'], 'tambal kolam'); assert.strictEqual(lainMuh['Pos upah'], 'Harian & lain');
assert.strictEqual(baris('Mas Romadi')[0]['Pos upah'], 'Perawatan alat');
const ekoAbs = baris('Eko & Pak Gatot')[0];
assert.strictEqual(ekoAbs['Upah (Rp)'], 0); assert.strictEqual(ekoAbs['Jumlah sulingan'], 0); assert.strictEqual(ekoAbs['Alat'], 'Ketel 1');
assert.ok(ah.every(x => x['Diisi oleh'] === 'Mas Wildan' && x['Keterangan'] === 'hujan sore' && x['Tim']));
r = panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Absensi', id: 'b2', nilai: { 'Tanggal': hariIni }, baris: [{ 'Nama': 'Rofik', 'Pekerjaan': '2 trip' }] });
assert.strictEqual(r.kode, 'SUDAH'); assert.ok(/Rofik sudah tercatat "1 trip"/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Absensi', id: 'b3', nilai: { 'Tanggal': hariIni }, baris: [{ 'Nama': 'Rofik', 'Pekerjaan': '3x suling' }] });
assert.ok(/bukan pilihan untuk Pengumpul/.test(r.galat));
// Antrian lama dari aplikasi versi 2 (sebelum diperbarui) tetap diterima.
r = panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Absensi', id: 'b4', nilai: { 'Tanggal': kemarin, 'Keterangan': '',
  baris: [{ nama: 'Rofik', pekerjaan: '2 trip', alat: '', upah: 0 }] } });
assert.ok(r.ok, JSON.stringify(r));
assert.strictEqual(objek('Absensi Harian').length, ahAwal + 6);
cek('Absensi: satu isian untuk semua orang, kerja lain jadi baris sendiri, bentrok dicek, antrian versi lama diterima');

// ------------------------------------------------------------------ 6. Riwayat, ubah, hapus
r = panggil({ aksi: 'terbaru', token: tokPemilik, tab: 'Absensi', n: 60 });
assert.ok(r.ok); assert.strictEqual(r.total, ahAwal + 6);
assert.ok(r.data[0].nilai['Tanggal'] === hariIni && /^r\d+\|/.test(r.data[0].id));
assert.ok(r.kepala.includes('Pekerjaan') && r.kepala.includes('Diisi oleh'));
let dRofik = r.data.find(d => d.nilai['Nama'] === 'Rofik' && d.nilai['Tanggal'] === hariIni);
// Catatan baru masuk dulu (nomor baris bergeser), lalu ubah tetap kena baris yang benar.
panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Absensi', id: 'b5', nilai: { 'Tanggal': isoHari(-5) }, baris: [{ 'Nama': 'Rofik', 'Pekerjaan': 'Libur' }] });
r = panggil({ aksi: 'ubah', token: tokPemilik, tab: 'Absensi', id: dRofik.id, nilai: { 'Tanggal': hariIni, 'Nama': 'Rofik', 'Pekerjaan': '2 trip',
  'Pekerjaan lain': '', 'Kerja lain untuk': '', 'Upah (Rp)': '', 'Keterangan': 'hujan sore' } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
ah = objek('Absensi Harian').filter(x => formatTanggal(x['Tanggal'], 'yyyy-MM-dd') === hariIni && x['Nama'] === 'Rofik');
assert.strictEqual(ah.length, 1); assert.strictEqual(ah[0]['Upah (Rp)'], 126000); assert.ok(/diubah Mas Wildan/.test(ah[0]['Diisi oleh']));
r = panggil({ aksi: 'ubah', token: tokPemilik, tab: 'Absensi', id: dRofik.id, nilai: { 'Tanggal': hariIni, 'Nama': 'Rofik', 'Pekerjaan': '1 trip' } });
assert.strictEqual(r.kode, 'BERUBAH', 'tanda lama tidak cocok lagi');
r = panggil({ aksi: 'ubah', token: tokRofik, tab: 'Ambil Bahan', id: 'x', nilai: {} });
assert.ok(/Hanya pemilik/.test(r.galat));
r = panggil({ aksi: 'terbaru', token: tokPemilik, tab: 'Produksi Suling' });
assert.strictEqual(r.total, 3); assert.strictEqual(r.data[0].id, 'p1-1');
r = panggil({ aksi: 'ubah', token: tokPemilik, tab: 'Produksi Suling', id: 'p1-1', nilai: { 'Tanggal': hariIni, 'Alat suling': 'Ketel 1',
  'Operator': 'Eko & Pak Gatot', 'Jumlah sulingan': 3, 'Kondisi alat': 'Spiral bocor', 'Keterangan': 'lancar' } });
assert.ok(r.ok, JSON.stringify(r));
ps = objek('Produksi Suling').find(x => x['ID'] === 'p1-1');
assert.strictEqual(ps['Upah (Rp)'], 295000); assert.strictEqual(ps['Kondisi alat'], 'Spiral bocor'); assert.ok(/diubah/.test(ps['Diisi oleh']));
r = panggil({ aksi: 'ubah', token: tokPemilik, tab: 'Produksi Suling', id: 'p1-1', nilai: { 'Tanggal': kemarin } });
assert.ok(/sudah punya catatan lain/.test(r.galat));
r = panggil({ aksi: 'hapus', token: tokPemilik, tab: 'Produksi Suling', id: 'p7-1' });
assert.ok(r.ok); assert.strictEqual(objek('Produksi Suling').length, 2);
r = panggil({ aksi: 'terbaru', token: tokPemilik, tab: 'Kas' });
const dKas = r.data[0];
assert.strictEqual(dKas.nilai['Kategori'], 'Proyek bangunan'); assert.strictEqual(dKas.nilai['Arah'], 'Keluar');
r = panggil({ aksi: 'ubah', token: tokPemilik, tab: 'Kas', id: dKas.id, nilai: { 'Tanggal': kemarin, 'Kategori': 'Proyek bangunan', 'Jumlah (Rp)': 250000, 'Keterangan': 'service disel' } });
assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(objek('Kas')[0]['Jumlah (Rp)'], 250000);
r = panggil({ aksi: 'terbaru', token: tokPemilik, tab: 'Kas' });
r = panggil({ aksi: 'hapus', token: tokPemilik, tab: 'Kas', id: r.data[0].id });
assert.ok(r.ok); assert.strictEqual(objek('Kas').length, 0);
r = panggil({ aksi: 'terbaru', token: tokRofik, tab: 'Penjualan' });
assert.ok(/tidak boleh melihat/.test(r.galat));
cek('Riwayat, ubah, hapus: baris dicari lewat tanda isinya, upah dihitung ulang, Produksi lewat ID');

// ------------------------------------------------------------------ 7. Data induk
const simpanInduk = (tab, nilai, id) => panggil({ aksi: 'masterSimpan', token: tokPemilik, tab, id: id || '', nilai });
r = simpanInduk('Karyawan', { 'Nama': 'Pak Budi', 'Tim': 'Pengumpul', 'Alat': '', 'No HP': '0812', 'Catatan': '' });
assert.ok(r.ok, JSON.stringify(r));
assert.deepStrictEqual(J(sheets['Karyawan'].data[5].slice(0, 6)), ['Pak Budi', 'Pengumpul', '', 'Ya', '', '0812']);
assert.ok(/sudah ada/.test(simpanInduk('Karyawan', { 'Nama': 'pak budi', 'Tim': 'Pengumpul' }).galat));
assert.ok(/koma/.test(simpanInduk('Karyawan', { 'Nama': 'A, B', 'Tim': 'Pengumpul' }).galat));
assert.ok(/Alat Ketel 7/.test(simpanInduk('Karyawan', { 'Nama': 'Sri', 'Tim': 'Tim suling', 'Alat': 'Ketel 7' }).galat));
r = simpanInduk('Karyawan', { 'Nama': 'Pak Muhammad', 'Tim': 'Pengumpul', 'Alat': '', 'No HP': '', 'Catatan': '' }, 'Pak Muh');
assert.ok(r.ok); assert.ok(r.catatanDiganti >= 3, 'catatan lama ikut diganti: ' + r.catatanDiganti);
assert.ok(objek('Ambil Bahan').some(x => x['Pengumpul'] === 'Rofik, Pak Muhammad'));
assert.ok(!objek('Absensi Harian').some(x => x['Nama'] === 'Pak Muh'));
r = panggil({ aksi: 'masterAktif', token: tokPemilik, tab: 'Karyawan', id: 'Pak Budi', aktif: false, tanggalKeluar: hariIni });
assert.ok(r.ok); assert.strictEqual(sheets['Karyawan'].data[5][3], 'Tidak'); assert.ok(isDate(sheets['Karyawan'].data[5][6]));
r = panggil({ aksi: 'masterUrut', token: tokPemilik, tab: 'Karyawan', ids: ['Eko & Pak Gatot', 'Rofik', 'Pak Muhammad', 'Mas Romadi'] });
assert.ok(r.ok);
assert.deepStrictEqual(sheets['Karyawan'].data.slice(1).map(x => x[0]), ['Eko & Pak Gatot', 'Rofik', 'Pak Muhammad', 'Mas Romadi', 'Pak Budi']);
assert.strictEqual(sheets['Karyawan'].data[1][2], 'Ketel 1'); assert.strictEqual(sheets['Karyawan'].data[1][4], 'Satu regu; upah dihitung untuk berdua.');
r = panggil({ aksi: 'config', token: tokRofik });
assert.ok(!r.master['Karyawan'].some(m => m.nilai['Nama'] === 'Pak Budi'), 'karyawan keluar tidak muncul untuk pencatat');
cek('Karyawan: tambah, ganti nama (catatan lama ikut), tandai keluar, urutkan');

assert.ok(simpanInduk('Alat Suling', { 'Nama alat': 'Ketel 2', 'Catatan': '' }).ok);
assert.ok(panggil({ aksi: 'masterAktif', token: tokPemilik, tab: 'Alat Suling', id: 'Ketel 1', aktif: false }).ok);
assert.ok(/Minimal/.test(panggil({ aksi: 'masterAktif', token: tokPemilik, tab: 'Alat Suling', id: 'Ketel 2', aktif: false }).galat));
assert.ok(panggil({ aksi: 'masterAktif', token: tokPemilik, tab: 'Alat Suling', id: 'Ketel 1', aktif: true }).ok);
cek('Alat suling: tambah, nonaktif (minimal satu aktif)');

r = simpanInduk('Tarif Upah', { 'Pilihan': '4x suling', 'Untuk': 'Tim suling', 'Upah (Rp)': 380000, 'Jenis kerja': 'Penyulingan', 'Jumlah sulingan': 4 });
assert.ok(r.ok, JSON.stringify(r));
const tUpah = sheets['Tarif Upah'];
assert.deepStrictEqual(J(tUpah.data[11].slice(0, 5)), ['4x suling', 'Tim suling', 380000, 'Penyulingan', 4]);
assert.strictEqual(tUpah.data[11][8], 'Ya'); assert.strictEqual(tUpah.data[11][9], undefined, 'catatan kolom J tidak tersentuh');
assert.ok(tUpah.rumus['12,6'] && tUpah.rumus['12,8'], 'rumus F-H disalin ke baris baru');
assert.ok(/Jenis kerja tidak dikenal/.test(simpanInduk('Tarif Upah', { 'Pilihan': 'X', 'Untuk': 'Semua', 'Jenis kerja': 'Bebas' }).galat));
r = panggil({ aksi: 'simpan', token: tokEko, tab: 'Produksi Suling', id: 'p8', nilai: { 'Tanggal': isoHari(-4) },
  baris: [{ 'Alat suling': 'Ketel 2', 'Jumlah sulingan': 4, 'Operator': 'Eko & Pak Gatot' }] });
assert.strictEqual(objek('Produksi Suling').find(x => x['ID'] === 'p8-1')['Upah (Rp)'], 380000, 'tarif 4x baru langsung dipakai');
r = simpanInduk('Tarif Upah', { 'Pilihan': '2 trip pagi', 'Untuk': 'Pengumpul', 'Upah (Rp)': 126000, 'Jenis kerja': 'Pengumpulan', 'Jumlah sulingan': 0 }, '2 trip');
assert.ok(r.ok); assert.ok(r.catatanDiganti >= 1);
assert.ok(objek('Absensi Harian').some(x => x['Pekerjaan'] === '2 trip pagi'));
assert.ok(panggil({ aksi: 'masterAktif', token: tokPemilik, tab: 'Tarif Upah', id: 'Harian 2 orang', aktif: false }).ok);
assert.strictEqual(tUpah.data[8][8], 'Tidak');
cek('Tarif upah: tambah (rumus ikut), ganti nama (absensi lama ikut), nonaktif');

r = simpanInduk('Pilihan', { 'Daftar': 'Daerah', 'Pilihan': 'Gilang' });
assert.ok(r.ok); assert.strictEqual(sheets['Daftar'].data[5][4], 'Gilang');
assert.ok(/sudah ada/.test(simpanInduk('Pilihan', { 'Daftar': 'Daerah', 'Pilihan': 'tanen' }).galat));
assert.ok(simpanInduk('Pilihan', { 'Daftar': 'Pembeli', 'Pilihan': 'Tanen' }).ok, 'nama sama di daftar lain boleh');
r = panggil({ aksi: 'masterAktif', token: tokPemilik, tab: 'Pilihan', id: 'Daerah|Banjarejo', aktif: false });
assert.ok(r.ok && r.dihapus);
assert.deepStrictEqual(sheets['Daftar'].data.slice(1, 6).map(x => x[4]), ['Aryojeding', 'Plosokerep', 'Tanen', 'Gilang', '']);
assert.strictEqual(sheets['Daftar'].data[1][0], 'Rofik', 'kolom lain tidak tergeser');
r = panggil({ aksi: 'masterUrut', token: tokPemilik, tab: 'Pilihan', ids: ['Daerah|Tanen', 'Daerah|Aryojeding'] });
assert.deepStrictEqual(sheets['Daftar'].data.slice(1, 5).map(x => x[4]), ['Tanen', 'Aryojeding', 'Plosokerep', 'Gilang']);
r = simpanInduk('Pilihan', { 'Daftar': 'Kondisi alat', 'Pilihan': 'Gilang' }, 'Daerah|Gilang');
assert.ok(r.ok); assert.ok(sheets['Daftar'].data.some(x => x[8] === 'Gilang')); assert.ok(!sheets['Daftar'].data.some(x => x[4] === 'Gilang'));
cek('Daftar pilihan: tambah, hapus (kolom lain tidak tergeser), urutkan, pindah daftar');

r = simpanInduk('Produk', { 'Produk': 'Minyak premium', 'Satuan': 'kg', 'Dihitung sebagai minyak': 'Ya', 'Harga biasa (Rp)': 750000 });
assert.ok(r.ok); assert.deepStrictEqual(J(sheets['Daftar'].data[4].slice(12, 16)), ['Minyak premium', 'kg', 'Ya', 750000]);
r = panggil({ aksi: 'masterAktif', token: tokPemilik, tab: 'Produk', id: 'Hidrosol', aktif: false });
assert.ok(r.ok);
assert.deepStrictEqual(sheets['Daftar'].data.slice(1, 5).map(x => x[12]), ['Minyak jeruk purut (campur)', 'Minyak batang jeruk purut', 'Minyak premium', '']);
assert.strictEqual(sheets['Daftar'].data[3][15], 750000, 'harga ikut pindah bersama produknya');
r = simpanInduk('Kategori Kas', { 'Kategori': 'Bensin pikap', 'Arah': 'Keluar', 'Kelompok': 'Operasional usaha' }, 'Bensin & servis pikap');
assert.ok(r.ok);
const dataBaru = buatData({ tanpaHarga: true, tanpaAktif: true });
const m2 = muat(dataBaru);
const t2 = m2.panggil({ aksi: 'masuk', pengguna: 'wildan', sandi: '250610' }).token;
r = m2.panggil({ aksi: 'masterSimpan', token: t2, tab: 'Produk', id: 'Hidrosol', nilai: { 'Produk': 'Hidrosol', 'Satuan': 'liter', 'Dihitung sebagai minyak': 'Tidak', 'Harga biasa (Rp)': 25000 } });
assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(dataBaru['Daftar'].data[0][15], 'Harga biasa (Rp)', 'kolom harga dibuat tepat di kanan blok produk');
r = m2.panggil({ aksi: 'masterAktif', token: t2, tab: 'Tarif Upah', id: 'Libur', aktif: false });
assert.ok(r.ok); assert.strictEqual(dataBaru['Tarif Upah'].data[0][8], 'Aktif', 'kolom Aktif dibuat di kolom I yang kosong');
cek('Produk & kategori kas: tambah, hapus, kolom baru dibuat di tempat yang benar');

// ------------------------------------------------------------------ 8. Pengguna & sandi
r = panggil({ aksi: 'penggunaDaftar', token: tokRofik });
assert.ok(/Hanya pemilik/.test(r.galat));
r = panggil({ aksi: 'penggunaDaftar', token: tokPemilik });
assert.strictEqual(r.daftar.length, 6); assert.ok(r.daftar[0].saya); assert.strictEqual(r.daftar[0].boleh, 'Semua');
r = panggil({ aksi: 'penggunaSimpan', token: tokPemilik, baru: true, pengguna: 'tata', nama: 'Tata', peran: 'Pencatat', boleh: ['Absensi', 'Kas'],
  mengatur: false, aktif: true, sandiBaru: '1234', wajibGanti: true });
assert.ok(r.ok, JSON.stringify(r));
r = panggil({ aksi: 'masuk', pengguna: 'tata', sandi: '1234' });
assert.ok(r.ok && r.akses.wajibGanti);
const tokTata = r.token;
assert.strictEqual(panggil({ aksi: 'simpan', token: tokTata, tab: 'Kas', nilai: {} }).kode, 'GANTI');
r = panggil({ aksi: 'sandiUbah', token: tokTata, sandiLama: '1234', sandiBaru: '12' });
assert.ok(/minimal 4/.test(r.galat));
r = panggil({ aksi: 'sandiUbah', token: tokTata, sandiLama: '1234', sandiBaru: 'kas2026' });
assert.ok(r.ok); assert.strictEqual(r.akses.wajibGanti, false);
assert.strictEqual(panggil({ aksi: 'config', token: tokTata }).kode, 'SESI', 'token lama tidak berlaku setelah ganti sandi');
assert.ok(panggil({ aksi: 'config', token: r.token }).ok);
r = panggil({ aksi: 'penggunaSimpan', token: tokPemilik, pengguna: 'wildan', nama: 'Mas Wildan', peran: 'Pencatat', boleh: 'Semua', aktif: true });
assert.ok(/minimal satu pemilik/.test(r.galat));
r = panggil({ aksi: 'penggunaSimpan', token: tokPemilik, pengguna: 'rofik', nama: 'Rofik', peran: 'Pencatat', boleh: ['Ambil Bahan'], aktif: false });
assert.ok(r.ok); assert.strictEqual(panggil({ aksi: 'config', token: tokRofik }).kode, 'SESI', 'akun nonaktif langsung keluar');
r = panggil({ aksi: 'penggunaSimpan', token: tokPemilik, pengguna: 'wildan', penggunaBaru: 'eko', nama: 'Mas Wildan', peran: 'Pemilik', boleh: 'Semua', aktif: true });
assert.ok(/sudah dipakai/.test(r.galat));
r = panggil({ aksi: 'penggunaSimpan', token: tokPemilik, pengguna: 'wildan', penggunaBaru: 'Mas Wildan', nama: 'Mas Wildan', peran: 'Pemilik', boleh: 'Semua', aktif: true });
assert.ok(/huruf kecil/.test(r.galat));
r = panggil({ aksi: 'penggunaSimpan', token: tokPemilik, pengguna: 'wildan', penggunaBaru: 'SKW.Wildan', nama: 'Mas Wildan', peran: 'Pemilik', boleh: 'Semua', mengatur: true, aktif: true });
assert.ok(r.ok && r.token && r.pengguna === 'skw.wildan', JSON.stringify(r));
assert.strictEqual(panggil({ aksi: 'config', token: tokPemilik }).kode, 'SESI', 'token dengan nama lama tidak berlaku');
tokPemilik = r.token;
assert.strictEqual(panggil({ aksi: 'config', token: tokPemilik }).akses.pengguna, 'skw.wildan', 'HP pemilik tetap masuk dengan sesi baru');
assert.strictEqual(panggil({ aksi: 'masuk', pengguna: 'wildan', sandi: '250610' }).kode, 'SALAH');
assert.ok(panggil({ aksi: 'masuk', pengguna: 'skw.wildan', sandi: '250610' }).ok, 'sandi tetap sama');
r = panggil({ aksi: 'penggunaSimpan', token: tokPemilik, pengguna: 'pakmuh', penggunaBaru: 'muh', nama: 'Pak Muh', peran: 'Pencatat', boleh: ['Ambil Bahan'], aktif: true });
assert.ok(r.ok && !r.token, 'ganti nama pengguna orang lain tidak memberi token');
assert.ok(panggil({ aksi: 'masuk', pengguna: 'muh', sandi: '9912' }).ok);
cek('Pengguna: daftar, tambah, wajib ganti sandi, sandi minimal 4, nonaktif, ganti nama pengguna');

// ------------------------------------------------------------------ 9. Ringkasan
r = panggil({ aksi: 'ringkasan', token: tokPemilik });
assert.ok(r.ok, JSON.stringify(r));
assert.strictEqual(r.dataSampai, kemarin);
assert.strictEqual(r.minggu.length, 2, 'minggu depan tidak ikut');
const m0 = r.minggu[0];
assert.strictEqual(m0.penjualan, 9564000); assert.strictEqual(m0.sulingan, 2); assert.strictEqual(m0.minyakPerSulingan, null);
assert.strictEqual(m0.totalUpah, 228000 + 180000 + 730000);
assert.ok(m0.orang.length >= 4);
assert.ok(m0.alat.some(a => a.nama === 'Ketel 1'));
assert.ok(r.bulan.length === 1 && r.bulan[0].laba === 1564000 && r.bulan[0].cicilan === 3632000);
assert.deepStrictEqual(r.peringatan.map(p => p.status), ['PERHATIAN', 'Aman']);
cek('Ringkasan: angka dari Rekap, upah per orang & per alat dari catatan, peringatan dari Dashboard');

// ------------------------------------------------------------------ 10. Tampilan & logo
r = panggil({ aksi: 'tampilanSimpan', token: tokPemilik, tampilan: { warna: 'biru', beranda: 1 }, namaAplikasi: 'Catatan SKW', logo: 'data:image/png;base64,iVBORw0KGgo=' });
assert.ok(r.ok, JSON.stringify(r)); assert.ok(r.logoTanda);
r = panggil({ aksi: 'config', token: tokPemilik });
assert.strictEqual(r.tampilan.warna, 'biru'); assert.strictEqual(r.pengaturan.namaAplikasi, 'Catatan SKW'); assert.ok(r.logoTanda);
assert.strictEqual(panggil({ aksi: 'logo', token: tokPemilik }).logo, 'data:image/png;base64,iVBORw0KGgo=');
assert.ok(/tidak valid/.test(panggil({ aksi: 'tampilanSimpan', token: tokPemilik, logo: 'javascript:alert(1)' }).galat));
cek('Tampilan, nama aplikasi, dan logo disimpan untuk semua HP');

// ------------------------------------------------------------------ 11. Semua file Apps Script dimuat bersama
const m3 = muat(buatData(), { semuaBerkas: true });
assert.ok(m3.panggil({ aksi: 'masuk', pengguna: 'wildan', sandi: '250610' }).ok);
cek('api.gs berjalan bersama Kode.gs, urut_otomatis.gs, ubah_kondisi_bahan.gs');

console.log('\nSemua uji API versi 7 lulus (' + langkah + ' kelompok).');
