// Uji tampilan versi 2 (API versi 6): absensi per orang, kelola pengguna/karyawan/alat, tampilan, pertanyaan formulir.
// Jalankan server dulu: cd docs && python3 -m http.server 8123
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const OUT = '/tmp/sembada-shot6';
fs.mkdirSync(OUT, { recursive: true });
const API = 'https://script.google.com/macros/s/TES/exec';
const tglHariIni = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); };
const isoHariIni = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

const SEMUA = ['Ambil Bahan', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
const KEPALA_AH = ['Timestamp', 'Tanggal', 'Nama', 'Tim', 'Pekerjaan', 'Alat', 'Jumlah sulingan', 'Upah (Rp)', 'Pos upah', 'Pekerjaan lain', 'Kerja lain untuk', 'Keterangan', 'Diisi oleh'];
const KEPALA = {
  'Ambil Bahan': ['Timestamp', 'Tanggal', 'Pengumpul', 'Daerah', 'Kondisi bahan', 'Berat bahan (kg)', 'Uang dibawa (Rp)', 'Uang sisa (Rp)', 'Biaya lain di jalan (Rp)', 'Keterangan biaya lain', 'Keterangan'],
  'Saring Minyak': ['Timestamp', 'Tanggal saring', 'Jumlah sulingan yang disaring', 'Minyak (kg)', 'Hidrosol diambil (liter)', 'Kondisi bahan', 'Kondisi alat', 'Stok minyak di gudang (kg)', 'Keterangan'],
  'Absensi': KEPALA_AH,
  'Penjualan': ['Timestamp', 'Tanggal', 'Pembeli', 'Produk', 'Jumlah', 'Harga satuan (Rp)', 'Status bayar', 'Pengiriman', 'Keterangan'],
  'Kas': ['Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan']
};
const DAFTAR = {
  'Pengumpul': ['Rofik', 'Pak Muh', 'Mas Romadi'], 'Daerah': ['Aryojeding', 'Pelang'], 'Kondisi bahan': ['Segar semua', 'Agak kering semua'],
  'Kondisi alat': ['Normal', 'Ketel bocor'], 'Pembeli': ['Lusiani'], 'Produk': ['Minyak jeruk purut (campur)'], 'Status bayar': ['Lunas', 'Belum dibayar'],
  'Kategori kas': ['Bensin & servis pikap', 'Proyek bangunan'], 'Kerja lain untuk': ['Perawatan alat suling', 'Proyek bangunan & lainnya']
};
const TARIF = [
  { pilihan: 'Libur', untuk: 'Semua', upah: 0, jenis: 'Libur', sulingan: 0 },
  { pilihan: '1 trip', untuk: 'Pengumpul', upah: 76000, jenis: 'Pengumpulan', sulingan: 0 },
  { pilihan: '2 trip', untuk: 'Pengumpul', upah: 126000, jenis: 'Pengumpulan', sulingan: 0 },
  { pilihan: 'Harian kenek', untuk: 'Pengumpul', upah: 100000, jenis: 'Kerja harian', sulingan: 0 },
  { pilihan: '1x suling', untuk: 'Tim suling', upah: 90000, jenis: 'Penyulingan', sulingan: 1 },
  { pilihan: '2x suling', untuk: 'Tim suling', upah: 180000, jenis: 'Penyulingan', sulingan: 2 },
  { pilihan: 'Harian 2 orang', untuk: 'Tim suling', upah: 200000, jenis: 'Kerja harian', sulingan: 0 },
  { pilihan: 'Kerja lain', untuk: 'Semua', upah: 0, jenis: 'Kerja lain', sulingan: 0 }
];
const keadaan = {
  karyawan: [{ nama: 'Rofik', tim: 'Pengumpul', alat: '', aktif: true }, { nama: 'Pak Muh', tim: 'Pengumpul', alat: '', aktif: true },
    { nama: 'Mas Romadi', tim: 'Pengumpul', alat: '', aktif: true }, { nama: 'Eko & Pak Gatot', tim: 'Tim suling', alat: 'Ketel 1', aktif: true },
    { nama: 'Lama', tim: 'Pengumpul', alat: '', aktif: false }],
  alat: [{ nama: 'Ketel 1', aktif: true }, { nama: 'Ketel 2', aktif: true }],
  tampilan: { namaUsaha: 'Sembada Karya Wangi', namaAplikasi: 'Catatan Sembada', warna: '', menuBeranda: null, kartuRingkasan: null, kartuBeranda: null, logoTanda: '' },
  logo: '',
  formulir: {},
  pengguna: [
    { baris: 2, nama: 'Mas Wildan', pin: '846556', peran: 'Pemilik', boleh: 'Semua', absenUntuk: '', aktif: true, catatan: '' },
    { baris: 3, nama: 'Rofik', pin: '5420', peran: 'Pekerja', boleh: 'Ambil Bahan', absenUntuk: 'Rofik', aktif: true, catatan: '' },
    { baris: 4, nama: 'Eko', pin: '9937', peran: 'Pekerja', boleh: '', absenUntuk: 'Eko & Pak Gatot', aktif: true, catatan: '' },
    { baris: 5, nama: 'Pak Mandor', pin: '7777', peran: 'Mandor', boleh: 'Kas', absenUntuk: '', aktif: true, catatan: '' }]
};
const AKSES = {
  '846556': { nama: 'Mas Wildan', peran: 'Pemilik', tab: SEMUA, semua: true, mandor: false, jobdeskSaja: false, absenUntuk: null },
  '5420': { nama: 'Rofik', peran: 'Pekerja', tab: ['Ambil Bahan', 'Absensi'], semua: false, mandor: false, jobdeskSaja: true, absenUntuk: ['Rofik'] },
  '9937': { nama: 'Eko', peran: 'Pekerja', tab: ['Absensi'], semua: false, mandor: false, jobdeskSaja: true, absenUntuk: ['Eko & Pak Gatot'] },
  '7777': { nama: 'Pak Mandor', peran: 'Mandor', tab: ['Absensi', 'Kas'], semua: false, mandor: true, jobdeskSaja: false, absenUntuk: null }
};
const terima = [], atur = [], dialog = [];
let absensiTercatat = [];   // baris Absensi Harian hari ini (tampilan)

async function pasangMock(page) {
  await page.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `window.SEMBADA_CONFIG={API_URL:'${API}',VERSI:'tes'};` }));
  await page.route(API + '**', async route => {
    const req = JSON.parse(route.request().postData() || '{}');
    const a = AKSES[req.pin];
    let body;
    if (!a) body = { ok: false, kode: 'PIN', galat: 'PIN salah.' };
    else if (req.aksi === 'masuk') body = Object.assign({ ok: true, versiApi: 6 }, a);
    else if (req.aksi === 'config') {
      const kepala = {}; a.tab.forEach(t => kepala[t] = KEPALA[t]);
      body = Object.assign({ ok: true, versiApi: 6, daftar: DAFTAR, tarif: TARIF, kepala, satuanProduk: {}, arahKas: { 'Proyek bangunan': 'Keluar' },
        karyawan: keadaan.karyawan, alat: keadaan.alat, tim: ['Pengumpul', 'Tim suling'], tampilan: keadaan.tampilan, formulir: keadaan.formulir }, a);
    } else if (req.aksi === 'simpan') { terima.push(req); body = { ok: true }; }
    else if (req.aksi === 'logo') body = { ok: true, logo: keadaan.logo, tanda: keadaan.tampilan.logoTanda };
    else if (req.aksi === 'terbaru' && req.tab === 'Absensi') {
      const baris = absensiTercatat.concat([['Senin', '20/10/2026 17:00', '20/10/2026', 'Rofik', 'Pengumpul', '1 trip', '', '0', 'Rp76,000', 'Pengumpulan', '', '', '', 'Rofik']]);
      body = { ok: true, tab: 'Absensi', kepala: ['Hari'].concat(KEPALA_AH), baris };
      if (a.semua) body.data = baris.map((b, i) => ({ nomor: i + 2, tanda: 'T' + i, nilai: { 'Tanggal': '2026-10-20', 'Nama': b[3], 'Tim': b[4], 'Pekerjaan': b[5], 'Alat': b[6], 'Upah (Rp)': 76000, 'Pekerjaan lain': '', 'Kerja lain untuk': '', 'Keterangan': '' } }));
    } else if (req.aksi === 'terbaru') body = { ok: true, tab: req.tab, kepala: ['Hari'].concat(KEPALA[req.tab]), baris: [] };
    else if (req.aksi === 'ringkasan') body = { ok: true, dataSampai: '21/10/2026',
      semuaMinggu: [{ mulai: '19/10/2026', sampai: '25/10/2026', penjualan: 1000000, laba: 200000, minyak: 3.2, terjual: 0, bahanKg: 1323, hargaBahan: 378,
        biayaPerKg: null, upahPengumpul: 228000, upahPenyuling: 180000, upahHarian: 100000, sulingan: 2, sulinganDisaring: 2, ketelKosong: 1,
        upahOrang: [{ nama: 'Rofik', upah: 176000 }, { nama: 'Eko & Pak Gatot', upah: 180000 }],
        alat: [{ nama: 'Ketel 1', sulingan: 2, operator: [{ nama: 'Eko & Pak Gatot', sulingan: 2 }] }, { nama: 'Ketel 2', sulingan: 3, operator: [{ nama: 'Joko', sulingan: 2 }, { nama: 'Eko & Pak Gatot', sulingan: 1 }] }] },
        { mulai: '12/10/2026', sampai: '18/10/2026', penjualan: 500000, laba: -150000, minyak: 0, terjual: 0, upahOrang: [], alat: [] }],
      semuaBulan: [{ bulan: '10/2026', penjualan: 21204000, laba: 16978000, cicilan: 3700000, keluarga: 4838700, proyekBahan: 9047000, upahHarian: 4410000, perubahanKas: 4662300 }],
      peringatan: [{ hal: 'Hari ketel kosong minggu berjalan', nilai: '3 hari', batas: '2 hari', status: 'PERHATIAN', saran: 'Atur jadwal.' }] };
    else if (/Simpan|Hapus$/.test(req.aksi) || req.aksi === 'ubah') {
      if (!a.semua) body = { ok: false, galat: 'Hanya pemilik.' };
      else {
        atur.push(req); body = { ok: true };
        if (req.aksi === 'tampilanSimpan') {
          Object.assign(keadaan.tampilan, req.tampilan);
          if (req.tampilan.logo !== undefined) { keadaan.logo = req.tampilan.logo; keadaan.tampilan.logoTanda = req.tampilan.logo ? 'L' + req.tampilan.logo.length : ''; }
          delete keadaan.tampilan.logo;
        }
        if (req.aksi === 'formulirSimpan') {
          keadaan.formulir[req.tab] = req.bidang.map(b => Object.assign({ wajib: false, pilihan: [], tampil: true }, b));
          req.bidang.filter(b => b.asal === 'Tambahan' && !KEPALA[req.tab].includes(b.kolom)).forEach(b => KEPALA[req.tab].push(b.kolom));
          body.kolomBaru = req.bidang.filter(b => b.asal === 'Tambahan').map(b => b.kolom);
        }
        if (req.aksi === 'karyawanSimpan') {
          const k = req.karyawan, ada = keadaan.karyawan.find(x => x.nama === k.nama);
          if (ada) Object.assign(ada, { tim: k.tim, alat: k.alat, aktif: k.aktif !== false }); else keadaan.karyawan.push({ nama: k.nama, tim: k.tim, alat: k.alat, aktif: true });
        }
        if (req.aksi === 'alatSimpan') {
          const x = keadaan.alat.find(y => y.nama === req.alat.nama);
          if (x) x.aktif = req.alat.aktif !== false; else keadaan.alat.push({ nama: req.alat.nama, aktif: true });
        }
        if (req.aksi === 'penggunaSimpan') {
          const p = req.pengguna;
          if (p.baris) Object.assign(keadaan.pengguna.find(x => x.baris === p.baris), { nama: p.nama, pin: p.pin, peran: p.peran });
          else keadaan.pengguna.push({ baris: 9, nama: p.nama, pin: p.pin, peran: p.peran, boleh: p.boleh.join(', '), absenUntuk: p.absenUntuk.join(', '), aktif: true, catatan: '' });
        }
        if (req.aksi === 'penggunaHapus') keadaan.pengguna = keadaan.pengguna.filter(x => x.baris !== req.baris);
      }
    } else if (req.aksi === 'penggunaDaftar') body = a.semua ? { ok: true, pengguna: keadaan.pengguna.map(u => Object.assign({ saya: u.pin === req.pin }, u)) } : { ok: false, galat: 'x' };
    else body = { ok: false, galat: 'aksi? ' + req.aksi };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'id-ID' });
  const page = await ctx.newPage();
  const galat = [];
  page.on('pageerror', e => galat.push(e.message));
  page.on('dialog', d => { dialog.push(d.message()); d.accept(); });
  await pasangMock(page);
  const chip = (h, nilai) => page.locator(`.bidang[data-h="${h}"] label.chip`, { hasText: nilai }).first().click();
  const masuk = async pin => {
    await page.goto('http://localhost:8123/#/');
    await page.evaluate(() => { localStorage.removeItem('sembada.sesi'); });
    await page.reload();
    await page.fill('#pin', pin); await page.click('button[type=submit]');
    await page.waitForSelector('.grid-catatan');
  };
  const kirimForm = async () => {
    await page.click('#tombol-simpan');
    await page.waitForSelector('.lembar');
    await page.click('[data-aksi=kirim]');
    await page.waitForFunction(() => document.querySelector('.status.aman'));
  };

  // 1. Rofik: hanya dirinya, hanya pekerjaan rutin
  await masuk('5420');
  assert.strictEqual(await page.locator('.tombol-catatan').count(), 2);
  assert.ok((await page.textContent('a[href="#/isi/absensi"]')).includes('Absensi Rofik'));
  await page.click('a[href="#/isi/absensi"]');
  await page.waitForSelector('#formulir');
  assert.ok((await page.textContent('h1')).includes('Absensi Rofik'));
  assert.strictEqual(await page.locator('.baris-kisi').count(), 1);
  assert.deepStrictEqual(await page.locator('.bidang[data-h="P|Rofik"] .chip span').allTextContents(), ['Libur', '1 trip', '2 trip']);
  assert.strictEqual(await page.locator('.tombol-kl').count(), 0, 'pekerja tidak bisa isi kerja lain');
  await chip('P|Rofik', '1 trip');
  assert.ok((await page.textContent('#pratinjau')).includes('76.000'));
  await page.screenshot({ path: OUT + '/01-rofik.png', fullPage: true });
  await kirimForm();
  let s = terima.pop();
  assert.deepStrictEqual(s.nilai, { 'Tanggal': isoHariIni(), 'Keterangan': '', baris: [{ nama: 'Rofik', pekerjaan: '1 trip', alat: '' }] });
  assert.strictEqual(s.klien, 2);

  // 2. Eko: dua alat aktif, alat bawaan terpilih; bentrok ditolak
  await masuk('9937');
  await page.click('a[href="#/isi/absensi"]');
  await page.waitForSelector('#formulir');
  assert.strictEqual(await page.locator('.bidang[data-h="A|Eko & Pak Gatot"]').isVisible(), false, 'alat muncul setelah pilih sulingan');
  await chip('P|Eko & Pak Gatot', '2x suling');
  assert.strictEqual(await page.locator('.bidang[data-h="A|Eko & Pak Gatot"]').isVisible(), true);
  assert.strictEqual(await page.locator('.bidang[data-h="A|Eko & Pak Gatot"] input:checked').getAttribute('value'), 'Ketel 1');
  absensiTercatat = [['Rabu', tglHariIni() + ' 07:00', tglHariIni(), 'Eko & Pak Gatot', 'Tim suling', '1x suling', 'Ketel 1', '1', 'Rp90,000', 'Penyulingan', '', '', '', 'Eko']];
  const sebelum = dialog.length;
  await page.click('#tombol-simpan');
  await page.waitForFunction(() => !document.getElementById('tombol-simpan').disabled);
  assert.ok(dialog.length === sebelum + 1 && /Eko & Pak Gatot sudah tercatat "1x suling"/.test(dialog[dialog.length - 1]), 'bentrok: ' + dialog.slice(-1));
  assert.strictEqual(await page.locator('.lembar').count(), 0);
  absensiTercatat = [];
  await chip('A|Eko & Pak Gatot', 'Ketel 2');
  await page.screenshot({ path: OUT + '/02-eko.png', fullPage: true });
  await kirimForm();
  s = terima.pop();
  assert.deepStrictEqual(s.nilai.baris, [{ nama: 'Eko & Pak Gatot', pekerjaan: '2x suling', alat: 'Ketel 2' }]);

  // 3. Mandor: semua karyawan aktif, Tidak diisi, kerja lain per orang
  await masuk('7777');
  assert.ok((await page.textContent('a[href="#/isi/absensi"]')).includes('Kerja harian dan kerja lain'));
  await page.click('a[href="#/isi/absensi"]');
  await page.waitForSelector('#formulir');
  assert.strictEqual(await page.locator('.baris-kisi').count(), 4, 'karyawan nonaktif tidak muncul');
  assert.strictEqual(await page.locator('.chip.lewati input:checked').count(), 4);
  assert.ok((await page.locator('.bidang[data-h="P|Pak Muh"] .chip span').allTextContents()).includes('Harian kenek'));
  await chip('P|Pak Muh', 'Harian kenek');
  await chip('K|Rofik', 'Kerja lain');
  assert.strictEqual(await page.locator('.bidang[data-h="KU|Rofik"]').isVisible(), true);
  await page.click('#tombol-simpan');
  assert.ok((await page.textContent('.bidang.salah')).includes('upah'), 'upah kerja lain wajib');
  await page.fill('.bidang[data-h="KU|Rofik"] input', '50000');
  await page.fill('.bidang[data-h="KP|Rofik"] input', 'tambal kolam');
  await chip('KK|Rofik', 'Perawatan alat suling');
  assert.ok((await page.textContent('#pratinjau')).includes('150.000'), await page.textContent('#pratinjau'));
  await page.screenshot({ path: OUT + '/03-mandor.png', fullPage: true });
  await page.click('#tombol-simpan');
  await page.waitForSelector('.lembar');
  const ringkas = await page.textContent('.lembar');
  assert.ok(/Pak Muh.*Harian kenek/.test(ringkas) && /Upah kerja lain Rofik/.test(ringkas), ringkas);
  await page.click('[data-aksi=kirim]');
  await page.waitForFunction(() => document.querySelector('.status.aman'));
  s = terima.pop();
  assert.deepStrictEqual(s.nilai.baris, [
    { nama: 'Rofik', pekerjaan: 'Kerja lain', upah: 50000, pekerjaanLain: 'tambal kolam', kerjaLainUntuk: 'Perawatan alat suling' },
    { nama: 'Pak Muh', pekerjaan: 'Harian kenek', alat: '' }]);
  await page.click('a[href="#/akun"]'); await page.waitForSelector('#keluar');
  assert.strictEqual(await page.locator('.menu-atur').count(), 0, 'mandor tidak punya menu pengaturan');
  console.log('Absensi per orang lulus.');

  // 4. Pemilik: menu pengaturan
  await masuk('846556');
  await page.click('a[href="#/akun"]'); await page.waitForSelector('#keluar');
  assert.strictEqual(await page.locator('.menu-atur .baris-menu').count(), 5);
  await page.screenshot({ path: OUT + '/04-akun.png', fullPage: true });

  // 4a. Pengguna
  await page.click('[data-ke="#/pengguna"]');
  await page.waitForSelector('.kartu.pengguna');
  assert.strictEqual(await page.locator('.kartu.pengguna').count(), 4);
  await page.screenshot({ path: OUT + '/05-pengguna.png', fullPage: true });
  await page.click('#tambah-pengguna');
  await page.fill('#form-pengguna [name=nama]', 'Pak Muh');
  await page.fill('#form-pengguna [name=pin]', '2468');
  await page.locator('#b-absen label.chip', { hasText: 'Pak Muh' }).click();
  await page.locator('#b-boleh label.chip', { hasText: 'Ambil Bahan' }).click();
  await page.screenshot({ path: OUT + '/06-tambah-pengguna.png', fullPage: true });
  await page.click('#simpan-pengguna');
  await page.waitForFunction(() => document.querySelectorAll('.kartu.pengguna').length === 5);
  let x = atur.pop();
  assert.strictEqual(x.aksi, 'penggunaSimpan');
  assert.deepStrictEqual(x.pengguna, { nama: 'Pak Muh', pin: '2468', peran: 'Pekerja', boleh: ['Ambil Bahan'], absenUntuk: ['Pak Muh'], aktif: true, catatan: '' });
  await page.click('[data-hapus="4"]');
  await page.click('[data-aksi=ya]');
  await page.waitForFunction(() => document.querySelectorAll('.kartu.pengguna').length === 4);
  x = atur.pop(); assert.strictEqual(x.aksi, 'penggunaHapus'); assert.strictEqual(x.nama, 'Pak Muh');

  // 4b. Karyawan
  await page.goto('http://localhost:8123/#/karyawan');
  await page.waitForSelector('#tambah-karyawan');
  assert.ok((await page.textContent('.isi')).includes('Nonaktif'));
  await page.click('#tambah-karyawan');
  await page.fill('#form-karyawan [name=nama]', 'Joko');
  await page.locator('#form-karyawan label.chip', { hasText: 'Tim suling' }).click();
  await page.locator('#form-karyawan label.chip', { hasText: 'Ketel 2' }).click();
  await page.click('#simpan-karyawan');
  await page.waitForFunction(() => document.body.textContent.includes('Joko'));
  x = atur.pop();
  assert.deepStrictEqual(x.karyawan, { baru: true, nama: 'Joko', tim: 'Tim suling', alat: 'Ketel 2', aktif: true });
  await page.click('[data-aktif="Mas Romadi"]');
  await page.click('[data-aksi=ya]');
  await page.waitForFunction(() => /2 nonaktif/.test(document.querySelector('.kepala').textContent));
  x = atur.pop(); assert.strictEqual(x.karyawan.aktif, false); assert.strictEqual(x.karyawan.nama, 'Mas Romadi');
  await page.screenshot({ path: OUT + '/07-karyawan.png', fullPage: true });

  // 4c. Alat
  await page.goto('http://localhost:8123/#/alat');
  await page.waitForSelector('#form-alat');
  await page.fill('#form-alat [name=nama]', 'Ketel 3');
  await page.click('#form-alat button');
  await page.waitForFunction(() => document.body.textContent.includes('Ketel 3'));
  x = atur.pop(); assert.deepStrictEqual(x.alat, { baru: true, nama: 'Ketel 3' });
  await page.screenshot({ path: OUT + '/08-alat.png', fullPage: true });
  console.log('Kelola pengguna, karyawan, alat lulus.');

  // 5. Tampilan: nama, warna, logo, urutan tombol, kartu
  await page.goto('http://localhost:8123/#/tampilan');
  await page.waitForSelector('#form-tampilan');
  await page.fill('[name=namaAplikasi]', 'Catatan Kebun');
  await page.locator('label.chip.warna', { hasText: 'Biru' }).click();
  const hijau = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--hijau').trim());
  assert.ok(/^#2/.test(hijau) && hijau.toLowerCase() !== '#2d7c5b', 'pratinjau warna: ' + hijau);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9Qz0AEYBxVSF8AAEaYB/3FmPgXAAAAAElFTkSuQmCC', 'base64');
  await page.setInputFiles('#file-logo', { name: 'logo.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => document.querySelector('.pratinjau-logo').src.startsWith('data:image/'));
  // Kas disembunyikan dari Beranda, Absensi dinaikkan ke paling atas
  await page.locator('#urut-menu li[data-id="Kas"] input').uncheck();
  await page.click('#urut-menu li[data-id="Absensi"] [data-naik]');
  await page.click('#urut-menu li[data-id="Absensi"] [data-naik]');
  await page.locator('#urut-ringkasan li[data-id="terjual"] input').uncheck();
  await page.locator('#urut-ringkasan li[data-id="b_cicilan"] input').uncheck();
  await page.screenshot({ path: OUT + '/09-tampilan.png', fullPage: true });
  await page.click('#simpan-tampilan');
  await page.waitForSelector('.menu-atur');
  x = atur.pop();
  assert.strictEqual(x.aksi, 'tampilanSimpan');
  assert.strictEqual(x.tampilan.namaAplikasi, 'Catatan Kebun'); assert.strictEqual(x.tampilan.warna, '#2F6497');
  assert.deepStrictEqual(x.tampilan.menuBeranda, ['Absensi', 'Ambil Bahan', 'Saring Minyak', 'Penjualan']);
  assert.ok(!x.tampilan.kartuRingkasan.includes('terjual') && x.tampilan.kartuRingkasan.includes('alat'));
  assert.ok(/^data:image\/(png|webp|jpeg);base64,/.test(x.tampilan.logo));
  await page.click('a[href="#/"]');
  await page.waitForSelector('.grid-catatan');
  assert.strictEqual(await page.title(), 'Catatan Kebun');
  assert.strictEqual(await page.textContent('.kepala h1 >> nth=0').then(t => t.startsWith('Catatan Kebun')), true);
  assert.deepStrictEqual(await page.locator('.tombol-catatan b').allTextContents(), ['Absensi', 'Ambil Bahan', 'Saring Minyak', 'Penjualan']);
  await page.screenshot({ path: OUT + '/10-beranda-baru.png', fullPage: true });
  // Ringkasan mengikuti kartu yang dipilih, dengan sulingan per alat
  await page.click('a[href="#/ringkasan"]');
  await page.waitForSelector('#pilih-bulan');
  const teksR = await page.textContent('.isi');
  assert.ok(!teksR.includes('Minyak terjual') && !teksR.includes('Cicilan kendaraan'), 'kartu disembunyikan');
  assert.ok(teksR.includes('Sulingan per alat') && teksR.includes('Ketel 2') && teksR.includes('Joko (2x)'), teksR);
  await page.screenshot({ path: OUT + '/11-ringkasan.png', fullPage: true });
  // logo ikut tampil di layar masuk setelah keluar
  await page.click('a[href="#/akun"]'); await page.click('#keluar');
  await page.waitForSelector('.layar-masuk');
  assert.ok((await page.getAttribute('.layar-masuk img.logo', 'src')).startsWith('data:image/'));
  assert.strictEqual(await page.textContent('.layar-masuk h1'), 'Catatan Kebun');
  console.log('Tampilan lulus.');

  // 6. Pertanyaan formulir: tambah pertanyaan di Kas, sembunyikan pertanyaan boleh-kosong di Penjualan
  await page.fill('#pin', '846556'); await page.click('button[type=submit]');
  await page.waitForSelector('.grid-catatan');
  await page.goto('http://localhost:8123/#/formulir');
  await page.waitForSelector('.menu-atur');
  await page.click('[data-ke="#/formulir/jual"]');
  await page.waitForSelector('.kartu.pertanyaan');
  const kartuKirim = page.locator('.kartu.pertanyaan', { hasText: 'Pengiriman' });
  await kartuKirim.locator('[data-tampil]').click();
  assert.strictEqual(await page.locator('.kartu.pertanyaan', { hasText: 'Pembeli' }).locator('.terkunci').count(), 1, 'pertanyaan wajib terkunci');
  await page.click('#simpan-formulir');
  await page.waitForSelector('.menu-atur');
  x = atur.pop();
  assert.strictEqual(x.tab, 'Penjualan'); assert.strictEqual(x.bidang.find(b => b.kolom === 'Pengiriman').tampil, false);
  await page.click('[data-ke="#/formulir/kas"]');
  await page.waitForSelector('.kartu.pertanyaan');
  await page.click('#tambah-pertanyaan');
  await page.fill('#form-tanya [name=label]', 'Metode bayar');
  await page.locator('#form-tanya label.chip', { hasText: 'Pilih satu' }).click();
  await page.fill('#form-tanya [name=pilihan]', 'Tunai\nTransfer');
  await page.locator('#form-tanya label.chip', { hasText: 'Wajib' }).first().click();
  await page.click('#ok-tanya');
  await page.click('.kartu.pertanyaan:has-text("Metode bayar") [data-naik]');
  await page.locator('.kartu.pertanyaan', { hasText: 'Kategori' }).locator('[data-ubah]').click();
  await page.fill('#form-tanya [name=label]', 'Jenis pengeluaran');
  await page.click('#ok-tanya');
  await page.screenshot({ path: OUT + '/12-formulir.png', fullPage: true });
  await page.click('#simpan-formulir');
  await page.waitForSelector('.menu-atur');
  x = atur.pop();
  assert.strictEqual(x.tab, 'Kas');
  const metode = x.bidang.find(b => b.kolom === 'Metode bayar');
  assert.deepStrictEqual([metode.asal, metode.jenis, metode.wajib, metode.pilihan.join('|')], ['Tambahan', 'pilih', true, 'Tunai|Transfer']);
  assert.strictEqual(x.bidang.find(b => b.kolom === 'Kategori').label, 'Jenis pengeluaran');
  assert.ok(x.bidang.findIndex(b => b.kolom === 'Metode bayar') < x.bidang.findIndex(b => b.kolom === 'Keterangan'));
  // formulir Kas sekarang punya pertanyaan baru, wajib diisi
  await page.goto('http://localhost:8123/#/isi/kas');
  await page.waitForSelector('#formulir');
  assert.ok((await page.textContent('#formulir')).includes('Jenis pengeluaran'));
  await page.selectOption('.bidang[data-h="Kategori"] select', 'Proyek bangunan');
  await page.fill('.bidang[data-h="Jumlah (Rp)"] input', '25000');
  await page.fill('.bidang[data-h="Keterangan"] input', 'semen');
  await page.click('#tombol-simpan');
  assert.ok((await page.textContent('.bidang.salah')).includes('Wajib'), 'pertanyaan tambahan wajib');
  await chip('Metode bayar', 'Transfer');
  await page.screenshot({ path: OUT + '/13-kas-baru.png', fullPage: true });
  await kirimForm();
  s = terima.pop();
  assert.strictEqual(s.nilai['Metode bayar'], 'Transfer');
  // Penjualan: Pengiriman tidak tampil lagi
  await page.goto('http://localhost:8123/#/isi/jual');
  await page.waitForSelector('#formulir');
  assert.strictEqual(await page.locator('.bidang[data-h="Pengiriman"]').count(), 0);
  console.log('Pertanyaan formulir lulus.');

  // 7. Riwayat absensi & ubah satu baris (pemilik)
  await page.goto('http://localhost:8123/#/terbaru/absensi');
  await page.waitForSelector('.entri [data-ubah-entri]');
  assert.ok((await page.textContent('.entri h3')).includes('20/10/2026 · Rofik'));
  await page.click('[data-ubah-entri="0"]');
  await page.waitForSelector('#formulir');
  assert.strictEqual(await page.inputValue('.bidang[data-h="Nama"] select'), 'Rofik');
  await chip('Pekerjaan', '2 trip');
  await page.screenshot({ path: OUT + '/14-ubah-absensi.png', fullPage: true });
  await page.click('#tombol-simpan'); await page.waitForSelector('.lembar'); await page.click('[data-aksi=kirim]');
  await page.waitForFunction(() => location.hash.indexOf('#/terbaru') === 0);
  x = atur.pop();
  assert.strictEqual(x.aksi, 'ubah'); assert.strictEqual(x.nilai['Pekerjaan'], '2 trip'); assert.strictEqual(x.nilai['Nama'], 'Rofik');
  assert.strictEqual(x.nilai['Upah (Rp)'], '', 'upah kerja lain kosong kalau bukan kerja lain');
  console.log('Riwayat & ubah absensi lulus.');

  // 8. Mode gelap dengan warna khusus
  const gelap = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
  const p2 = await gelap.newPage(); await pasangMock(p2);
  p2.on('pageerror', e => galat.push(e.message));
  await p2.goto('http://localhost:8123/');
  await p2.fill('#pin', '7777'); await p2.click('button[type=submit]');
  await p2.waitForSelector('.grid-catatan');
  await p2.click('a[href="#/isi/absensi"]'); await p2.waitForSelector('#formulir');
  await p2.locator('.bidang[data-h="K|Rofik"] label.chip').click();
  await p2.screenshot({ path: OUT + '/15-gelap.png', fullPage: true });

  assert.deepStrictEqual(galat, [], 'tidak ada galat JavaScript: ' + galat.join(' | '));
  await browser.close();
  console.log('Semua uji tampilan versi 2 lulus. Gambar di ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
