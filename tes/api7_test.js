// Uji logika api.gs versi 7 dengan Google Sheet tiruan. Jalankan: node tes/api7_test.js
const assert = require('assert');
const fs = require('fs');
const { muat, tgl, isDate, formatTanggal, buatSheet } = require('./tiruan7');
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
const waktuMs = v => isDate(v) ? v.getTime() : 0;
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
assert.deepStrictEqual(r.master['Kategori Kas'].map(m => m.nilai['Kategori']), ['Bensin & servis pikap', 'Proyek bangunan', 'Keluarga & pribadi', 'Pinjaman masuk', 'Bayar hutang', 'Bon pekerja (dipinjamkan)', 'Pelunasan bon pekerja']);
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
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Ambil Bahan', id: 'a2', nilai: Object.assign({}, isiAmbil, { 'Tanggal': isoHari(31) }) });
assert.ok(/paling jauh 30 hari/.test(r.galat), 'lebih dari 30 hari ke depan ditolak: ' + r.galat);
// Tanggal besok boleh (isi untuk hari berikutnya). Baris uji dibuang lagi supaya data uji berikutnya tetap sama.
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Ambil Bahan', id: 'a2b', nilai: Object.assign({}, isiAmbil, { 'Tanggal': besok }) });
assert.ok(r.ok, 'tanggal besok boleh: ' + JSON.stringify(r));
{ const shA = sheets['Ambil Bahan']; const j = shA.data.findIndex(x => isDate(x[2]) && formatTanggal(x[2], 'yyyy-MM-dd') === besok); assert.ok(j > 0); shA.data.splice(j, 1); }
r = panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Absensi', id: 'ab-depan', nilai: { 'Tanggal': isoHari(40) }, baris: [{ 'Nama': 'Rofik', 'Pekerjaan': '1 trip' }] });
assert.ok(/paling jauh 30 hari/.test(r.galat), 'absensi 40 hari lagi ditolak: ' + JSON.stringify(r));
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Ambil Bahan', id: 'a3', nilai: { 'Tanggal': hariIni, 'Kolom aneh': 1 } });
assert.ok(/Kolom aneh/.test(r.galat));
r = panggil({ aksi: 'simpan', token: tokRofik, tab: 'Kas', id: 'a4', nilai: { 'Tanggal': hariIni } });
assert.ok(/tidak boleh mengisi Kas/.test(r.galat));
assert.ok(sheets['Log Aplikasi'].data.some(x => x[1] === 'Tambah' && x[2] === 'Ambil Bahan' && x[6] === 'Rofik'), 'dicatat di Log siapa yang mengisi');
cek('simpan Ambil Bahan: tidak dobel, tanggal besok boleh, lebih dari 30 hari ditolak, kolom asing ditolak, hak akses dicek');

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
r = panggil({ aksi: 'terbaru', token: tokEko, tab: 'Produksi Suling' });
assert.ok(r.ok && r.data.length && r.data.every(d => d.nilai['Upah (Rp)'] === undefined) && !r.kepala.includes('Upah (Rp)'), 'tim suling tidak menerima angka upah');
assert.ok(panggil({ aksi: 'config', token: tokEko }).master['Tarif Upah'].every(m => m.nilai['Upah (Rp)'] === ''), 'tarif tanpa angka untuk tim suling');
assert.ok(panggil({ aksi: 'config', token: tokPemilik }).master['Tarif Upah'].some(m => m.nilai['Upah (Rp)'] > 0), 'pemilik tetap melihat tarif');
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
// Biaya operasional (Kas, kelompok Operasional usaha) dan upah perawatan alat (Absensi Harian) untuk rincian angka.
sheets['Kas'].data.push(['', new Date(), tgl(hariIni), 'Bensin & servis pikap', 150000, 'ganti oli', 'Operasional usaha', 'Keluar']);
sheets['Kas'].data.push(['', new Date(), tgl(hariIni), 'Keluarga & pribadi', 54000, 'jajan', 'Keluarga & pribadi', 'Keluar']);
sheets['Absensi Harian'].data.push(['', new Date(), tgl(hariIni), 'Pak Muh', 'Pengumpul', 'Kerja lain', '', 0, 60000, 'Perawatan alat', 'las tungku', 'Perawatan alat suling', '', 'Mas Wildan']);
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
assert.deepStrictEqual(r.peringatan.map(p => p.status), ['PERHATIAN', 'Aman', 'Aman', 'PERHATIAN', 'PERHATIAN', 'Aman', 'Aman', 'BACA', 'Aman']);
const ket = m0.keterangan.map(k => k.bagian + ': ' + k.isi);
assert.ok(ket.includes('Absensi: hujan sore'), ket.join(' / '));
assert.ok(ket.some(k => /^Kerja lain: Pak Muhammad: tambal kolam \(untuk proyek bangunan & lainnya\), upah Rp50\.000$/.test(k)), ket.join(' / '));
assert.ok(ket.includes('Produksi suling: lancar') && ket.some(k => /Kondisi alat: Ketel 1: Spiral bocor/.test(k)), ket.join(' / '));
assert.strictEqual(ket.filter(k => k === 'Absensi: hujan sore').length, 1, 'keterangan yang sama dalam sehari cukup sekali');
cek('Ringkasan: angka dari Rekap, upah per orang & per alat dari catatan, peringatan dari Dashboard');

