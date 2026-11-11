// Uji Data pembeli: daftar gabungan (kontak, daftar pilihan, Penjualan), total pembelian, tambah & lengkapi kontak,
// tombol telepon/WhatsApp/email/peta, cari & urut, nama yang dipakai di Penjualan terkunci, hapus kontak.
// Jalankan: node tes/pembeli_test.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { muat, tgl } = require('./tiruan7');
const { buatData, isoHari } = require('./data_sembada');

const ASAL = 'https://papaaikidil.github.io/catatan-sembada/';
const API = 'https://script.google.com/macros/s/TES-SEMBADA/exec';
const OUT = process.env.OUT || '/tmp/sembada-layar';
const DOCS = path.join(__dirname, '..', 'docs');
fs.mkdirSync(OUT, { recursive: true });
const sheets = buatData();
// Penjualan tambahan: Lusiani beli lagi (lunas), Pak Abdillah (bukan dari daftar pilihan) beli minyak & hidrosol.
sheets['Penjualan'].data.push(
  ['', new Date(), tgl(isoHari(-8)), 'Lusiani', 'Minyak jeruk purut (campur)', 20, 600000, 'Lunas', 'antar', '', 'kg', 12000000, 20],
  ['', new Date(), tgl(isoHari(-30)), 'Pak Abdillah (Bali)', 'Minyak jeruk purut (campur)', 2, 725000, 'Lunas', 'ekspedisi', '', 'kg', 1450000, 2],
  ['', new Date(), tgl(isoHari(-30)), 'Pak Abdillah (Bali)', 'Hidrosol', 5, 20000, 'Lunas', 'ekspedisi', '', 'liter', 100000, 0]
);
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
async function isi(page, sel, v) { await page.fill(sel, ''); await page.fill(sel, String(v)); }
async function pilihChip(page, nama, nilai) {
  await page.evaluate(([n, v]) => { const i = [...document.querySelectorAll('input[name="' + n + '"]')].find(x => x.value === v); i.closest('label').click(); }, [nama, nilai]);
}
const namaKartu = page => page.$$eval('#daftar-pembeli .kartu-pembeli h3 > span', s => s.map(x => x.childNodes[0].textContent.trim()));

