// Uji logika api.gs (versi 6) dengan Sheet tiruan (tanpa Google). Jalankan: node tes/api_test.js
const assert = require('assert');
const { buatSheet, muat, tgl, isDate } = require('./tiruan');
const J = o => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------------ data tiruan
const kas = buatSheet('Kas', [
  ['Hari', 'Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Kelompok', 'Arah'],
  ['Selasa', new Date('2026-10-20T07:11:00'), tgl('2026-10-20'), 'Proyek bangunan', 300000, 'semen', 'Proyek lain', 'Keluar']
], [0, 6, 7]);
const KEPALA_LAMA = ['Hari', 'Timestamp', 'Tanggal', 'Pengumpul [Rofik]', 'Pengumpul [Pak Muh]', 'Tim suling [Eko & Pak Gatot]', 'Keterangan',
  'Ada kerja lain dengan upah khusus hari ini?', 'Pekerjaan lain', 'Kerja lain untuk', 'Upah kerja lain Rofik (Rp)', 'Upah kerja lain Pak Muh (Rp)',
  'Upah kerja lain Eko & Pak Gatot (Rp)', 'Upah Rofik'];
const absensiLama = buatSheet('Absensi', [KEPALA_LAMA], [0, 13]);
const absensiHarian = buatSheet('Absensi Harian', [['Hari', 'Timestamp', 'Tanggal', 'Nama', 'Tim', 'Pekerjaan', 'Alat', 'Jumlah sulingan', 'Upah (Rp)',
  'Pos upah', 'Pekerjaan lain', 'Kerja lain untuk', 'Keterangan', 'Diisi oleh']], [0]);
const pengguna = buatSheet('Pengguna', [['Nama', 'PIN', 'Peran', 'Boleh mengisi', 'Absen untuk', 'Aktif', 'Catatan'],
  ['Mas Wildan', '123456', 'Pemilik', 'Semua', '', 'Ya', ''],
  ['Rofik', '1111', 'Pekerja', 'Ambil Bahan', 'Rofik', 'Ya', ''],
  ['Pengumpul bersama', '8888', 'Pekerja', 'Ambil Bahan', 'Semua Pengumpul', 'Ya', ''],
  ['Eko', '6125', 'Pekerja', '', 'Eko & Pak Gatot', 'Ya', ''],
  ['Pak Mandor', '7777', 'Mandor', 'Kas', '', 'Ya', ''],
  ['Lama', '5555', 'Pekerja', 'Kas', '', 'Tidak', ''],
  ['Kosong', '', 'Mandor', '', '', 'Ya', '']]);
const karyawan = buatSheet('Karyawan', [['Nama', 'Tim', 'Alat', 'Aktif', 'Catatan'],
  ['Rofik', 'Pengumpul', '', 'Ya', ''], ['Pak Muh', 'Pengumpul', '', 'Ya', ''], ['Mas Romadi', 'Pengumpul', '', 'Tidak', ''],
  ['Eko & Pak Gatot', 'Tim suling', 'Ketel 1', 'Ya', '']]);
const alat = buatSheet('Alat Suling', [['Nama alat', 'Aktif', 'Catatan'], ['Ketel 1', 'Ya', ''], ['Ketel 2', 'Ya', '']]);
const aplikasi = buatSheet('Pengaturan Aplikasi', [['Kunci', 'Nilai', 'Keterangan']]);
const pengaturan = buatSheet('Pengaturan', Array.from({ length: 30 }, () => []));
const daftar = buatSheet('Daftar', [
  ['Pengumpul', '', 'Produk', 'Satuan', 'Kategori kas', 'Arah'],
  ['Rofik', '', 'Minyak', 'kg', 'Proyek bangunan', 'Keluar'],
  ['Mas Romadi', '', 'Hidrosol', 'liter', 'Pinjaman masuk', 'Masuk']
]);
const ambilBahan = buatSheet('Ambil Bahan', [['Hari', 'Timestamp', 'Tanggal', 'Pengumpul', 'Uang beli bahan (Rp)'], ['Rabu', new Date(), new Date(), 'Rofik', 1]], [0, 4]);
const tarif = buatSheet('Tarif Upah', [['Pilihan', 'Untuk', 'Upah', 'Jenis kerja', 'Jumlah sulingan'],
  ['Libur', 'Semua', 0, 'Libur', 0], ['1 trip', 'Pengumpul', 76000, 'Pengumpulan', 0], ['2 trip', 'Pengumpul', 126000, 'Pengumpulan', 0],
  ['Harian kenek', 'Pengumpul', 100000, 'Kerja harian', 0], ['2x suling', 'Tim suling', 180000, 'Penyulingan', 2],
  ['3x suling', 'Tim suling', 295000, 'Penyulingan', 3], ['Harian 1 orang', 'Tim suling', 100000, 'Kerja harian', 0],
  ['Kerja lain', 'Semua', 0, 'Kerja lain', 0]]);