// Rincian angka: catatan asli tiap minggu, disaring persis seperti rumus Rekap Mingguan.
const isoT = v => formatTanggal(v, 'yyyy-MM-dd');
r.minggu.forEach(m => {
  const di = v => { const t = isoT(v); return t >= m.mulai && t <= m.sampai; };
  const ab = objek('Ambil Bahan').filter(x => di(x['Tanggal']));
  assert.strictEqual(m.rinci.bahan.length, ab.length, 'trip minggu ' + m.mulai);
  assert.strictEqual(m.rinci.bahan.reduce((t, x) => t + x.kg, 0), ab.reduce((t, x) => t + x['Berat bahan (kg)'], 0));
  const sm = objek('Saring Minyak').filter(x => di(x['Tanggal saring']));
  assert.strictEqual(Math.round(m.rinci.saring.reduce((t, x) => t + x.kg, 0) * 100), Math.round(sm.reduce((t, x) => t + x['Minyak (kg)'], 0) * 100));
  const pj = objek('Penjualan').filter(x => di(x['Tanggal']));
  assert.strictEqual(m.rinci.jual.reduce((t, x) => t + x.total, 0), pj.reduce((t, x) => t + x['Total (Rp)'], 0));
  assert.strictEqual(m.rinci.jual.filter(j => j.status && j.status !== 'Lunas').reduce((t, j) => t + j.total, 0), m.belumLunas, 'belum lunas = daftar');
  const urut = ['bahan', 'saring', 'jual', 'ops'].every(k => m.rinci[k].every((x, i, a) => !i || a[i - 1].tgl <= x.tgl));
  assert.ok(urut, 'daftar urut dari Senin ke Minggu');
  assert.strictEqual(m.hari.length, 7); assert.strictEqual(m.hari[0].tgl, m.mulai); assert.strictEqual(m.hari[6].tgl, m.sampai);
  // Hari per hari: sulingan = Absensi Harian + Produksi Suling; "kosong" = ada catatan tapi 0 sulingan (sama dengan rumus Hari ketel kosong).
  m.hari.forEach(h => {
    const a = objek('Absensi Harian').filter(x => isoT(x['Tanggal']) === h.tgl), p = objek('Produksi Suling').filter(x => isoT(x['Tanggal']) === h.tgl);
    assert.strictEqual(h.catat, a.length + p.length > 0, 'ada catatan ' + h.tgl);
    assert.strictEqual(h.sulingan, a.reduce((t, x) => t + (Number(x['Jumlah sulingan']) || 0), 0) + p.reduce((t, x) => t + (Number(x['Jumlah sulingan']) || 0), 0), 'sulingan ' + h.tgl);
  });
});
const opsHariIni = r.minggu[0].rinci.ops.filter(o => o.tgl === hariIni);
const perawatan = objek('Absensi Harian').filter(x => isoT(x['Tanggal']) === hariIni && x['Pos upah'] === 'Perawatan alat');
assert.strictEqual(opsHariIni.filter(o => o.apa === 'Upah perawatan alat').length, perawatan.length, 'semua upah perawatan alat hari ini');
assert.ok(opsHariIni.some(o => o.apa === 'Bensin & servis pikap' && o.rp === 150000 && o.ket === 'ganti oli'), JSON.stringify(opsHariIni));
assert.ok(opsHariIni.some(o => o.apa === 'Upah perawatan alat' && o.rp === 60000 && o.ket === 'Pak Muh: las tungku'), JSON.stringify(opsHariIni));
assert.ok(!r.minggu[0].rinci.ops.some(o => o.apa === 'Proyek bangunan'), 'kas proyek lain tidak masuk operasional');
// Bulan: rincian catatan per bulan (termasuk Kas per kelompok) dan hari per hari.
const b0 = r.bulan[0];
assert.ok(b0.rinci && b0.rinci.kas && b0.hari, 'bulan terbaru punya rincian');
const diBulan = v => isoT(v).slice(0, 7) === b0.bulan;
assert.strictEqual(b0.rinci.bahan.length, objek('Ambil Bahan').filter(x => diBulan(x['Tanggal'])).length);
assert.strictEqual(b0.rinci.jual.reduce((t, x) => t + x.total, 0), objek('Penjualan').filter(x => diBulan(x['Tanggal'])).reduce((t, x) => t + x['Total (Rp)'], 0));
const kelBulan = ['Pengembangan usaha', 'Cicilan kendaraan', 'Keluarga & pribadi', 'Proyek lain', 'Pembiayaan', 'Pemasukan lain'];
assert.strictEqual(b0.rinci.kas.reduce((t, x) => t + x.rp, 0), objek('Kas').filter(x => diBulan(x['Tanggal']) && kelBulan.includes(x['Kelompok'])).reduce((t, x) => t + x['Jumlah (Rp)'], 0));
assert.ok(b0.rinci.kas.some(x => x.kel === 'Keluarga & pribadi' && x.rp === 54000 && x.arah === 'Keluar'));
assert.ok(!b0.rinci.kas.some(x => x.kel === 'Operasional usaha') && b0.rinci.ops.some(x => x.apa === 'Bensin & servis pikap'));
const [by, bm] = b0.bulan.split('-').map(Number);
assert.strictEqual(b0.hari.length, new Date(by, bm, 0).getDate()); assert.strictEqual(b0.hari[0].tgl, b0.bulan + '-01');
// Upah per orang per hari (untuk gajian): jumlah rinciannya = total orang itu.
r.minggu.slice(0, 2).concat(r.bulan).forEach(m => m.orang.forEach(o => {
  assert.ok(Array.isArray(o.rinci), 'rincian per hari ' + o.nama);
  assert.strictEqual(o.rinci.reduce((t, x) => t + x.upah, 0), o.total, 'rincian upah ' + o.nama + ' ' + (m.mulai || m.bulan));
}));
const ekoBulan = b0.orang.find(o => o.nama === 'Eko & Pak Gatot');
assert.ok(ekoBulan && ekoBulan.rinci.some(x => x.pos === 'Penyulingan' && x.sulingan > 0), JSON.stringify(ekoBulan));
cek('Ringkasan: catatan asli di balik setiap angka minggu dan bulan (trip, saring, penjualan, kas, hari per hari, upah per orang per hari)');

