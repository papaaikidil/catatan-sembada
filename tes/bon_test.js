// Uji Catatan bon: catat bon dua arah, cicil sampai lunas, saring belum/sudah lunas, jatuh tempo, penjualan belum dibayar
// ditandai lunas, dan petunjuk sisa bon di slip upah.
// Jalankan: node tes/bon_test.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { muat } = require('./tiruan7');
const { buatData, isoHari } = require('./data_sembada');

const ASAL = 'https://papaaikidil.github.io/catatan-sembada/';
const API = 'https://script.google.com/macros/s/TES-SEMBADA/exec';
const OUT = process.env.OUT || '/tmp/sembada-layar';
const DOCS = path.join(__dirname, '..', 'docs');
fs.mkdirSync(OUT, { recursive: true });
const sheets = buatData();
const server = muat(sheets);
const objek = n => { const sh = sheets[n]; const k = sh.data[0]; return sh.data.slice(1).filter(r => r.some(v => v !== '' && v !== undefined)).map(r => Object.fromEntries(k.map((h, j) => [h, r[j] === undefined ? '' : r[j]]))); };

async function pasang(page) {
  await page.route(API + '**', async route => {
    const req = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(server.panggil(req)) });
  });
  await page.route(ASAL + '**', async route => {
    const f = new URL(route.request().url()).pathname.replace('/catatan-sembada/', '') || 'index.html';
    if (f === 'config.js') return route.fulfill({ contentType: 'application/javascript', body: `window.SEMBADA_CONFIG={API_URL:'${API}',VERSI:'tes'};` });
    const p = path.join(DOCS, f);
    if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'tidak ada' });
    const jenis = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(p)] || 'application/octet-stream';
    await route.fulfill({ contentType: jenis, body: fs.readFileSync(p) });
  });
}
const cek = n => console.log('  ✓ ' + n);

async function masuk(page) {
  await page.goto(ASAL);
  await page.waitForSelector('#form-masuk');
  await page.fill('#pengguna', 'wildan');
  await page.fill('#sandi', '250610');
  await page.click('#form-masuk button[type=submit]');
  await page.waitForSelector('#kotak-ringkas .daftar-upah');
}

async function isi(page, sel, v) { await page.fill(sel, ''); await page.fill(sel, String(v)); }
async function pilihChip(page, nama, nilai) {
  await page.evaluate(([n, v]) => { const i = [...document.querySelectorAll('input[name="' + n + '"]')].find(x => x.value === v); i.closest('label').click(); }, [nama, nilai]);
}
async function tungguToast(page, re) { await page.waitForFunction(r => !document.getElementById('toast').hidden && new RegExp(r).test(document.getElementById('toast').textContent), re.source); }