const { ctx, ss, cache, props, sheets } = muat({ Kas: kas, 'Ambil Bahan': ambilBahan, Absensi: absensiLama, 'Absensi Harian': absensiHarian,
  Pengguna: pengguna, Karyawan: karyawan, 'Alat Suling': alat, 'Pengaturan Aplikasi': aplikasi, Pengaturan: pengaturan, Daftar: daftar, 'Tarif Upah': tarif });
const L = (o) => ctx.layani_(ss, o);
const hariIni = ctx.tglIso_(new Date());

// ------------------------------------------------------------------ 1. PIN per orang
let r = L({ aksi: 'masuk', pin: '123456' });
assert.strictEqual(r.ok, true); assert.strictEqual(r.semua, true); assert.strictEqual(r.tab.length, 5); assert.strictEqual(r.nama, 'Mas Wildan');
r = L({ aksi: 'masuk', pin: '1111' });
assert.deepStrictEqual(J(r.tab), ['Ambil Bahan', 'Absensi'], 'absen untuk diri sendiri membuka Absensi');
assert.strictEqual(r.kelompokAbsensi, 'Pengumpul');
r = L({ aksi: 'masuk', pin: '7777' });
assert.deepStrictEqual(J(r.tab), ['Absensi', 'Kas']); assert.strictEqual(r.mandor, true);
assert.strictEqual(L({ aksi: 'masuk', pin: '5555' }).kode, 'PIN', 'pengguna nonaktif ditolak');
assert.strictEqual(L({ aksi: 'masuk', pin: '' }).kode, 'PIN', 'PIN kosong ditolak');
assert.strictEqual(L({ aksi: 'masuk', pin: '9999' }).kode, 'PIN');

// ------------------------------------------------------------------ 2. Config
r = L({ aksi: 'config', pin: '123456', klien: 2 });
assert.ok(r.ok);
assert.strictEqual(r.versiApi, 6);
assert.deepStrictEqual(J(r.kepala.Kas), ['Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan']);
assert.deepStrictEqual(J(r.kepala.Absensi).slice(0, 4), ['Timestamp', 'Tanggal', 'Nama', 'Tim']);
assert.deepStrictEqual(J(r.daftar.Pengumpul), ['Rofik', 'Pak Muh'], 'pengumpul dari karyawan aktif');
assert.strictEqual(r.karyawan.length, 4); assert.strictEqual(r.alat.length, 2);
assert.deepStrictEqual(J(r.tim), ['Pengumpul', 'Tim suling']);
assert.strictEqual(r.tarif[4].sulingan, 2);
assert.strictEqual(r.absenUntuk, null);
r = L({ aksi: 'config', pin: '8888' });
assert.deepStrictEqual(J(r.absenUntuk), ['Rofik', 'Pak Muh', 'Mas Romadi']);
assert.ok(r.kepala.Absensi.includes('Pengumpul [Rofik]'), 'aplikasi lama mendapat judul kolom format lama');
assert.ok(r.kepala.Absensi.includes('Upah kerja lain Eko & Pak Gatot (Rp)'));
assert.ok(!r.kepala.Absensi.includes('Pengumpul [Mas Romadi]'), 'karyawan nonaktif tidak muncul');