// ------------------------------------------------------------------ 9b. Stok minyak
// Data: saring 5,44 kg (9 hari lalu) + 3,4? -> lihat fixture; penjualan 15,94 kg kemarin.
let st = r.stok;
assert.ok(st && st.dasar === null, 'belum pernah ditimbang');
const totalSaring = objek('Saring Minyak').reduce((t, x) => t + (Number(x['Minyak (kg)']) || 0), 0);
const totalJual = objek('Penjualan').reduce((t, x) => t + (Number(x['Minyak terjual (kg)']) || 0), 0);
assert.strictEqual(st.kg, Math.round((totalSaring - totalJual) * 100) / 100);
assert.strictEqual(panggil({ aksi: 'stokCatat', token: tokRofik, tanggal: hariIni, kg: 3 }).kode, 'SESI');
r = panggil({ aksi: 'stokCatat', token: tokPemilik, tanggal: isoHari(-3), kg: 2.5, keterangan: 'timbang semua jeriken' });
assert.ok(r.ok, JSON.stringify(r));
assert.strictEqual(r.catatan, Math.round((objek('Saring Minyak').filter(x => formatTanggal(x['Tanggal saring'], 'yyyy-MM-dd') <= isoHari(-3)).reduce((t, x) => t + x['Minyak (kg)'], 0) -
  objek('Penjualan').filter(x => formatTanggal(x['Tanggal'], 'yyyy-MM-dd') <= isoHari(-3)).reduce((t, x) => t + x['Minyak terjual (kg)'], 0)) * 100) / 100);
assert.strictEqual(r.selisih, Math.round((2.5 - r.catatan) * 100) / 100);
st = r.stok;
assert.strictEqual(st.dasar.tgl, isoHari(-3)); assert.strictEqual(st.dasar.sumber, 'Timbang');
const sesudahSaring = objek('Saring Minyak').filter(x => formatTanggal(x['Tanggal saring'], 'yyyy-MM-dd') > isoHari(-3)).reduce((t, x) => t + x['Minyak (kg)'], 0);
const sesudahJual = objek('Penjualan').filter(x => formatTanggal(x['Tanggal'], 'yyyy-MM-dd') > isoHari(-3)).reduce((t, x) => t + x['Minyak terjual (kg)'], 0);
assert.strictEqual(st.kg, Math.round((2.5 + sesudahSaring - sesudahJual) * 100) / 100, 'stok = timbang + disaring sesudahnya - terjual sesudahnya');
assert.strictEqual(st.riwayat[0].ket, 'timbang semua jeriken'); assert.strictEqual(st.riwayat[0].oleh, 'Mas Wildan');
assert.deepStrictEqual(sheets['Stok Minyak'].data[0], ['Timestamp', 'Tanggal', 'Stok ditimbang (kg)', 'Stok menurut catatan (kg)', 'Selisih (kg)', 'Keterangan', 'Diisi oleh']);
// Isian Saring Minyak dengan "Stok minyak di gudang" yang lebih baru jadi patokan baru.
panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Saring Minyak', id: 'sm-stok', nilai: { 'Tanggal saring': kemarin, 'Jumlah sulingan yang disaring': 2,
  'Minyak (kg)': 3.1, 'Kondisi bahan': 'Segar semua', 'Kondisi alat': ['Normal'], 'Stok minyak di gudang (kg)': 20 } });
st = panggil({ aksi: 'stok', token: tokPemilik }).stok;
assert.strictEqual(st.dasar.sumber, 'Saring'); assert.strictEqual(st.dasar.tgl, kemarin);
assert.strictEqual(st.kg, Math.round((20 - objek('Penjualan').filter(x => formatTanggal(x['Tanggal'], 'yyyy-MM-dd') > kemarin).reduce((t, x) => t + x['Minyak terjual (kg)'], 0)) * 100) / 100);
assert.ok(/paling jauh/.test(panggil({ aksi: 'stokCatat', token: tokPemilik, tanggal: isoHari(31), kg: 1 }).galat));
// Timbang pagi, jual siang di tanggal yang sama: penjualan yang dicatat sesudah timbangan mengurangi stok,
// yang dicatat sebelum timbangan dianggap sudah termasuk.
r = panggil({ aksi: 'stokCatat', token: tokPemilik, tanggal: hariIni, kg: 16.58, keterangan: 'timbang pagi' });
assert.ok(r.ok && r.stok.kg === 16.58, JSON.stringify(r.stok));
const shJual = sheets['Penjualan'], kJual = shJual.data[0];
const barisJual = (menit, kg) => { const b = kJual.map(() => ''); b[kJual.indexOf('Timestamp')] = new Date(Date.now() + menit * 60e3);
  b[kJual.indexOf('Tanggal')] = tgl(hariIni); b[kJual.indexOf('Pembeli')] = 'Uji stok'; b[kJual.indexOf('Minyak terjual (kg)')] = kg; return b; };