(async () => {
  const browser = await chromium.launch();
  const galat = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await ctx.newPage();
  page.on('pageerror', e => galat.push(e.message));
  page.on('dialog', d => d.accept());
  await pasang(page);
  await page.goto(ASAL);
  await page.waitForSelector('#form-masuk');
  await page.fill('#pengguna', 'wildan');
  await page.fill('#sandi', '250610');
  await page.click('#form-masuk button[type=submit]');
  await page.waitForSelector('.tombol-pembeli');
  const pjAwal = JSON.stringify(sheets['Penjualan'].data);

  // Daftar: pembeli dari Penjualan & daftar pilihan, urut dari pembelian terbesar.
  await page.click('.tombol-pembeli');
  await page.waitForSelector('#daftar-pembeli .kartu-pembeli');
  assert.deepStrictEqual(await namaKartu(page), ['Lusiani', 'Pak Abdillah (Bali)', 'Bapak']);
  const kartuLus = await page.textContent('[data-pembeli="lusiani"]');
  assert.ok(/Rp21\.564\.000/.test(kartuLus) && /2x beli/.test(kartuLus) && /35,94 kg/.test(kartuLus) && /Belum lunas Rp9\.564\.000/.test(kartuLus), kartuLus);
  assert.ok(/Kontak belum diisi/.test(kartuLus));
  assert.ok(/Rp23\.114\.000/.test(await page.textContent('.pembeli-ringkas')), 'total semua penjualan');
  await page.screenshot({ path: path.join(OUT, 'pembeli-daftar.png'), fullPage: true });
  cek('daftar pembeli dari Penjualan & daftar pilihan; total, jumlah beli, kg, belum lunas');

  // Lengkapi kontak Lusiani: nama terkunci karena sudah dipakai di Penjualan.
  await page.click('[data-pembeli="lusiani"]');
  await page.waitForSelector('.tirai [data-aksi="ubah"]');
  assert.ok(/Belum ada kontak/.test(await page.textContent('.tirai')));
  assert.strictEqual((await page.$$('.tirai .daftar-beli .baris-entri')).length, 2);
  await page.click('.tirai [data-aksi="ubah"]');
  await page.waitForSelector('.tirai [name=p0]');
  assert.strictEqual(await page.inputValue('.tirai [name=p0]'), 'Lusiani');
  assert.ok(await page.$eval('.tirai [name=p0]', x => x.readOnly), 'nama terkunci');
  await pilihChip(page, 'p1', 'Perorangan');
  await isi(page, '.tirai [name=p2]', 'Bu Lusi');
  await isi(page, '.tirai [name=p3]', '0812 3456 789');
  await isi(page, '.tirai [name=p4]', 'bukan email');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai .bidang.salah[data-h="Email"]');
  await isi(page, '.tirai [name=p4]', 'lusi@contoh.com');
  await isi(page, '.tirai [name=p5]', 'Kepuh, Boyolangu, Tulungagung');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai .aksi-kontak');
  const kp = objek('Data Pembeli');
  assert.deepStrictEqual([kp.length, kp[0]['Nama'], kp[0]['Jenis'], kp[0]['No HP'], kp[0]['Email']], [1, 'Lusiani', 'Perorangan', '0812 3456 789', 'lusi@contoh.com']);
  const tautan = await page.$$eval('.tirai .aksi-kontak a', as => as.map(a => a.textContent.trim() + '=' + a.getAttribute('href')));
  assert.ok(tautan.includes('Telepon=tel:08123456789'), tautan.join(' | '));
  assert.ok(tautan.includes('WhatsApp=https://wa.me/628123456789'), tautan.join(' | '));
  assert.ok(tautan.includes('Email=mailto:lusi@contoh.com'), tautan.join(' | '));
  assert.ok(tautan.some(t => /^Peta=https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Kepuh%2C%20Boyolangu/.test(t)), tautan.join(' | '));
  await page.screenshot({ path: path.join(OUT, 'pembeli-detail.png'), fullPage: true });
  await page.click('.tirai [data-aksi="tutup"]');
  assert.ok(/0812 3456 789/.test(await page.textContent('[data-pembeli="lusiani"]')), 'kontak tampil di kartu');
  cek('lengkapi kontak pembeli lama: nama terkunci, email dicek, tombol telepon/WhatsApp/email/peta');

  // Tambah pembeli baru dari kotak cari: masuk daftar pilihan Pembeli di formulir Penjualan.
  await page.fill('#pembeli-cari', 'PT Haldin');
  await page.waitForFunction(() => /Tidak ada pembeli yang cocok/.test(document.getElementById('daftar-pembeli').textContent));
  await page.click('#pembeli-tambah');
  await page.waitForSelector('.tirai [name=p0]');
  assert.strictEqual(await page.inputValue('.tirai [name=p0]'), 'PT Haldin', 'nama terisi dari kotak cari');
  await isi(page, '.tirai [name=p0]', 'PT Haldin Pacific Semesta');
  await pilihChip(page, 'p1', 'Perusahaan');
  await isi(page, '.tirai [name=p2]', 'Bagian pembelian');
  await isi(page, '.tirai [name=p3]', '+62 21 1234 5678');
  await isi(page, '.tirai [name=p6]', 'www.haldin-natural.com');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai .aksi-kontak');
  const t2 = await page.$$eval('.tirai .aksi-kontak a', as => as.map(a => a.textContent.trim() + '=' + a.getAttribute('href')));
  assert.ok(t2.includes('Website=https://www.haldin-natural.com'), t2.join(' | '));
  assert.ok(/Belum ada catatan penjualan/.test(await page.textContent('.tirai')));
  await page.click('.tirai [data-aksi="tutup"]');
  assert.deepStrictEqual(await namaKartu(page), ['PT Haldin Pacific Semesta'], 'pencarian tetap aktif');
  await page.fill('#pembeli-cari', '');
  await page.waitForFunction(() => document.querySelectorAll('#daftar-pembeli .kartu-pembeli').length === 4);
  await page.goto(ASAL + '#/isi/jual');
  await page.waitForSelector('#formulir');
  assert.ok(await page.$('input[name=b1][value="PT Haldin Pacific Semesta"]'), 'pembeli baru bisa dipilih di formulir Penjualan');
  cek('tambah pembeli baru (nama dari kotak cari); langsung bisa dipilih di formulir Penjualan');

  // Urut & cari
  await page.goto(ASAL + '#/pembeli');
  await page.waitForSelector('#daftar-pembeli .kartu-pembeli');
  await pilihChip(page, 'pembeli-urut', 'nama');
  assert.deepStrictEqual(await namaKartu(page), ['Bapak', 'Lusiani', 'Pak Abdillah (Bali)', 'PT Haldin Pacific Semesta']);
  await pilihChip(page, 'pembeli-urut', 'terakhir');
  assert.strictEqual((await namaKartu(page))[0], 'Lusiani');
  await page.fill('#pembeli-cari', 'tulungagung');
  await page.waitForFunction(() => document.querySelectorAll('#daftar-pembeli .kartu-pembeli').length === 1);
  await page.fill('#pembeli-cari', '0812');
  await page.waitForFunction(() => document.querySelectorAll('#daftar-pembeli .kartu-pembeli').length === 1);
  await page.fill('#pembeli-cari', '');
  cek('urut nama / terakhir beli; cari lewat alamat dan No HP');

  // Hapus kontak: pembelinya tetap ada (dari Penjualan), Penjualan tidak berubah.
  await page.click('[data-pembeli="lusiani"]');
  await page.waitForSelector('.tirai [data-aksi="hapus"]');
  await page.click('.tirai [data-aksi="hapus"]');
  await page.waitForFunction(() => !document.querySelector('.tirai') && /Kontak belum diisi/.test(document.querySelector('[data-pembeli="lusiani"]').textContent));
  assert.strictEqual(objek('Data Pembeli').length, 1);
  assert.strictEqual(JSON.stringify(sheets['Penjualan'].data), pjAwal, 'tab Penjualan tidak berubah');
  cek('hapus kontak: catatan penjualan tidak berubah, pembeli tetap tampil');

  // Layar lebar
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await page.waitForSelector('#daftar-pembeli .kartu-pembeli');
  const geser = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(geser <= 1, 'tidak bisa digeser ke samping');
  await page.screenshot({ path: path.join(OUT, 'pembeli-lebar.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForSelector('#daftar-pembeli .kartu-pembeli');
  const geser2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(geser2 <= 1, 'HP: tidak bisa digeser ke samping');

  assert.deepStrictEqual(galat, [], 'tidak ada galat di halaman');
  await browser.close();
  console.log('Uji data pembeli lulus.');
})().catch(e => { console.error(e); process.exit(1); });
