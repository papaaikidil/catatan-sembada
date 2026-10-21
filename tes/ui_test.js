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

let terima = [];          // simpan yang masuk
let jaringanMati = false;

async function pasangMock(page) {
  await page.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `window.SEMBADA_CONFIG={API_URL:'${API}',VERSI:'tes'};` }));
  await page.route(API + '**', async route => {
    if (jaringanMati) return route.abort('internetdisconnected');
    const req = JSON.parse(route.request().postData() || '{}');
    const akses = req.pin === '123456' ? { peran: 'Pemilik', tab: SEMUA, semua: true }
      : req.pin === '1111' ? { peran: 'Pengumpul', tab: ['Ambil Bahan'], semua: false } : null;
    let body;
    if (!akses) body = { ok: false, kode: 'PIN', galat: 'PIN salah.' };
    else if (req.aksi === 'masuk') body = Object.assign({ ok: true }, akses);
    else if (req.aksi === 'config') {
      const kepala = {}; akses.tab.forEach(t => kepala[t] = KEPALA[t]);
      body = Object.assign({ ok: true, daftar: DAFTAR, tarif: TARIF, kepala, satuanProduk: { 'Minyak jeruk purut (campur)': 'kg', 'Hidrosol jeruk purut': 'liter' },
        arahKas: { 'Proyek bangunan': 'Keluar', 'Pinjaman masuk': 'Masuk' } }, akses);
    } else if (req.aksi === 'simpan') { terima.push(req); body = { ok: true }; }
    else if (req.aksi === 'terbaru') body = { ok: true, tab: req.tab, kepala: ['Hari', 'Timestamp', 'Tanggal', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Kelompok', 'Arah'],
      baris: [['Rabu', '21/10/2026 06:42', '21/10/2026', 'Proyek bangunan', 'Rp200,000', 'service disel dan beli bensin buat ngisi kolam', 'Proyek lain', 'Keluar']] };
    else if (req.aksi === 'ringkasan') body = { ok: true, dataSampai: '21/10/2026',
      mingguBerjalan: { mulai: '19/10/2026', sampai: '25/10/2026', penjualan: 0, laba: -1230000, minyak: 0, terjual: 0, bahanKg: 3240, hargaBahan: 430, biayaPerKg: null, upahPengumpul: 228000, upahPenyuling: 0, upahHarian: 730000, sulingan: 0, ketelKosong: 3 },
      mingguPenuh: { mulai: '12/10/2026', sampai: '18/10/2026', penjualan: 0, laba: -150000, minyak: 0, terjual: 0, bahanKg: 0, hargaBahan: null, biayaPerKg: null, upahPengumpul: 0, upahPenyuling: 0, upahHarian: 2860000, sulingan: 0, ketelKosong: 6 },
      bulanIni: { bulan: '10/2026', penjualan: 21204000, laba: 16978000, cicilan: 3700000, keluarga: 4838700, proyekBahan: 9047000, upahHarian: 4410000, perubahanKas: 4662300 },
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
  page.on('dialog', d => d.accept());
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

  // 7. PIN pengumpul: hanya Ambil Bahan
  await page.click('a[href="#/akun"]');
  await page.click('#keluar');
  await page.fill('#pin', '1111'); await page.click('button[type=submit]');
  await page.waitForSelector('.grid-catatan');
  assert.strictEqual(await page.locator('.tombol-catatan').count(), 1);
  assert.strictEqual(await page.locator('a[href="#/ringkasan"]').count(), 0);
  await page.screenshot({ path: OUT + '/10-pengumpul.png' });

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