const nJualAwal = shJual.data.length;
shJual.data.push(barisJual(-120, 3), barisJual(240, 10));
st = panggil({ aksi: 'stok', token: tokPemilik }).stok;
assert.strictEqual(st.kg, 6.58, 'jual 10 kg sesudah timbang dikurangi, jual 3 kg sebelum timbang tidak: ' + JSON.stringify(st));
assert.strictEqual(st.nKeluar, 1);
shJual.data.splice(nJualAwal, 2);
// Ubah & hapus hasil timbang: baris dicocokkan dengan nomor baris + Timestamp, selisih dihitung ulang, dicatat di Log.
st = panggil({ aksi: 'stok', token: tokPemilik }).stok;
let tb = st.riwayat[0];
assert.ok(tb.baris >= 2 && tb.w > 0 && tb.ket === 'timbang pagi', JSON.stringify(tb));
assert.strictEqual(panggil({ aksi: 'stokUbah', token: tokRofik, baris: tb.baris, w: tb.w, tanggalLama: tb.tgl, tanggal: hariIni, kg: 1 }).ok, false, 'pencatat tidak boleh');
r = panggil({ aksi: 'stokUbah', token: tokPemilik, baris: tb.baris, w: tb.w + 1, tanggalLama: tb.tgl, tanggal: hariIni, kg: 1 });
assert.strictEqual(r.kode, 'BERUBAH', 'Timestamp tidak cocok = baris lain');
const catatanLama = sheets['Stok Minyak'].data[tb.baris - 1][3];
r = panggil({ aksi: 'stokUbah', token: tokPemilik, baris: tb.baris, w: tb.w, tanggalLama: tb.tgl, tanggal: hariIni, kg: 17.1, keterangan: '3 jerigen' });
assert.ok(r.ok, JSON.stringify(r));
assert.strictEqual(r.catatan, catatanLama, 'stok menurut catatan tetap (tanggal & jam timbang sama)');
assert.strictEqual(r.selisih, Math.round((17.1 - catatanLama) * 100) / 100);
assert.strictEqual(r.stok.kg, 17.1); assert.strictEqual(r.stok.riwayat[0].ket, '3 jerigen');
const brs = sheets['Stok Minyak'].data[tb.baris - 1];
assert.strictEqual(brs[2], 17.1); assert.strictEqual(waktuMs(brs[0]), tb.w, 'jam timbang tidak berubah');
assert.ok(sheets['Log Aplikasi'].data.some(x => x[1] === 'Ubah timbang'), 'ubah timbang dicatat di Log');
// Hasil timbang untuk besok boleh; lalu dihapus.
r = panggil({ aksi: 'stokCatat', token: tokPemilik, tanggal: besok, kg: 5, keterangan: 'uji besok' });
assert.ok(r.ok && r.stok.dasar.tgl === besok, 'timbang tanggal besok boleh');
tb = r.stok.riwayat[0];
const nStok = sheets['Stok Minyak'].getLastRow();
r = panggil({ aksi: 'stokUbah', token: tokPemilik, hapus: true, baris: tb.baris, w: tb.w, tanggalLama: tb.tgl });
assert.ok(r.ok && r.stok.dasar.tgl === hariIni && r.stok.kg === 17.1, JSON.stringify(r.stok));
assert.strictEqual(sheets['Stok Minyak'].getLastRow(), nStok - 1);
assert.ok(sheets['Log Aplikasi'].data.some(x => x[1] === 'Hapus timbang'), 'hapus timbang dicatat di Log');
cek('Stok minyak: dari catatan, hasil timbang jadi patokan, selisih tercatat, Saring "stok di gudang" ikut dipakai, jual sesudah timbang di hari yang sama ikut dikurangi, timbang bisa diubah & dihapus');

// ------------------------------------------------------------------ 9b2. Cache ringkasan
{
  const r1 = panggil({ aksi: 'ringkasan', token: tokPemilik, segar: true });
  assert.ok(r1.ok && !r1.dariCache && /^\d\d:\d\d$/.test(r1.dihitung), 'segar: dihitung ulang');
  const r2 = panggil({ aksi: 'ringkasan', token: tokPemilik });
  assert.ok(r2.dariCache, 'kedua kalinya dari cache');
  delete r2.dariCache;
  assert.deepStrictEqual(r2, r1, 'isi cache sama persis dengan hasil hitung');
  panggil({ aksi: 'stok', token: tokPemilik });
  assert.ok(panggil({ aksi: 'ringkasan', token: tokPemilik }).dariCache, 'aksi baca tidak membuang cache');
  panggil({ aksi: 'simpan', token: tokPemilik, tab: 'Kas', id: 'kas-cache', nilai: { 'Tanggal': hariIni, 'Kategori': objek('Kas')[0]['Kategori'], 'Jumlah (Rp)': 1000, 'Keterangan': 'uji cache' } });
  const r3 = panggil({ aksi: 'ringkasan', token: tokPemilik });
  assert.ok(r3.ok && !r3.dariCache, 'sesudah ada catatan baru, ringkasan dihitung ulang');
  assert.strictEqual(panggil({ aksi: 'ringkasan', token: tokRofik }).ok, false, 'pencatat tetap tidak boleh melihat ringkasan (walau ada cache)');
}
cek('Ringkasan disimpan sebentar di cache, dibuang setiap ada perubahan data, tombol muat ulang menghitung ulang');