// ------------------------------------------------------------------ 3. Simpan Kas (umum)
r = L({ aksi: 'simpan', pin: '123456', tab: 'Kas', id: 'a1', nilai: { 'Tanggal': '2026-10-21', 'Kategori': 'Proyek bangunan', 'Jumlah (Rp)': 200000, 'Keterangan': ' service disel ' } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(kas.disisipkan, 1); assert.strictEqual(kas.diurutkan, 1);
assert.ok(isDate(kas.data[1][1])); assert.ok(isDate(kas.data[1][2])); assert.strictEqual(kas.data[1][5], 'service disel');
assert.strictEqual(L({ aksi: 'simpan', pin: '123456', tab: 'Kas', id: 'a1', nilai: {} }).dobel, true);
r = L({ aksi: 'simpan', pin: '123456', tab: 'Kas', id: 'a2', nilai: { 'Tanggal': '2026-10-21', 'Kolom ngawur': 1 } });
assert.strictEqual(r.ok, false); assert.ok(/Kolom ngawur/.test(r.galat));
r = L({ aksi: 'simpan', pin: '1111', tab: 'Kas', id: 'a3', nilai: {} });
assert.ok(/tidak boleh/.test(r.galat));
console.log('Uji dasar lulus.');

// ------------------------------------------------------------------ 4. Absensi format baru
const absen = (pin, id, tgl, baris, ket) => L({ aksi: 'simpan', pin, tab: 'Absensi', id, nilai: { 'Tanggal': tgl, 'Keterangan': ket || '', baris } });
const barisAH = () => absensiHarian.data.slice(1).filter(x => x.length);
r = absen('1111', 'h1', '2026-10-21', [{ nama: 'Rofik', pekerjaan: '1 trip' }]);
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.ditambah, 1);
let b = barisAH()[0];
assert.strictEqual(b[3], 'Rofik'); assert.strictEqual(b[4], 'Pengumpul'); assert.strictEqual(b[5], '1 trip'); assert.strictEqual(b[8], 76000);
assert.strictEqual(b[9], 'Pengumpulan'); assert.strictEqual(b[13], 'Rofik'); assert.ok(isDate(b[2]));
assert.ok(/tidak boleh mengabsen Pak Muh/.test(absen('1111', 'h2', '2026-10-21', [{ nama: 'Pak Muh', pekerjaan: '1 trip' }]).galat));
assert.ok(/bukan pekerjaan rutin/.test(absen('1111', 'h3', '2026-10-21', [{ nama: 'Rofik', pekerjaan: 'Harian kenek' }]).galat));
assert.ok(/bukan pilihan untuk Pengumpul/.test(absen('123456', 'h3b', '2026-10-21', [{ nama: 'Rofik', pekerjaan: '2x suling' }]).galat));
assert.ok(/setelah hari ini/.test(absen('1111', 'h3c', '2999-01-01', [{ nama: 'Rofik', pekerjaan: '1 trip' }]).galat));
// penyuling: dua alat aktif, alat bawaan karyawan dipakai kalau tidak dipilih
r = absen('6125', 'h4', '2026-10-21', [{ nama: 'Eko & Pak Gatot', pekerjaan: '2x suling' }]);
assert.strictEqual(r.ok, true, JSON.stringify(r));
b = barisAH().filter(x => x[3] === 'Eko & Pak Gatot')[0];
assert.strictEqual(b[6], 'Ketel 1'); assert.strictEqual(b[7], 2); assert.strictEqual(b[8], 180000); assert.strictEqual(b[9], 'Penyulingan');
// isian sama = dobel, isian beda = bentrok
r = absen('6125', 'h5', '2026-10-21', [{ nama: 'Eko & Pak Gatot', pekerjaan: '2x suling', alat: 'Ketel 1' }]);
assert.strictEqual(r.ok, true); assert.strictEqual(r.dobel, true); assert.strictEqual(barisAH().length, 2);
r = absen('6125', 'h6', '2026-10-21', [{ nama: 'Eko & Pak Gatot', pekerjaan: '3x suling' }]);
assert.strictEqual(r.kode, 'SUDAH'); assert.ok(/Eko & Pak Gatot sudah tercatat "2x suling"/.test(r.galat), r.galat);
// mandor: kerja lain untuk orang yang sudah absen jobdesk (kategori lain) + harian
r = absen('7777', 'h7', '2026-10-21', [
  { nama: 'Rofik', pekerjaan: 'Kerja lain', upah: 50000, pekerjaanLain: 'tambal kolam', kerjaLainUntuk: 'Perawatan alat suling' },
  { nama: 'Pak Muh', pekerjaan: 'Harian kenek' }], 'hujan sore');
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.ditambah, 2);
b = barisAH().filter(x => x[3] === 'Rofik' && x[5] === 'Kerja lain')[0];
assert.strictEqual(b[8], 50000); assert.strictEqual(b[9], 'Perawatan alat'); assert.strictEqual(b[10], 'tambal kolam'); assert.strictEqual(b[12], 'hujan sore');
assert.strictEqual(b[13], 'Pak Mandor');
b = barisAH().filter(x => x[3] === 'Pak Muh')[0];
assert.strictEqual(b[9], 'Harian & lain'); assert.strictEqual(b[8], 100000);
assert.ok(/sudah tidak aktif/.test(absen('7777', 'h8', '2026-10-21', [{ nama: 'Mas Romadi', pekerjaan: '1 trip' }]).galat));
assert.ok(/tidak ada di daftar karyawan/.test(absen('7777', 'h9', '2026-10-21', [{ nama: 'Siapa', pekerjaan: '1 trip' }]).galat));
assert.ok(/diisi dua kali/.test(absen('7777', 'h9b', '2026-10-20', [{ nama: 'Rofik', pekerjaan: '1 trip' }, { nama: 'Rofik', pekerjaan: '2 trip' }]).galat));
// dua alat aktif dan karyawan tanpa alat bawaan: alat wajib dipilih
karyawan.data[4][2] = '';
assert.ok(/Pilih alat suling/.test(absen('123456', 'h10', '2026-10-20', [{ nama: 'Eko & Pak Gatot', pekerjaan: '3x suling' }]).galat));
r = absen('123456', 'h11', '2026-10-20', [{ nama: 'Eko & Pak Gatot', pekerjaan: '3x suling', alat: 'Ketel 2' }]);
assert.strictEqual(r.ok, true, JSON.stringify(r));
karyawan.data[4][2] = 'Ketel 1';
// keterangan saja (tanpa orang)
r = absen('7777', 'h12', '2026-10-19', [], 'hujan, tidak kerja');
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(barisAH().filter(x => x[12] === 'hujan, tidak kerja' && !x[3]).length, 1);
assert.strictEqual(absen('7777', 'h13', '2026-10-19', [], '').ok, false, 'kosong ditolak');
console.log('Uji absensi baru lulus.');

