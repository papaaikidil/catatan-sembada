// Uji tampilan & alur aplikasi dengan API tiruan. Jalankan: node tes/ui_test.js  (butuh server statis di port 8123)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');

const API = 'https://script.google.com/macros/s/TES/exec';
const OUT = process.env.OUT || '/tmp/sembada-shot';
fs.mkdirSync(OUT, { recursive: true });

const KEPALA = {
  'Ambil Bahan': ['Timestamp', 'Tanggal', 'Pengumpul', 'Daerah', 'Kondisi bahan', 'Berat bahan (kg)', 'Uang dibawa (Rp)', 'Uang sisa (Rp)', 'Biaya lain di jalan (Rp)', 'Keterangan biaya lain', 'Keterangan'],
  'Saring Minyak': ['Timestamp', 'Tanggal saring', 'Jumlah sulingan yang disaring', 'Minyak (kg)', 'Hidrosol diambil (liter)', 'Kondisi bahan', 'Kondisi alat', 'Stok minyak di gudang (kg)', 'Keterangan'],
  'Absensi': ['Timestamp', 'Tanggal', 'Pengumpul [Rofik]', 'Pengumpul [Pak Muh]', 'Pengumpul [Mas Romadi]', 'Tim suling [Eko & Pak Gatot]', 'Keterangan', 'Ada kerja lain dengan upah khusus hari ini?', 'Pekerjaan lain', 'Kerja lain untuk', 'Upah kerja lain Rofik (Rp)', 'Upah kerja lain Pak Muh (Rp)', 'Upah kerja lain Mas Romadi (Rp)', 'Upah kerja lain Eko & Pak Gatot (Rp)'],
  'Penjualan': ['Timestamp', 'Tanggal', 'Pembeli', 'Produk', 'Jumlah', 'Harga satuan (Rp)', 'Status bayar', 'Pengiriman', 'Keterangan'],
  'Kas': ['Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan']
};
const SEMUA = Object.keys(KEPALA);
const DAFTAR = {
  'Pengumpul': ['Rofik', 'Pak Muh', 'Mas Romadi'], 'Tim suling': ['Eko & Pak Gatot'],
  'Daerah': ['Aryojeding', 'Banjarejo', 'Pelang', 'Tanen'],
  'Kondisi bahan': ['Segar semua', 'Cuma sedikit yang kering', 'Setengah bagian kering', 'Agak kering semua'],
  'Kondisi alat': ['Normal', 'Ketel bocor', 'Spiral bocor'], 'Pembeli': ['Lusiani', 'Bapak'],
  'Produk': ['Minyak jeruk purut (campur)', 'Hidrosol jeruk purut'], 'Status bayar': ['Lunas', 'Belum dibayar'],
  'Kategori kas': ['Bensin & servis pikap', 'Proyek bangunan', 'Keluarga & pribadi', 'Pinjaman masuk'],
  'Kerja lain untuk': ['Perawatan alat suling', 'Proyek bangunan & lainnya']
};
const TARIF = [
  { pilihan: 'Libur', untuk: 'Semua', upah: 0 }, { pilihan: '1 trip', untuk: 'Pengumpul', upah: 76000 },
  { pilihan: '2 trip', untuk: 'Pengumpul', upah: 126000 }, { pilihan: 'Harian kenek', untuk: 'Pengumpul', upah: 100000 },
  { pilihan: '2x suling', untuk: 'Tim suling', upah: 180000 }, { pilihan: 'Harian 1 orang', untuk: 'Tim suling', upah: 100000 },
  { pilihan: 'Kerja lain', untuk: 'Semua', upah: 0 }
];

let terima = [];
const kelola = [];   // ubah / hapus / pinUbah yang masuk          // simpan yang masuk
let jaringanMati = false;
let absensiHariIni = false;
const dialog = [];
const tglHariIni = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); };