// ------------------------------------------------------------------ 9b3. Catatan bon
{
  assert.strictEqual(panggil({ aksi: 'bon', token: tokRofik }).ok, false, 'pencatat tidak boleh melihat bon');
  let rb = panggil({ aksi: 'bon', token: tokPemilik });
  assert.ok(rb.ok && Array.isArray(rb.bon) && rb.bon.length === 0, 'belum ada bon');
  assert.ok(!sheets['Bon'], 'tab Bon belum dibuat sebelum ada bon');
  assert.ok(/ngebon/.test(panggil({ aksi: 'bonSimpan', token: tokPemilik, arah: 'x', nama: 'A', jumlah: 1, tanggal: hariIni }).galat));
  assert.ok(/Jumlah/.test(panggil({ aksi: 'bonSimpan', token: tokPemilik, arah: 'Orang ngebon', nama: 'A', jumlah: 0, tanggal: hariIni }).galat));
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, idBaru: 'bon-rofik', arah: 'Orang ngebon', nama: 'Rofik', untuk: 'kasbon', jumlah: 300000, tanggal: kemarin, tempo: besok });
  assert.ok(rb.ok && rb.bon.length === 1, JSON.stringify(rb));
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, idBaru: 'bon-rofik', arah: 'Orang ngebon', nama: 'Rofik', untuk: 'kasbon', jumlah: 300000, tanggal: kemarin });
  assert.strictEqual(rb.bon.length, 1, 'kirim ulang tidak dobel');
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, idBaru: 'bon-toko', arah: 'Kita ngebon', nama: 'Toko Bangunan Jaya', untuk: 'semen 10 sak', jumlah: 650000, tanggal: hariIni });
  assert.strictEqual(rb.bon.length, 2);
  assert.deepStrictEqual(sheets['Bon'].data[0], ['ID', 'Timestamp', 'Tanggal', 'Arah', 'Nama', 'Untuk', 'Jumlah (Rp)', 'Jatuh tempo', 'Keterangan', 'Diisi oleh', 'Dibayar (Rp)', 'Sisa (Rp)', 'Status', 'Tanggal lunas', 'Bentuk', 'Masuk Kas', 'Kategori kas']);
  // Bon langsung tercatat di Kas: kasbon = uang keluar "Bon pekerja (dipinjamkan)"; pinjam uang = "Pinjaman masuk".
  const kasBon = id => objek('Kas').filter(x => String(x['Keterangan']).includes('[bon:' + id + ']'));
  const kasBayar = id => objek('Kas').filter(x => String(x['Keterangan']).includes('[bayar bon:' + id + ']'));
  let kb = kasBon('bon-rofik');
  assert.ok(kb.length === 1 && kb[0]['Kategori'] === 'Bon pekerja (dipinjamkan)' && kb[0]['Jumlah (Rp)'] === 300000 && formatTanggal(kb[0]['Tanggal'], 'yyyy-MM-dd') === kemarin, JSON.stringify(kb));
  assert.ok(/^Bon Rofik: kasbon \[bon:bon-rofik\]$/.test(kb[0]['Keterangan']), kb[0]['Keterangan']);
  assert.strictEqual(kasBon('bon-toko').length, 1); assert.strictEqual(kasBon('bon-toko')[0]['Kategori'], 'Pinjaman masuk');
  // Bayar sebagian -> Dicicil; lebih dari sisa ditolak; sisanya -> Lunas.
  rb = panggil({ aksi: 'bonBayar', token: tokPemilik, idBaru: 'bayar-1', idBon: 'bon-rofik', tanggal: hariIni, jumlah: 100000, cara: 'Potong upah' });
  let rofik = rb.bon.find(x => x.id === 'bon-rofik');
  assert.ok(rofik.status === 'Dicicil' && rofik.dibayar === 100000 && rofik.sisa === 200000, JSON.stringify(rofik));
  kb = kasBayar('bayar-1');
  assert.ok(kb.length === 1 && kb[0]['Kategori'] === 'Pelunasan bon pekerja' && kb[0]['Jumlah (Rp)'] === 100000 && /potong upah/.test(kb[0]['Keterangan']), JSON.stringify(kb));
  rb = panggil({ aksi: 'bonBayar', token: tokPemilik, idBaru: 'bayar-1', idBon: 'bon-rofik', tanggal: hariIni, jumlah: 100000, cara: 'Potong upah' });
  assert.strictEqual(rb.bon.find(x => x.id === 'bon-rofik').bayar.length, 1, 'pembayaran tidak dobel');
  assert.ok(/Lebih dari sisa bon \(Rp200\.000\)/.test(panggil({ aksi: 'bonBayar', token: tokPemilik, idBon: 'bon-rofik', tanggal: hariIni, jumlah: 250000 }).galat));
  rb = panggil({ aksi: 'bonBayar', token: tokPemilik, idBaru: 'bayar-2', idBon: 'bon-rofik', tanggal: hariIni, jumlah: 200000, cara: 'Tunai' });
  rofik = rb.bon.find(x => x.id === 'bon-rofik');
  assert.ok(rofik.status === 'Lunas' && rofik.sisa === 0 && rofik.tglLunas === hariIni && rofik.bayar.length === 2, JSON.stringify(rofik));
  const barisBon = objek('Bon').find(x => x['ID'] === 'bon-rofik');
  assert.ok(barisBon['Status'] === 'Lunas' && barisBon['Dibayar (Rp)'] === 300000 && barisBon['Sisa (Rp)'] === 0 && isDate(barisBon['Tanggal lunas']), JSON.stringify(barisBon));
  assert.strictEqual(objek('Bayar Bon').length, 2);
  assert.strictEqual(kasBayar('bayar-2').length, 1, 'pelunasan tunai juga masuk Kas');
  // Kas dari bon tidak bisa diubah/dihapus lewat Riwayat Kas.
  const rKas = panggil({ aksi: 'terbaru', token: tokPemilik, tab: 'Kas', n: 50 }).data.find(x => String(x.nilai['Keterangan']).includes('[bayar bon:bayar-2]'));
  assert.ok(/Catatan bon/.test(panggil({ aksi: 'ubah', token: tokPemilik, tab: 'Kas', id: rKas.id, nilai: { 'Jumlah (Rp)': 1 } }).galat));
  assert.ok(/Catatan bon/.test(panggil({ aksi: 'hapus', token: tokPemilik, tab: 'Kas', id: rKas.id }).galat));
  // Hapus satu pembayaran -> kembali Dicicil.
  rb = panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bayar', id: 'bayar-2' });
  rofik = rb.bon.find(x => x.id === 'bon-rofik');
  assert.ok(rofik.status === 'Dicicil' && rofik.sisa === 200000);
  assert.strictEqual(objek('Bon').find(x => x['ID'] === 'bon-rofik')['Status'], 'Dicicil');
  assert.strictEqual(kasBayar('bayar-2').length, 0, 'baris Kas pembayaran ikut terhapus');
  // Ubah jumlah bon -> sisa dihitung ulang.
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, id: 'bon-rofik', arah: 'Orang ngebon', nama: 'Rofik', untuk: 'kasbon + bensin', jumlah: 350000, tanggal: kemarin });
  rofik = rb.bon.find(x => x.id === 'bon-rofik');
  assert.ok(rofik.sisa === 250000 && rofik.untuk === 'kasbon + bensin' && rofik.bayar.length === 1, JSON.stringify(rofik));
  kb = kasBon('bon-rofik');
  assert.ok(kb.length === 1 && kb[0]['Jumlah (Rp)'] === 350000 && /kasbon \+ bensin/.test(kb[0]['Keterangan']), 'baris Kas ikut berubah: ' + JSON.stringify(kb));
  // Bon lama yang dulu sudah dicatat manual di Kas: simpan tanpa Kas, lalu bisa dimasukkan belakangan.
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, idBaru: 'bon-lama', arah: 'Orang ngebon', nama: 'Pak Muh', untuk: 'bon lama', jumlah: 150000, tanggal: lusa, masukKas: false });
  assert.ok(rb.ok && kasBon('bon-lama').length === 0 && rb.bon.find(x => x.id === 'bon-lama').masukKas === false);
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, id: 'bon-lama', arah: 'Orang ngebon', nama: 'Pak Muh', untuk: 'bon lama', jumlah: 150000, tanggal: lusa, masukKas: true });
  assert.strictEqual(kasBon('bon-lama').length, 1, 'dicatat ke Kas belakangan');
  rb = panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bon', id: 'bon-lama' });
  assert.strictEqual(kasBon('bon-lama').length, 0);
  // Kita ngebon barang (semen): Kas baru tercatat saat dibayar, dengan kategori pilihan; bayar dengan barang tidak masuk Kas.
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, idBaru: 'bon-semen', arah: 'Kita ngebon', bentuk: 'Barang', kategoriKas: 'Proyek bangunan', nama: 'Toko Jaya', untuk: 'semen 5 sak', jumlah: 300000, tanggal: hariIni });
  assert.ok(rb.ok && kasBon('bon-semen').length === 0, 'ambil barang dulu: belum ada uang keluar');
  rb = panggil({ aksi: 'bonBayar', token: tokPemilik, idBaru: 'bayar-semen', idBon: 'bon-semen', tanggal: hariIni, jumlah: 200000, cara: 'Transfer' });
  kb = kasBayar('bayar-semen');
  assert.ok(kb.length === 1 && kb[0]['Kategori'] === 'Proyek bangunan' && kb[0]['Jumlah (Rp)'] === 200000, JSON.stringify(kb));
  rb = panggil({ aksi: 'bonBayar', token: tokPemilik, idBaru: 'bayar-semen-2', idBon: 'bon-semen', tanggal: hariIni, jumlah: 100000, cara: 'Barang' });
  assert.ok(rb.bon.find(x => x.id === 'bon-semen').status === 'Lunas' && kasBayar('bayar-semen-2').length === 0);
  rb = panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bon', id: 'bon-semen' });
  assert.strictEqual(kasBayar('bayar-semen').length, 0);
  // Kategori kas belum ada: bon tetap tersimpan, ada peringatan.
  const dKat = sheets['Daftar'].data.find(x => x[16] === 'Bon pekerja (dipinjamkan)');
  dKat[16] = '';
  rb = panggil({ aksi: 'bonSimpan', token: tokPemilik, idBaru: 'bon-tanpa-kat', arah: 'Orang ngebon', nama: 'Rofik', untuk: 'uji', jumlah: 1000, tanggal: hariIni });
  assert.ok(rb.ok && /belum ada di Kelola/.test(rb.peringatan) && kasBon('bon-tanpa-kat').length === 0, JSON.stringify(rb.peringatan));
  dKat[16] = 'Bon pekerja (dipinjamkan)';
  panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bon', id: 'bon-tanpa-kat' });
  // Bayar per orang: cicil dibagi ke bon terlama dulu, lunas melunasi semua bon orang itu.
  panggil({ aksi: 'bonSimpan', token: tokPemilik, idBaru: 'bon-rofik-2', arah: 'Orang ngebon', nama: 'Rofik', untuk: 'bensin', jumlah: 100000, tanggal: hariIni });
  assert.ok(/Lebih dari sisa bon Rofik \(Rp350\.000\)/.test(panggil({ aksi: 'bonBayarOrang', token: tokPemilik, arah: 'Orang ngebon', nama: 'Rofik', jumlah: 400000, tanggal: hariIni }).galat));
  rb = panggil({ aksi: 'bonBayarOrang', token: tokPemilik, idBaru: 'cicil-1', arah: 'Orang ngebon', nama: 'Rofik', jumlah: 300000, tanggal: hariIni, cara: 'Potong upah' });
  const r1 = rb.bon.find(x => x.id === 'bon-rofik'), r2 = rb.bon.find(x => x.id === 'bon-rofik-2');
  assert.ok(r1.status === 'Lunas' && r2.status === 'Dicicil' && r2.sisa === 50000, 'bon terlama dilunasi dulu: ' + JSON.stringify([r1.sisa, r2.sisa]));
  assert.ok(kasBayar('cicil-1-1').length === 1 && kasBayar('cicil-1-2').length === 1 && kasBayar('cicil-1-1')[0]['Jumlah (Rp)'] === 250000);
  rb = panggil({ aksi: 'bonBayarOrang', token: tokPemilik, idBaru: 'cicil-1', arah: 'Orang ngebon', nama: 'Rofik', jumlah: 300000, tanggal: hariIni, cara: 'Potong upah' });
  assert.strictEqual(rb.bon.find(x => x.id === 'bon-rofik-2').sisa, 50000, 'kirim ulang tidak dobel');
  rb = panggil({ aksi: 'bonBayarOrang', token: tokPemilik, idBaru: 'lunas-1', arah: 'Orang ngebon', nama: 'Rofik', jumlah: 50000, tanggal: hariIni });
  assert.ok(rb.bon.filter(x => x.nama === 'Rofik').every(x => x.status === 'Lunas'));
  assert.strictEqual(panggil({ aksi: 'bonBayarOrang', token: tokPemilik, arah: 'Orang ngebon', nama: 'Rofik', jumlah: 1000, tanggal: hariIni }).kode, 'BERUBAH');
  panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bon', id: 'bon-rofik-2' });
  ['cicil-1-1', 'lunas-1-1'].forEach(id => panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bayar', id }));
  rb = panggil({ aksi: 'bon', token: tokPemilik });
  assert.strictEqual(rb.bon.find(x => x.id === 'bon-rofik').sisa, 250000);
  // Hapus bon -> pembayarannya ikut terhapus.
  rb = panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bon', id: 'bon-rofik' });
  assert.ok(rb.ok && rb.bon.length === 1 && objek('Bayar Bon').length === 0);
  assert.ok(kasBon('bon-rofik').length === 0 && kasBayar('bayar-1').length === 0, 'hapus bon: semua baris Kas-nya ikut terhapus');
  panggil({ aksi: 'bonHapus', token: tokPemilik, jenis: 'bon', id: 'bon-toko' });
  assert.strictEqual(kasBon('bon-toko').length, 0);
  ['Tambah bon', 'Bayar bon', 'Hapus bayar bon', 'Ubah bon', 'Hapus bon'].forEach(a => assert.ok(sheets['Log Aplikasi'].data.some(x => x[1] === a), 'log ' + a));
  // Penjualan belum dibayar ikut tampil dan bisa ditandai lunas lewat 'ubah'.
  const shJ = sheets['Penjualan'], kJ = shJ.data[0];
  const jIdx = shJ.data.findIndex((x, i) => i > 0 && x[kJ.indexOf('Pembeli')]);
  const stLama = shJ.data[jIdx][kJ.indexOf('Status bayar')];
  shJ.data[jIdx][kJ.indexOf('Status bayar')] = 'Belum dibayar';
  rb = panggil({ aksi: 'bon', token: tokPemilik });
  const j1 = rb.jual.find(x => x.status === 'Belum dibayar');
  assert.ok(j1 && j1.jumlah > 0 && j1.nama, JSON.stringify(rb.jual));
  assert.ok(panggil({ aksi: 'ubah', token: tokPemilik, tab: 'Penjualan', id: j1.id, nilai: { 'Status bayar': 'Lunas' } }).ok);
  assert.ok(!panggil({ aksi: 'bon', token: tokPemilik }).jual.some(x => x.id === j1.id), 'sesudah ditandai lunas tidak tampil lagi');
  shJ.data[jIdx][kJ.indexOf('Status bayar')] = stLama;
}
// Tab Bon dari versi sebelumnya (14 kolom, bon Eko belum tercatat di Kas): kolom baru ditambah, bon bisa dicatat ke Kas.
{
  const s2 = buatData();
  s2['Bon'] = buatSheet('Bon', [['ID', 'Timestamp', 'Tanggal', 'Arah', 'Nama', 'Untuk', 'Jumlah (Rp)', 'Jatuh tempo', 'Keterangan', 'Diisi oleh', 'Dibayar (Rp)', 'Sisa (Rp)', 'Status', 'Tanggal lunas'],
    ['8b9bb46ab28e38d0', new Date(), tgl(isoHari(-3)), 'Orang ngebon', 'Eko & Pak Gatot', 'Bayar angsuran motor', 1500000, '', '', 'Mas Wildan', 0, 1500000, 'Belum lunas', '']]);
  const sv2 = muat(s2);
  const t2 = sv2.panggil({ aksi: 'masuk', pengguna: 'wildan', sandi: '250610' }).token;
  let r2 = sv2.panggil({ aksi: 'bon', token: t2 });
  const eko = r2.bon[0];
  assert.ok(eko && eko.masukKas === false && eko.sisa === 1500000, JSON.stringify(eko));
  r2 = sv2.panggil({ aksi: 'bonSimpan', token: t2, id: eko.id, arah: eko.arah, nama: eko.nama, untuk: eko.untuk, jumlah: eko.jumlah, tanggal: eko.tgl, masukKas: true });
  assert.ok(r2.ok && r2.bon[0].masukKas === true, JSON.stringify(r2));
  assert.deepStrictEqual(s2['Bon'].data[0].slice(14), ['Bentuk', 'Masuk Kas', 'Kategori kas'], 'kolom baru ditambahkan di kanan');
  assert.strictEqual(s2['Bon'].data[1][15], 'Ya');
  const kasEko = s2['Kas'].data.filter(x => String(x[5]).includes('[bon:8b9bb46ab28e38d0]'));
  assert.ok(kasEko.length === 1 && kasEko[0][3] === 'Bon pekerja (dipinjamkan)' && kasEko[0][4] === 1500000, JSON.stringify(kasEko));
}
cek('Catatan bon: dua arah, cicilan sampai lunas, ubah & hapus, kirim ulang tidak dobel, penjualan belum dibayar bisa ditandai lunas, semua perubahan ikut tercatat di Kas');