// ------------------------------------------------------------------ 5. Absensi dari aplikasi versi lama (format satu baris per hari)
r = L({ aksi: 'simpan', pin: '123456', tab: 'Absensi', id: 'l1', nilai: {
  'Tanggal': '2026-10-18', 'Pengumpul [Rofik]': '1 trip', 'Pengumpul [Pak Muh]': 'Kerja lain', 'Tim suling [Eko & Pak Gatot]': 'Libur',
  'Ada kerja lain dengan upah khusus hari ini?': 'Ya', 'Pekerjaan lain': 'ngaci kolam', 'Kerja lain untuk': 'Proyek bangunan & lainnya',
  'Upah kerja lain Pak Muh (Rp)': 115000, 'Upah kerja lain Rofik (Rp)': 20000, 'Keterangan': 'lama' } });
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.ditambah, 4);
const h18 = barisAH().filter(x => ctx.tglIso_(x[2]) === '2026-10-18');
assert.deepStrictEqual(h18.map(x => x[3] + ':' + x[5] + ':' + x[8]).sort(),
  ['Eko & Pak Gatot:Libur:0', 'Pak Muh:Kerja lain:115000', 'Rofik:1 trip:76000', 'Rofik:Kerja lain:20000']);
// PIN tim lama (aplikasi lama) tetap dibatasi jobdesk
r = L({ aksi: 'simpan', pin: '8888', tab: 'Absensi', id: 'l2', nilai: { 'Tanggal': '2026-10-17', 'Pengumpul [Pak Muh]': 'Harian kenek' } });
assert.strictEqual(r.ok, false); assert.ok(/bukan pekerjaan rutin/.test(r.galat));
r = L({ aksi: 'simpan', pin: '8888', tab: 'Absensi', id: 'l3', nilai: { 'Tanggal': '2026-10-17', 'Pengumpul [Pak Muh]': '2 trip', 'Pengumpul [Rofik]': 'Libur' } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
console.log('Uji absensi format lama lulus.');

// ------------------------------------------------------------------ 6. Pemindahan otomatis dari tab Absensi lama (Google Form lama)
absensiLama.data.push(['Kamis', new Date('2026-10-15T17:00:00+07:00'), tgl('2026-10-15'), '2 trip', 'Harian kenek', '2x suling', 'aman', 'Ya', 'tambal', 'Penyulingan', '', '', 30000]);
absensiLama.data.push(['Jumat', new Date('2026-10-16T17:00:00+07:00'), tgl('2026-10-16'), '', '', '', 'libur semua', 'Tidak']);
aplikasi.data.push(['absensiLamaSampai', 'ms ' + new Date('2026-10-15T00:00:00+07:00').getTime()]);
r = L({ aksi: 'terbaru', pin: '123456', tab: 'Absensi', n: 60 });
const h15 = barisAH().filter(x => ctx.tglIso_(x[2]) === '2026-10-15');
assert.deepStrictEqual(h15.map(x => x[3] + ':' + x[5] + ':' + x[8] + ':' + x[9]).sort(), [
  'Eko & Pak Gatot:2x suling:180000:Penyulingan', 'Eko & Pak Gatot:Kerja lain:30000:Penyulingan',
  'Pak Muh:Harian kenek:100000:Harian & lain', 'Rofik:2 trip:126000:Pengumpulan']);
assert.ok(h15.every(x => x[13] === 'Absensi lama'));
assert.strictEqual(h15.filter(x => x[5] === '2x suling')[0][6], 'Ketel 1', 'alat bawaan dipakai');
assert.strictEqual(barisAH().filter(x => ctx.tglIso_(x[2]) === '2026-10-16' && x[12] === 'libur semua').length, 1);
const jumlah = barisAH().length;
L({ aksi: 'terbaru', pin: '123456', tab: 'Absensi' });   // dipanggil lagi: tidak dobel
assert.strictEqual(barisAH().length, jumlah);
assert.strictEqual(aplikasi.data.filter(x => x[0] === 'absensiLamaSampai')[0][1], 'ms ' + new Date('2026-10-16T17:00:00+07:00').getTime());
console.log('Uji pemindahan absensi lama lulus.');

// ------------------------------------------------------------------ 7. Riwayat absensi: pekerja hanya melihat dirinya
r = L({ aksi: 'terbaru', pin: '1111', tab: 'Absensi', n: 60 });
assert.ok(r.baris.length > 0 && r.baris.every(x => x[3] === 'Rofik'), 'hanya baris Rofik');
assert.strictEqual(r.data, undefined);
r = L({ aksi: 'terbaru', pin: '123456', tab: 'Absensi', n: 60 });
assert.ok(r.baris.some(x => x[3] === 'Pak Muh'));
assert.strictEqual(r.data.length, r.baris.length);

// ------------------------------------------------------------------ 8. Ubah & hapus absensi (pemilik)
const dRofik = r.data.filter(d => d.nilai['Nama'] === 'Rofik' && d.nilai['Pekerjaan'] === '1 trip' && d.nilai['Tanggal'] === '2026-10-21')[0];
assert.ok(dRofik, 'data mentah absensi');
let nilaiUbah = Object.assign({}, dRofik.nilai, { 'Pekerjaan': '2 trip' });
r = L({ aksi: 'ubah', pin: '123456', tab: 'Absensi', nomor: dRofik.nomor, tanda: dRofik.tanda, nilai: nilaiUbah });
assert.strictEqual(r.ok, true, JSON.stringify(r));
b = barisAH().filter(x => x[3] === 'Rofik' && x[5] === '2 trip' && ctx.tglIso_(x[2]) === '2026-10-21')[0];
assert.ok(b); assert.strictEqual(b[8], 126000, 'upah dihitung ulang'); assert.ok(/diubah Mas Wildan/.test(b[13]));
r = L({ aksi: 'terbaru', pin: '123456', tab: 'Absensi', n: 60 });
const dPakMuh = r.data.filter(d => d.nilai['Nama'] === 'Pak Muh' && d.nilai['Tanggal'] === '2026-10-21')[0];
r = L({ aksi: 'ubah', pin: '123456', tab: 'Absensi', nomor: dPakMuh.nomor, tanda: dPakMuh.tanda, nilai: Object.assign({}, dPakMuh.nilai, { 'Nama': 'Rofik', 'Pekerjaan': '1 trip' }) });
assert.strictEqual(r.ok, false); assert.ok(/sudah punya catatan/.test(r.galat), r.galat);
r = L({ aksi: 'hapus', pin: '123456', tab: 'Absensi', nomor: dPakMuh.nomor, tanda: dPakMuh.tanda });
assert.strictEqual(r.ok, true);
assert.strictEqual(barisAH().filter(x => x[3] === 'Pak Muh' && ctx.tglIso_(x[2]) === '2026-10-21').length, 0);
console.log('Uji ubah/hapus absensi lulus.');

// ------------------------------------------------------------------ 9. Kelola pengguna
assert.strictEqual(L({ aksi: 'penggunaDaftar', pin: '1111' }).ok, false, 'pekerja tidak boleh');
r = L({ aksi: 'penggunaDaftar', pin: '123456' });
assert.strictEqual(r.pengguna.length, 7); assert.strictEqual(r.pengguna[0].saya, true);
const tambahP = p => L({ aksi: 'penggunaSimpan', pin: '123456', pengguna: p });
assert.ok(/sudah dipakai Rofik/.test(tambahP({ nama: 'Pak Muh', pin: '1111', peran: 'Pekerja', absenUntuk: ['Pak Muh'] }).galat));
assert.ok(/sudah ada/.test(tambahP({ nama: 'rofik', pin: '2222', peran: 'Pekerja' }).galat));
assert.ok(/4 sampai 8/.test(tambahP({ nama: 'Pak Muh', pin: '12', peran: 'Pekerja' }).galat));
r = tambahP({ nama: 'Pak Muh', pin: '0242', peran: 'Pekerja', boleh: ['Ambil Bahan', 'Kas', 'Absensi'], absenUntuk: ['Pak Muh'] });
assert.strictEqual(r.ok, true, JSON.stringify(r));
const pm = pengguna.data[r.baris - 1];
assert.deepStrictEqual(pm.slice(0, 6), ['Pak Muh', '0242', 'Pekerja', 'Ambil Bahan, Kas', 'Pak Muh', 'Ya']);
r = L({ aksi: 'masuk', pin: '0242' });
assert.deepStrictEqual(J(r.tab), ['Ambil Bahan', 'Absensi', 'Kas']);
// ubah: jadikan mandor
r = tambahP({ baris: 9, nama: 'Pak Muh', pin: '0243', peran: 'Mandor', boleh: [], absenUntuk: ['Pak Muh'] });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(pengguna.data[8][4], '', 'mandor tidak perlu daftar absen');
assert.strictEqual(L({ aksi: 'masuk', pin: '0242' }).kode, 'PIN');
assert.strictEqual(L({ aksi: 'masuk', pin: '0243' }).mandor, true);
assert.ok(/sendiri/.test(tambahP({ baris: 2, nama: 'Mas Wildan', pin: '123456', peran: 'Mandor' }).galat), 'tidak bisa menurunkan diri sendiri');
r = tambahP({ baris: 2, nama: 'Mas Wildan', pin: '654321', peran: 'Pemilik' });
assert.strictEqual(r.ok, true); assert.strictEqual(r.pinSaya, '654321');
assert.ok(/sendiri/.test(L({ aksi: 'penggunaHapus', pin: '654321', baris: 2, nama: 'Mas Wildan' }).galat));
assert.ok(/berubah/.test(L({ aksi: 'penggunaHapus', pin: '654321', baris: 7, nama: 'Salah' }).galat));
r = L({ aksi: 'penggunaHapus', pin: '654321', baris: 7, nama: 'Lama' });
assert.strictEqual(r.ok, true); assert.ok(!pengguna.data.some(x => x[0] === 'Lama'));
assert.ok(!/0243|654321/.test(JSON.stringify(sheets['Log Aplikasi'].data)), 'PIN tidak ditulis di log');
console.log('Uji kelola pengguna lulus.');

// ------------------------------------------------------------------ 10. Kelola karyawan & alat
const PIN = '654321';
const simpanK = k => L({ aksi: 'karyawanSimpan', pin: PIN, karyawan: k });
assert.ok(/sudah ada/.test(simpanK({ baru: true, nama: 'rofik', tim: 'Pengumpul' }).galat));
assert.ok(/koma/.test(simpanK({ baru: true, nama: 'A, B', tim: 'Pengumpul' }).galat));
assert.ok(/belum ada di Tarif/.test(simpanK({ baru: true, nama: 'Joko', tim: 'Tukang' }).galat));
r = simpanK({ baru: true, nama: 'Joko', tim: 'Tim suling', alat: 'Ketel 2' });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.deepStrictEqual(karyawan.data[5].slice(0, 4), ['Joko', 'Tim suling', 'Ketel 2', 'Ya']);
r = simpanK({ nama: 'Pak Muh', tim: 'Pengumpul', aktif: false });
assert.strictEqual(r.ok, true); assert.strictEqual(karyawan.data[2][3], 'Tidak');
assert.deepStrictEqual(J(L({ aksi: 'config', pin: PIN, klien: 2 }).daftar.Pengumpul), ['Rofik']);
assert.strictEqual(L({ aksi: 'karyawanSimpan', pin: '1111', karyawan: { baru: true, nama: 'X', tim: 'Pengumpul' } }).ok, false);
const simpanA = a => L({ aksi: 'alatSimpan', pin: PIN, alat: a });
assert.strictEqual(simpanA({ baru: true, nama: 'Ketel 3' }).ok, true);
assert.ok(/sudah ada/.test(simpanA({ baru: true, nama: 'ketel 3' }).galat));
assert.strictEqual(simpanA({ nama: 'Ketel 2', aktif: false }).ok, true);
assert.strictEqual(simpanA({ nama: 'Ketel 3', aktif: false }).ok, true);
assert.ok(/Minimal harus ada satu/.test(simpanA({ nama: 'Ketel 1', aktif: false }).galat));
// hanya satu alat aktif: alat terisi otomatis walau karyawan tidak punya alat bawaan
r = absen(PIN, 'k1', '2026-10-14', [{ nama: 'Joko', pekerjaan: '2x suling' }]);
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(barisAH().filter(x => x[3] === 'Joko')[0][6], 'Ketel 1');
console.log('Uji kelola karyawan & alat lulus.');

// ------------------------------------------------------------------ 11. Tampilan
r = L({ aksi: 'tampilanSimpan', pin: PIN, tampilan: { warna: 'merah' } });
assert.strictEqual(r.ok, false);
const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
r = L({ aksi: 'tampilanSimpan', pin: PIN, tampilan: { namaUsaha: 'Sembada', warna: '#2F6497', logo: LOGO, menuBeranda: ['Absensi', 'Kas'], kartuRingkasan: ['penjualan', 'laba'] } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
r = L({ aksi: 'config', pin: '1111', klien: 2 });
assert.strictEqual(r.tampilan.warna, '#2F6497'); assert.deepStrictEqual(J(r.tampilan.menuBeranda), ['Absensi', 'Kas']);
assert.ok(r.tampilan.logoTanda); assert.strictEqual(r.tampilan.logo, undefined, 'logo tidak ikut config');
r = L({ aksi: 'logo', pin: '1111' });
assert.strictEqual(r.logo, LOGO);
assert.ok(/tidak valid/.test(L({ aksi: 'tampilanSimpan', pin: PIN, tampilan: { logo: 'javascript:alert(1)' } }).galat));
assert.strictEqual(L({ aksi: 'tampilanSimpan', pin: '1111', tampilan: { warna: '#000000' } }).ok, false);
console.log('Uji tampilan lulus.');

// ------------------------------------------------------------------ 12. Pertanyaan formulir
const formSimpan = (tab, bidang) => L({ aksi: 'formulirSimpan', pin: PIN, tab, bidang });
assert.ok(/tidak bisa diatur/.test(formSimpan('Absensi', []).galat));
assert.ok(/tidak ada di tab/.test(formSimpan('Kas', [{ kolom: 'Bukan kolom', asal: 'Bawaan' }]).galat));
assert.ok(/minimal 2 pilihan/.test(formSimpan('Kas', [{ kolom: 'Metode', asal: 'Tambahan', jenis: 'pilih', pilihan: ['Tunai'] }]).galat));
assert.ok(/sudah dipakai kolom rumus/.test(formSimpan('Kas', [{ kolom: 'Arah', asal: 'Tambahan', jenis: 'teks' }]).galat));
r = formSimpan('Kas', [
  { kolom: 'Kategori', asal: 'Bawaan', label: 'Jenis pengeluaran', urutan: 10 },
  { kolom: 'Keterangan', asal: 'Bawaan', tampil: false, urutan: 20 },
  { kolom: 'Metode bayar', asal: 'Tambahan', jenis: 'pilih', pilihan: ['Tunai', 'Transfer'], wajib: true, urutan: 15 }]);
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.deepStrictEqual(J(r.kolomBaru), ['Metode bayar']);
assert.deepStrictEqual(kas.data[0], ['Hari', 'Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Metode bayar', 'Kelompok', 'Arah'],
  'kolom baru sebelum kolom rumus');
r = L({ aksi: 'config', pin: PIN, klien: 2 });
assert.ok(r.kepala.Kas.includes('Metode bayar'));
assert.strictEqual(r.formulir.Kas.length, 3);
const fMetode = r.formulir.Kas.filter(x => x.kolom === 'Metode bayar')[0];
assert.deepStrictEqual(J(fMetode.pilihan), ['Tunai', 'Transfer']); assert.strictEqual(fMetode.wajib, true); assert.strictEqual(fMetode.jenis, 'pilih');
assert.strictEqual(r.formulir.Kas.filter(x => x.kolom === 'Keterangan')[0].tampil, false);
r = L({ aksi: 'simpan', pin: PIN, tab: 'Kas', id: 'f1', nilai: { 'Tanggal': '2026-10-21', 'Kategori': 'Proyek bangunan', 'Jumlah (Rp)': 1000, 'Metode bayar': 'Transfer' } });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(kas.data[1][6], 'Transfer');
// disimpan lagi: kolom tidak dibuat dua kali
r = formSimpan('Kas', [{ kolom: 'Metode bayar', asal: 'Tambahan', jenis: 'pilih', pilihan: ['Tunai', 'Transfer', 'QRIS'], urutan: 15 }]);
assert.strictEqual(r.ok, true); assert.strictEqual(r.kolomBaru.length, 0); assert.strictEqual(kas.data[0].filter(x => x === 'Metode bayar').length, 1);
assert.strictEqual(sheets['Formulir'].data.filter(x => x[0] === 'Kas').length, 1, 'baris lama tab itu diganti');
console.log('Uji pertanyaan formulir lulus.');

// ------------------------------------------------------------------ 13. Ringkasan: upah per orang (tanpa nol) dan sulingan per alat
const kepalaRek = new Array(28).fill(''); kepalaRek[0] = 'Minggu mulai'; kepalaRek[21] = 'Upah kerja harian & lain (Rp)';
kepalaRek[22] = 'Upah Rofik (Rp)'; kepalaRek[23] = 'Upah Pak Muh (Rp)'; kepalaRek[24] = 'Upah Eko & Pak Gatot (Rp)';
const rekM = buatSheet('Rekap Mingguan', [[], [], [], kepalaRek]);
for (let i = 0; i < 4; i++) { const x = new Array(28).fill(0); x[0] = tgl('2026-09-28'); x[0] = new Date(x[0].getTime() + 7 * i * 86400000); x[1] = new Date(x[0].getTime() + 6 * 86400000); x[19] = 1000 * (i + 1); x[22] = 76000 * (i + 1); x[23] = 115000; x[24] = 0; rekM.data.push(x); }
const rekB = buatSheet('Rekap Bulanan', [[], [], [], ['Bulan']]);
for (let i = 0; i < 2; i++) { const x = new Array(31).fill(0); x[0] = new Date(2026, 8 + i, 1); x[19] = 5000 * (i + 1); x[30] = -7; rekB.data.push(x); }
const dash = buatSheet('Dashboard', Array.from({ length: 30 }, () => []));
dash.data[1][1] = '21/10/2026'; dash.data[4][13] = 8; dash.data[5][13] = 7; dash.data[7][13] = 6;
dash.data[14] = ['Hari ketel kosong', '', '3 hari', '2 hari', 'PERHATIAN', 'Atur jadwal'];
sheets['Rekap Mingguan'] = rekM; sheets['Rekap Bulanan'] = rekB; sheets['Dashboard'] = dash;
r = L({ aksi: 'ringkasan', pin: PIN });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(r.semuaMinggu.length, 4); assert.strictEqual(r.semuaMinggu[0].penjualan, 4000);
assert.deepStrictEqual(J(r.semuaMinggu[0].upahOrang), [{ nama: 'Rofik', upah: 304000 }, { nama: 'Pak Muh', upah: 115000 }], 'upah nol tidak ditampilkan');
const m19 = r.semuaMinggu[0];   // 19/10/2026
assert.strictEqual(m19.mulai, '19/10/2026');
assert.deepStrictEqual(J(m19.alat).map(a => a.nama + ':' + a.sulingan), ['Ketel 1:2', 'Ketel 2:3'], JSON.stringify(m19.alat));
assert.deepStrictEqual(J(m19.alat[0].operator), [{ nama: 'Eko & Pak Gatot', sulingan: 2 }]);
const m12 = r.semuaMinggu[1];   // 12/10/2026: Joko 2x (14 Okt) + Eko 2x (15 Okt)
assert.deepStrictEqual(J(m12.alat), [{ nama: 'Ketel 1', sulingan: 4, operator: [{ nama: 'Joko', sulingan: 2 }, { nama: 'Eko & Pak Gatot', sulingan: 2 }] }]);
assert.strictEqual(L({ aksi: 'ringkasan', pin: '1111' }).ok, false);
console.log('Uji ringkasan lulus.');

// ------------------------------------------------------------------ 14. Cadangan: tanpa tab Pengguna memakai PIN lama di Pengaturan
const lain = muat({ Pengaturan: buatSheet('Pengaturan', Array.from({ length: 30 }, () => [])), Karyawan: karyawan, 'Tarif Upah': tarif });
lain.sheets.Pengaturan.data[19] = ['Pemilik', '123456', 'Semua'];
lain.sheets.Pengaturan.data[20] = ['Pengumpul', '8888', 'Ambil Bahan', '', 'Pengumpul'];
r = lain.ctx.layani_(lain.ss, { aksi: 'masuk', pin: '8888' });
assert.deepStrictEqual(J(r.tab), ['Ambil Bahan', 'Absensi']); assert.strictEqual(r.kelompokAbsensi, 'Pengumpul');
assert.strictEqual(lain.ctx.layani_(lain.ss, { aksi: 'masuk', pin: '123456' }).semua, true);
r = lain.ctx.layani_(lain.ss, { aksi: 'pinDaftar', pin: '123456' });
assert.strictEqual(r.daftar.length, 2);

// ------------------------------------------------------------------ 15. Kunci setelah terlalu banyak PIN salah, JSON rusak
for (let i = 0; i < 40; i++) L({ aksi: 'masuk', pin: 'x' + i });
assert.strictEqual(L({ aksi: 'masuk', pin: PIN }).kode, 'KUNCI');
assert.strictEqual(JSON.parse(ctx.doPost({ postData: { contents: '{rusak' } })).ok, false);
console.log('Semua uji api.gs versi 6 lulus.');