(async () => {
  const browser = await chromium.launch();
  const galat = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await ctx.newPage();
  page.on('pageerror', e => galat.push(e.message));
  page.on('dialog', d => d.accept());
  await pasang(page);
  await masuk(page);

  // Masuk dari Beranda
  await page.click('.tombol-bon');
  await page.waitForSelector('#bon-tambah');
  assert.ok(/Penjualan belum dibayar/.test(await page.textContent('#isi-bon')), 'penjualan belum dibayar ikut tampil');
  await page.screenshot({ path: path.join(OUT, 'bon-kosong.png'), fullPage: true });
  cek('Catatan bon dibuka dari Beranda; penjualan belum dibayar ikut tampil');

  // Catat kasbon Rofik
  await page.click('#bon-tambah');
  await page.waitForSelector('.tirai [name=n0]');
  // Nama karyawan dipilih dari daftar Karyawan aktif (tanpa mengetik).
  const pilihanNama = await page.$$eval('.tirai #k0 .chip span', s => s.map(x => x.textContent));
  const aktif = objek('Karyawan').filter(x => x['Nama'] && !x['Tanggal keluar'] && String(x['Aktif'] || 'Ya') !== 'Tidak').map(x => x['Nama']);
  assert.ok(aktif.every(n => pilihanNama.includes(n)) && pilihanNama.includes('Lainnya…'), 'pilihan nama = karyawan aktif: ' + pilihanNama);
  assert.ok(await page.isHidden('.tirai #t0'), 'isian nama toko disembunyikan');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai #k0.salah');
  await page.evaluate(() => { const i = [...document.querySelectorAll('.tirai input[name="k0"]')].find(x => x.value === 'Rofik'); i.closest('label').click(); });
  await isi(page, '.tirai [name=n0]', 'kasbon beli obat');
  await isi(page, '.tirai [name=n1]', '300000');
  await page.screenshot({ path: path.join(OUT, 'bon-tambah.png') });
  await page.click('.tirai [data-aksi="simpan"]');
  await tungguToast(page, /Bon tersimpan/);
  await page.waitForSelector('.bon-orang [data-bon]');
  assert.ok(/Rofik/.test(await page.textContent('.bon-orang')) && /Rp300\.000/.test(await page.textContent('.bon-orang')));
  assert.strictEqual(objek('Bon')[0]['Nama'], 'Rofik');
  cek('Catat bon baru (orang ngebon ke kita)');

  // Cicil 100.000 dengan potong upah
  await page.click('.bon-orang [data-bon]');
  await page.waitForSelector('.tirai [data-aksi="bayar"]');
  await page.click('.tirai [data-aksi="bayar"]');
  await page.waitForSelector('.tirai [name=y0]');
  assert.strictEqual(await page.inputValue('.tirai [name=y0]'), '300000', 'jumlah bayar terisi sisa');
  await isi(page, '.tirai [name=y0]', '100000');
  await page.evaluate(() => { const i = [...document.querySelectorAll('.tirai input[name="y2"]')].find(x => x.value === 'Potong upah'); i.closest('label').click(); });
  assert.ok(/Sisa sesudah ini Rp200\.000/.test(await page.textContent('#bayar-pratinjau')));
  await page.click('.tirai [data-aksi="simpan"]');
  await tungguToast(page, /Pembayaran tersimpan/);
  await page.waitForFunction(() => !document.querySelector('.tirai') && /Dicicil/.test(document.querySelector('.bon-orang').textContent));
  assert.ok(/sisa Rp200\.000/.test(await page.textContent('.bon-orang')));
  assert.strictEqual(objek('Bayar Bon')[0]['Cara'], 'Potong upah');
  cek('Bayar sebagian (potong upah): status Dicicil, sisa Rp200.000');

  // Petunjuk sisa bon di slip upah
  await page.goto(ASAL + '#/');
  await page.waitForSelector('#kotak-ringkas .tombol-slip');
  assert.ok(/belum lunas/.test(await page.textContent('.tombol-bon')), 'Beranda menunjukkan jumlah bon belum lunas');
  await page.click('#kotak-ringkas .tombol-slip');
  await pilihChip(page, 'slip-siapa', 'Rofik');
  await page.waitForSelector('.slip-bonus');
  assert.ok(/Rofik masih punya bon Rp200\.000/.test(await page.textContent('.slip-tambahan')));
  await page.click('.lembar-slip [data-aksi="tutup"]');
  cek('Slip upah Rofik menunjukkan sisa bon Rp200.000');

  // Lunasi
  await page.goto(ASAL + '#/bon');
  await page.waitForSelector('.bon-orang [data-bon]');
  await page.click('.bon-orang [data-bon]');
  await page.click('.tirai [data-aksi="bayar"]');
  await page.waitForSelector('.tirai [name=y0]');
  assert.strictEqual(await page.inputValue('.tirai [name=y0]'), '200000');
  assert.ok(/jadi LUNAS/.test(await page.textContent('#bayar-pratinjau')));
  await page.click('.tirai [data-aksi="simpan"]');
  await tungguToast(page, /sudah lunas/);
  await page.waitForFunction(() => !document.querySelector('.tirai') && !document.querySelector('.bon-orang'));
  await pilihChip(page, 'bon-saring', 'lunas');
  await page.waitForSelector('.bon-orang');
  assert.ok(/Lunas/.test(await page.textContent('.bon-orang')) && /lunas Rp300\.000/.test(await page.textContent('.bon-orang')));
  assert.strictEqual(objek('Bon')[0]['Status'], 'Lunas');
  await pilihChip(page, 'bon-saring', 'belum');
  cek('Lunasi sisa: pindah ke "Sudah lunas", status di Sheet Lunas');

  // Kita ngebon ke toko, sudah lewat jatuh tempo
  await page.click('[data-arah="Kita ngebon"]');
  await page.click('#bon-tambah');
  await page.waitForSelector('.tirai [name=n0]');
  assert.strictEqual(await page.evaluate(() => document.querySelector('.tirai input[name="n_arah"]:checked').value), 'Kita ngebon');
  assert.ok(await page.isHidden('.tirai #k0') && await page.isVisible('.tirai [name=t0]'), 'kita ngebon: nama toko diketik');
  await isi(page, '.tirai [name=t0]', 'Toko Bangunan Jaya');
  await isi(page, '.tirai [name=n0]', 'semen 10 sak');
  await isi(page, '.tirai [name=n1]', '650000');
  await page.fill('.tirai [name=n3]', isoHari(-1));
  await page.click('.tirai [data-aksi="simpan"]');
  await tungguToast(page, /Bon tersimpan/);
  await page.waitForSelector('.bon-orang .merah');
  assert.ok(/lewat jatuh tempo/.test(await page.textContent('.bon-orang .merah')));
  assert.ok(/Rp650\.000/.test(await page.textContent('[data-arah="Kita ngebon"]')));
  await page.screenshot({ path: path.join(OUT, 'bon-kita.png'), fullPage: true });
  cek('Kita ngebon ke toko: ringkasan utang, tanda lewat jatuh tempo');

  // Karyawan baru muncul, karyawan yang keluar hilang dari pilihan (setelah aplikasi memuat ulang data).
  const tok = await page.evaluate(() => JSON.parse(localStorage.getItem('sembada7.sesi')).token);
  assert.ok(server.panggil({ aksi: 'masterSimpan', token: tok, tab: 'Karyawan', id: '', nilai: { 'Nama': 'Joko', 'Tim': 'Pengumpul' } }).ok);
  assert.ok(server.panggil({ aksi: 'masterAktif', token: tok, tab: 'Karyawan', id: 'Mas Romadi', aktif: false, tanggalKeluar: isoHari(0) }).ok);
  await page.reload();
  await page.waitForSelector('#bon-tambah');
  await page.waitForTimeout(800);
  await page.click('[data-arah="Orang ngebon"]');
  await page.click('#bon-tambah');
  await page.waitForSelector('.tirai #k0 .chip');
  const nama2 = await page.$$eval('.tirai #k0 .chip span', s => s.map(x => x.textContent));
  assert.ok(nama2.includes('Joko') && !nama2.includes('Mas Romadi'), 'pilihan nama ikut Kelola › Karyawan: ' + nama2);
  await page.click('.tirai [data-aksi="batal"]');
  cek('Karyawan baru muncul dan karyawan keluar hilang dari pilihan nama');

  // Penjualan belum dibayar ditandai lunas
  await page.click('[data-arah="Orang ngebon"]');
  await page.waitForSelector('[data-jual-lunas]');
  const sebelum = objek('Penjualan').filter(x => x['Status bayar'] && x['Status bayar'] !== 'Lunas').length;
  await page.click('[data-jual-lunas]');
  await page.click('.tirai [data-aksi="ya"]');
  await tungguToast(page, /ditandai lunas/);
  await page.waitForFunction(n => document.querySelectorAll('[data-jual-lunas]').length === n - 1, sebelum);
  assert.strictEqual(objek('Penjualan').filter(x => x['Status bayar'] && x['Status bayar'] !== 'Lunas').length, sebelum - 1);
  cek('Penjualan belum dibayar ditandai lunas (Status bayar di Sheet ikut berubah)');

  // Tablet landscape
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('[data-arah="Kita ngebon"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'bon-tablet.png') });

  await browser.close();
  assert.deepStrictEqual(galat, [], 'galat di halaman');
  console.log('Uji catatan bon lulus.');
})().catch(e => { console.error(e); process.exit(1); });