// ------------------------------------------------------------------ 9c. Batas peringatan
assert.strictEqual(panggil({ aksi: 'batas', token: tokRofik }).ok, false, 'pencatat tidak boleh');
r = panggil({ aksi: 'batas', token: tokPemilik });
assert.ok(r.ok, JSON.stringify(r));
const bt = Object.fromEntries(r.batas.map(x => [x.k, x]));
assert.deepStrictEqual(['hargaBahan', 'rendemen', 'ketelKosong', 'laba', 'periodeLaba', 'pangsa', 'periodePangsa', 'jatahKeluarga', 'belumDibayar', 'keterangan', 'kasTanpaKategori']
  .map(k => bt[k].nilai), [15, 20, 2, 0, 1, 80, 90, 7000000, 0, 0, 0]);
assert.ok(r.batas.every(x => !x.rusak), JSON.stringify(r.batas.filter(x => x.rusak)));
assert.strictEqual(bt.laba.sekarang.status, 'PERHATIAN'); assert.strictEqual(bt.pangsa.sekarang.nilai, '98,4%');
const pg = (sel) => sheets['Pengaturan'].getRange(sel).getValue(), db = (sel) => sheets['Dashboard'].getRange(sel).getValue();
r = panggil({ aksi: 'batasSimpan', token: tokPemilik, nilai: { hargaBahan: 12.5, periodeLaba: 4, jatahKeluarga: '', keterangan: 20 } });
assert.ok(r.ok, JSON.stringify(r));
assert.strictEqual(pg('B6'), 0.125); assert.strictEqual(pg('B10'), ''); assert.strictEqual(db('D22'), 20);
assert.deepStrictEqual([pg('A16'), pg('B16')], ['Periode laba di peringatan (minggu)', 4], 'baris periode laba dibuat');
assert.strictEqual(pg('B7'), 0.2, 'yang tidak dikirim tidak berubah');
assert.strictEqual(sheets['Pengaturan'].getRange('A18').getValue(), 'PIN aplikasi Catatan Sembada', 'bagian lain Pengaturan tidak bergeser');
assert.strictEqual(Object.fromEntries(r.batas.map(x => [x.k, x.nilai])).periodeLaba, 4);
const logBatas = sheets['Log Aplikasi'].data.filter(x => x[1] === 'Ubah batas peringatan');
assert.strictEqual(logBatas.length, 1); assert.strictEqual(logBatas[0][6], 'Mas Wildan');
r = panggil({ aksi: 'batasSimpan', token: tokPemilik, nilai: { pangsa: 150, ketelKosong: 1.5, hargaBahan: '' } });
assert.ok(!r.ok && /10 sampai 100/.test(r.salah.pangsa) && /bulat/.test(r.salah.ketelKosong) && /Wajib/.test(r.salah.hargaBahan), JSON.stringify(r));
assert.strictEqual(pg('B6'), 0.125, 'tidak ada yang ditulis kalau ada yang salah');
sheets['Dashboard'].rumus['21,4'] = '=X';
r = panggil({ aksi: 'batasSimpan', token: tokPemilik, nilai: { belumDibayar: 500000 } });
assert.ok(!r.ok && /rumus/.test(r.salah.belumDibayar), 'sel berumus tidak ditimpa');
delete sheets['Dashboard'].rumus['21,4'];
sheets['Pengaturan'].data[6][0] = 'Catatan lain';
r = panggil({ aksi: 'batasSimpan', token: tokPemilik, nilai: { rendemen: 25 } });
assert.ok(!r.ok && /Susunan tab Pengaturan berubah/.test(r.salah.rendemen), JSON.stringify(r));
assert.strictEqual(pg('B7'), 0.2);
assert.ok(panggil({ aksi: 'batas', token: tokPemilik }).batas.find(x => x.k === 'rendemen').rusak);
sheets['Pengaturan'].data[6][0] = 'Batas penurunan rendemen';
cek('Batas peringatan: dibaca dan diubah di sel yang sama dengan Dashboard, judul baris & rumus dicek, dicatat di Log');

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