async function pasangMock(page) {
  await page.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `window.SEMBADA_CONFIG={API_URL:'${API}',VERSI:'tes'};` }));
  await page.route(API + '**', async route => {
    if (jaringanMati) return route.abort('internetdisconnected');
    const req = JSON.parse(route.request().postData() || '{}');
    const akses = req.pin === '123456' ? { peran: 'Pemilik', tab: SEMUA, semua: true }
      : req.pin === '1111' ? { peran: 'Pengumpul', tab: ['Ambil Bahan'], semua: false }
      : req.pin === '6125' ? { peran: 'Tim suling', tab: ['Absensi'], semua: false } : null;
    let body;
    if (!akses) body = { ok: false, kode: 'PIN', galat: 'PIN salah.' };
    else if (req.aksi === 'masuk') body = Object.assign({ ok: true }, akses);
    else if (req.aksi === 'config') {
      const kepala = {}; akses.tab.forEach(t => kepala[t] = KEPALA[t]);
      body = Object.assign({ ok: true, versiApi: 2, daftar: DAFTAR, tarif: TARIF, kepala, satuanProduk: { 'Minyak jeruk purut (campur)': 'kg', 'Hidrosol jeruk purut': 'liter' },
        arahKas: { 'Proyek bangunan': 'Keluar', 'Pinjaman masuk': 'Masuk' } }, akses);
    } else if (req.aksi === 'simpan') { terima.push(req); body = { ok: true }; }
    else if (req.aksi === 'terbaru' && req.tab === 'Absensi') body = { ok: true, tab: 'Absensi',
      kepala: ['Hari', 'Timestamp', 'Tanggal', 'Pengumpul [Rofik]', 'Keterangan'],
      baris: [['Rabu', absensiHariIni ? tglHariIni() + ' 06:34' : '20/10/2026 08:00', absensiHariIni ? tglHariIni() : '20/10/2026', '1 trip', '']] };
    else if (req.aksi === 'terbaru') {
      body = { ok: true, tab: req.tab, kepala: ['Hari', 'Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Kelompok', 'Arah'],
        baris: [['Rabu', '21/10/2026 06:42', '21/10/2026', 'Proyek bangunan', 'Rp200,000', 'service disel dan beli bensin buat ngisi kolam', 'Proyek lain', 'Keluar']] };
      if (akses.semua) body.data = [{ nomor: 2, tanda: 'T1', nilai: { 'Tanggal': '2026-10-21', 'Kategori': 'Proyek bangunan', 'Jumlah (Rp)': 200000, 'Keterangan': 'service disel dan beli bensin buat ngisi kolam' } }];
    }
    else if (req.aksi === 'ubah' || req.aksi === 'hapus' || req.aksi === 'pinUbah') { kelola.push(req); body = akses.semua ? { ok: true } : { ok: false, galat: 'tidak boleh' }; }
    else if (req.aksi === 'pinDaftar') body = akses.semua ? { ok: true, daftar: [
      { baris: 20, peran: 'Pemilik', pin: '123456', boleh: 'Semua', saya: true },
      { baris: 21, peran: 'Pengumpul', pin: '1111', boleh: 'Ambil Bahan', saya: false },
      { baris: 22, peran: 'Tim suling', pin: '6125', boleh: 'Absensi', saya: false },
      { baris: 23, peran: 'Mandor', pin: '', boleh: 'Absensi', saya: false }] } : { ok: false, galat: 'tidak boleh' };
    else if (req.aksi === 'ringkasan') body = { ok: true, dataSampai: '21/10/2026',
      mingguBerjalan: { mulai: '19/10/2026', sampai: '25/10/2026', penjualan: 0, laba: -1230000, minyak: 0, terjual: 0, bahanKg: 3240, hargaBahan: 430, biayaPerKg: null, upahPengumpul: 228000, upahPenyuling: 0, upahHarian: 730000, sulingan: 0, ketelKosong: 3 },
      mingguPenuh: { mulai: '12/10/2026', sampai: '18/10/2026', penjualan: 0, laba: -150000, minyak: 0, terjual: 0, bahanKg: 0, hargaBahan: null, biayaPerKg: null, upahPengumpul: 0, upahPenyuling: 0, upahHarian: 2860000, sulingan: 0, ketelKosong: 6 },
      bulanIni: { bulan: '10/2026', penjualan: 21204000, laba: 16978000, cicilan: 3700000, keluarga: 4838700, proyekBahan: 9047000, upahHarian: 4410000, perubahanKas: 4662300 },
      semuaBulan: [{ bulan: '10/2026', penjualan: 21204000, laba: 16978000, cicilan: 3700000, keluarga: 4838700, proyekBahan: 9047000, upahHarian: 4410000, perubahanKas: 4662300 },
        { bulan: '09/2026', penjualan: 26954000, laba: 9831000, cicilan: 3632500, keluarga: 18043500, proyekBahan: 25000, upahHarian: 0, perubahanKas: -22513000 }],
      semuaMinggu: [
        { mulai: '19/10/2026', sampai: '25/10/2026', penjualan: 0, laba: -1230000, minyak: 0, terjual: 0, upahPengumpul: 228000, upahPenyuling: 0, upahHarian: 730000, ketelKosong: 3 },
        { mulai: '12/10/2026', sampai: '18/10/2026', penjualan: 0, laba: -150000, minyak: 0, terjual: 0, upahPengumpul: 0, upahPenyuling: 0, upahHarian: 2860000, ketelKosong: 6 },
        { mulai: '05/10/2026', sampai: '11/10/2026', penjualan: 11640000, laba: 6700000, minyak: 15.3, terjual: 19.4, upahPengumpul: 990000, upahPenyuling: 835000, upahHarian: 820000, ketelKosong: 1 },
        { mulai: '28/09/2026', sampai: '04/10/2026', penjualan: 9564000, laba: 7700000, minyak: 12.5, terjual: 15.94, upahPengumpul: 900000, upahPenyuling: 700000, upahHarian: 0, ketelKosong: 2 }],
      peringatan: [{ hal: 'Hari ketel kosong minggu berjalan', nilai: '3 hari', batas: '2 hari', status: 'PERHATIAN', saran: 'Atur jadwal supaya penyulingan tidak menunggu pekerjaan lain.' },
        { hal: 'Penjualan belum dibayar', nilai: 'Rp0', batas: 'Rp0', status: 'Aman', saran: '' }] };
    else body = { ok: false, galat: 'aksi?' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'id-ID' });
  const page = await ctx.newPage();
  const galatHalaman = [];
  page.on('pageerror', e => galatHalaman.push(e.message));
  page.on('dialog', d => { dialog.push(d.message()); d.accept(); });
  await pasangMock(page);
  await page.goto('http://localhost:8123/');

  // 1. Masuk
  await page.fill('#pin', '0000'); await page.click('button[type=submit]');
  await page.waitForSelector('.galat-kartu');
  assert.ok((await page.textContent('.galat-kartu')).includes('PIN salah'));
  await page.screenshot({ path: OUT + '/01-masuk.png' });
  await page.fill('#pin', '123456'); await page.click('button[type=submit]');
  await page.waitForSelector('.grid-catatan');
  await page.waitForSelector('#kotak-ringkas .kartu');
  assert.strictEqual(await page.locator('.tombol-catatan').count(), 5);
  await page.screenshot({ path: OUT + '/02-beranda.png', fullPage: true });
  // pilih minggu sebelumnya di beranda
  await page.selectOption('#pilih-minggu', '05/10/2026');
  await page.waitForFunction(() => document.querySelector('#kotak-ringkas').textContent.includes('11.640.000'));
  assert.ok((await page.textContent('#kotak-ringkas')).includes('▲ 22% dari minggu sebelumnya'), await page.textContent('#kotak-ringkas'));
  await page.screenshot({ path: OUT + '/17-pilih-minggu.png', fullPage: true });
  await page.selectOption('#pilih-minggu', '19/10/2026');

  // 2. Kas
  await page.click('a[href="#/isi/kas"]');
  await page.waitForSelector('#formulir');
  await page.click('#tombol-simpan');
  assert.ok(await page.locator('.bidang.salah').count() >= 2, 'wajib diisi muncul');
  await page.selectOption('select.masukan', 'Proyek bangunan');
  await page.fill('#formulir input[inputmode=numeric]', '200.000');
  await page.fill('#formulir input[type=text]:not([inputmode])', 'service disel');
  assert.ok((await page.textContent('#pratinjau')).includes('Uang keluar'));
  await page.screenshot({ path: OUT + '/03-kas.png', fullPage: true });
  await page.click('#tombol-simpan');
  await page.waitForSelector('.lembar');
  await page.screenshot({ path: OUT + '/04-periksa.png' });
  await page.click('[data-aksi=kirim]');
  await page.waitForFunction(() => document.querySelector('.status.aman'));
  const kas = terima.pop();
  assert.strictEqual(kas.tab, 'Kas');
  assert.strictEqual(kas.nilai['Jumlah (Rp)'], 200000);
  assert.strictEqual(kas.nilai['Kategori'], 'Proyek bangunan');
  assert.match(kas.nilai['Tanggal'], /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(kas.id);

  // 3. Absensi dengan kerja lain
  await page.click('a[href="#/isi/absensi"]');
  await page.waitForSelector('#formulir');
  const pilihChip = async (h, nilai) => {
    await page.locator(`.bidang[data-h="${h}"] label.chip`, { hasText: nilai }).first().click();
  };
  await pilihChip('Pengumpul [Rofik]', '1 trip');
  await pilihChip('Pengumpul [Pak Muh]', 'Kerja lain');
  await pilihChip('Pengumpul [Mas Romadi]', 'Harian kenek');
  await pilihChip('Tim suling [Eko & Pak Gatot]', 'Harian 1 orang');
  await pilihChip('Ada kerja lain dengan upah khusus hari ini?', 'Tidak');
  assert.strictEqual(await page.locator('.bidang[data-h="Pekerjaan lain"]').isVisible(), false);
  await page.click('#tombol-simpan');
  assert.ok((await page.textContent('.bidang.salah')).includes('Kerja lain'));
  await pilihChip('Ada kerja lain dengan upah khusus hari ini?', 'Ya');
  assert.strictEqual(await page.locator('.bidang[data-h="Pekerjaan lain"]').isVisible(), true);
  await page.fill('.bidang[data-h="Pekerjaan lain"] input', 'ngaci kolam');
  await pilihChip('Kerja lain untuk', 'Proyek bangunan');
  await page.fill('.bidang[data-h="Upah kerja lain Pak Muh (Rp)"] input', '115000');
  assert.ok((await page.textContent('#pratinjau')).includes('391.000'), await page.textContent('#pratinjau'));
  await page.screenshot({ path: OUT + '/05-absensi.png', fullPage: true });
  await page.click('#tombol-simpan'); await page.click('[data-aksi=kirim]');
  await page.waitForFunction(() => document.querySelector('.status.aman'));
  const abs = terima.pop();
  assert.strictEqual(abs.nilai['Pengumpul [Pak Muh]'], 'Kerja lain');
  assert.strictEqual(abs.nilai['Upah kerja lain Pak Muh (Rp)'], 115000);
  assert.strictEqual(abs.nilai['Ada kerja lain dengan upah khusus hari ini?'], 'Ya');
  assert.strictEqual(abs.nilai['Upah kerja lain Rofik (Rp)'], undefined);

  // 4. Ambil bahan: centang + lainnya + desimal
  await page.click('a[href="#/isi/ambil"]');
  await page.waitForSelector('#formulir');
  await pilihChip('Pengumpul', 'Rofik'); await pilihChip('Pengumpul', 'Mas Romadi');
  await pilihChip('Daerah', 'Pelang'); await pilihChip('Daerah', 'Lainnya');
  await page.fill('.bidang[data-h="Daerah"] .lainnya-teks', 'Kepuh');
  await pilihChip('Kondisi bahan', 'Segar semua');
  await page.fill('.bidang[data-h="Berat bahan (kg)"] input', '1.075,5');
  await page.fill('.bidang[data-h="Uang dibawa (Rp)"] input', '550000');
  await page.fill('.bidang[data-h="Uang sisa (Rp)"] input', '56000');
  await page.fill('.bidang[data-h="Biaya lain di jalan (Rp)"] input', '15000');
  assert.ok((await page.textContent('#pratinjau')).includes('479.000'));
  await page.screenshot({ path: OUT + '/06-ambil.png', fullPage: true });
  // keluar lalu kembali: draf harus tetap ada
  await page.click('.kepala [data-ke="#/"]');
  await page.click('a[href="#/isi/ambil"]');
  await page.waitForSelector('#formulir');
  assert.strictEqual(await page.inputValue('.bidang[data-h="Uang dibawa (Rp)"] input'), '550000', 'draf tersimpan');
  await page.click('#tombol-simpan'); await page.click('[data-aksi=kirim]');
  await page.waitForFunction(() => document.querySelector('.status.aman'));
  const ab = terima.pop();
  assert.deepStrictEqual(ab.nilai['Pengumpul'], ['Rofik', 'Mas Romadi']);
  assert.deepStrictEqual(ab.nilai['Daerah'], ['Pelang', 'Kepuh']);
  assert.strictEqual(ab.nilai['Berat bahan (kg)'], 1075.5);
  assert.strictEqual(ab.nilai['Biaya lain di jalan (Rp)'], 15000);

  // 5. Tanpa sinyal: tersimpan di HP lalu terkirim
  jaringanMati = true;
  await page.click('a[href="#/isi/kas"]');
  await page.waitForSelector('#formulir');
  await page.selectOption('select.masukan', 'Pinjaman masuk');
  await page.fill('#formulir input[inputmode=numeric]', '1000000');
  await page.fill('#formulir input[type=text]:not([inputmode])', 'tes offline');
  await page.click('#tombol-simpan'); await page.click('[data-aksi=kirim]');
  await page.waitForSelector('.status.tunggu');
  assert.strictEqual(await page.textContent('.nav .lencana'), '1');
  await page.screenshot({ path: OUT + '/07-offline.png' });
  jaringanMati = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('.status.aman');
  assert.strictEqual(terima.pop().nilai['Keterangan'], 'tes offline');

  // 6. Riwayat dan ringkasan
  await page.click('a[href="#/terbaru"]');
  await page.waitForSelector('.entri');
  await page.click('.pilih-tab button:has-text("Kas")');
  await page.waitForSelector('.entri:has-text("service disel")');
  await page.screenshot({ path: OUT + '/08-riwayat.png', fullPage: true });
  await page.click('a[href="#/ringkasan"]');
  await page.waitForSelector('.peringatan');
  await page.screenshot({ path: OUT + '/09-ringkasan.png', fullPage: true });
  await page.selectOption('#pilih-bulan', '09/2026');
  await page.waitForFunction(() => document.querySelector('.isi').textContent.includes('26.954.000'));
  await page.selectOption('#pilih-minggu', '28/09/2026');
  await page.waitForFunction(() => document.querySelector('.isi').textContent.includes('9.564.000'));
  await page.screenshot({ path: OUT + '/18-ringkasan-pilih.png', fullPage: true });
  await page.selectOption('#pilih-minggu', '19/10/2026');

  // 6b. Pemilik mengubah catatan dari Riwayat
  await page.click('a[href="#/terbaru"]');
  await page.click('.pilih-tab button:has-text("Kas")');
  await page.waitForSelector('[data-ubah-entri]');
  await page.screenshot({ path: OUT + '/13-riwayat-kelola.png', fullPage: true });
  // ketuk kartu -> rincian baca saja
  await page.click('.entri[data-idx="0"] h3');
  await page.waitForSelector('.rincian');
  const rincian = await page.textContent('.rincian');
  assert.ok(rincian.includes('Waktu dikirim') && rincian.includes('Proyek lain') && rincian.includes('Keluar'), rincian);
  assert.strictEqual(await page.locator('.lembar input, .lembar select, .lembar textarea').count(), 0, 'rincian hanya baca');
  await page.screenshot({ path: OUT + '/19-rincian.png' });
  await page.click('[data-aksi=tutup]');
  assert.strictEqual(await page.locator('.rincian').count(), 0);
  await page.click('[data-ubah-entri="0"]');
  await page.waitForSelector('#formulir');
  assert.strictEqual(await page.inputValue('select.masukan'), 'Proyek bangunan');
  assert.strictEqual(await page.inputValue('#formulir input[inputmode=numeric]'), '200000');
  await page.fill('#formulir input[inputmode=numeric]', '250000');
  await page.screenshot({ path: OUT + '/14-ubah.png', fullPage: true });
  await page.click('#tombol-simpan');
  await page.click('[data-aksi=kirim]');
  await page.waitForSelector('.pilih-tab');
  const u = kelola.pop();
  assert.strictEqual(u.aksi, 'ubah'); assert.strictEqual(u.nomor, 2); assert.strictEqual(u.tanda, 'T1');
  assert.strictEqual(u.nilai['Jumlah (Rp)'], 250000);
  assert.deepStrictEqual(Object.keys(u.nilai).sort(), ['Jumlah (Rp)', 'Kategori', 'Keterangan', 'Tanggal']);
  assert.strictEqual(terima.length, 0, 'ubah tidak masuk antrian simpan');

  // 6c. Hapus catatan
  await page.waitForSelector('[data-hapus-entri="0"]');
  await page.click('[data-hapus-entri="0"]');
  await page.waitForSelector('.lembar');
  await page.screenshot({ path: OUT + '/15-hapus.png' });
  await page.click('[data-aksi=hapus]');
  await page.waitForFunction(() => true);
  for (let i = 0; i < 20 && !kelola.length; i++) await page.waitForTimeout(100);
  const h = kelola.pop();
  assert.strictEqual(h.aksi, 'hapus'); assert.strictEqual(h.tanda, 'T1');

  // 6d. Kelola PIN
  await page.click('a[href="#/akun"]');
  await page.click('[data-ke="#/pin"]');
  await page.waitForSelector('[data-baris="22"]');
  await page.fill('[data-baris="22"] .pin-baru', '12');
  await page.click('[data-baris="22"] [data-simpan-pin]');
  assert.strictEqual(kelola.length, 0, 'PIN terlalu pendek ditolak di aplikasi');
  await page.fill('[data-baris="22"] .pin-baru', '7777');
  await page.click('[data-baris="22"] [data-simpan-pin]');
  for (let i = 0; i < 20 && !kelola.length; i++) await page.waitForTimeout(100);
  const pinReq = kelola.pop();
  assert.strictEqual(pinReq.aksi, 'pinUbah'); assert.strictEqual(pinReq.baris, 22); assert.strictEqual(pinReq.pinBaru, '7777');
  assert.strictEqual(pinReq.pin, '123456', 'PIN sesi tidak tertimpa');
  assert.strictEqual(await page.locator('[data-baris="20"] [data-matikan-pin]').count(), 0, 'PIN pemilik tidak bisa dimatikan');
  await page.screenshot({ path: OUT + '/16-pin.png', fullPage: true });
  await page.click('.kepala [data-ke="#/akun"]');
  await page.waitForSelector('#keluar');

  // 7. PIN pengumpul: hanya Ambil Bahan
  await page.click('#keluar');
  await page.fill('#pin', '1111'); await page.click('button[type=submit]');
  await page.waitForSelector('.grid-catatan');
  assert.strictEqual(await page.locator('.tombol-catatan').count(), 1);
  assert.strictEqual(await page.locator('a[href="#/ringkasan"]').count(), 0);
  await page.screenshot({ path: OUT + '/10-pengumpul.png' });
  await page.click('a[href="#/terbaru"]');
  await page.waitForSelector('.entri');
  assert.strictEqual(await page.locator('[data-ubah-entri]').count(), 0, 'pekerja tidak bisa mengubah');

  // 7b. PIN tim suling: hanya Absensi, dan diperingatkan kalau absensi hari ini sudah ada
  await page.click('a[href="#/akun"]');
  await page.click('#keluar');
  await page.fill('#pin', '6125'); await page.click('button[type=submit]');
  await page.waitForSelector('.grid-catatan');
  assert.strictEqual(await page.locator('.tombol-catatan').count(), 1);
  assert.strictEqual(await page.locator('a[href="#/isi/absensi"]').count(), 1);
  assert.strictEqual(await page.locator('a[href="#/isi/saring"]').count(), 0);
  absensiHariIni = true;
  await page.click('a[href="#/isi/absensi"]');
  await page.waitForSelector('#formulir');
  for (const h of ['Pengumpul [Rofik]', 'Pengumpul [Pak Muh]', 'Pengumpul [Mas Romadi]']) await pilihChip(h, '1 trip');
  await pilihChip('Tim suling [Eko & Pak Gatot]', '2x suling');
  await pilihChip('Ada kerja lain dengan upah khusus hari ini?', 'Tidak');
  const sebelum = dialog.length;
  await page.click('#tombol-simpan');
  await page.waitForSelector('.lembar');
  assert.ok(dialog.length === sebelum + 1 && /sudah diisi/.test(dialog[dialog.length - 1]), 'peringatan absensi dobel: ' + dialog.slice(-1));
  await page.click('[data-aksi=ubah]');
  await page.screenshot({ path: OUT + '/12-timsuling.png' });

  // 8. Mode gelap
  const gelap = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
  const p2 = await gelap.newPage(); await pasangMock(p2);
  await p2.goto('http://localhost:8123/');
  await p2.fill('#pin', '123456'); await p2.click('button[type=submit]');
  await p2.waitForSelector('#kotak-ringkas .kartu');
  await p2.click('a[href="#/isi/saring"]'); await p2.waitForSelector('#formulir');
  await p2.screenshot({ path: OUT + '/11-gelap.png', fullPage: true });

  assert.deepStrictEqual(galatHalaman, [], 'tidak ada galat JavaScript: ' + galatHalaman.join(' | '));
  await browser.close();
  console.log('Semua uji tampilan lulus. Gambar di ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
