// Uji "Ambil dari kontak HP" di formulir Data pembeli & Data supplier:
// APK (window.SembadaKontak), Chrome Android (navigator.contacts, kontak dengan 2 nomor), APK lama, iPhone, komputer.
// Jalankan: node tes/kontak_test.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { muat } = require('./tiruan7');
const { buatData } = require('./data_sembada');

const ASAL = 'https://papaaikidil.github.io/catatan-sembada/';
const API = 'https://script.google.com/macros/s/TES-SEMBADA/exec';
const OUT = process.env.OUT || '/tmp/sembada-layar';
const DOCS = path.join(__dirname, '..', 'docs');
fs.mkdirSync(OUT, { recursive: true });
const sheets = buatData();
const server = muat(sheets);
const objek = n => { const sh = sheets[n]; if (!sh) return []; const k = sh.data[0]; return sh.data.slice(1).filter(r => r.some(v => v !== '' && v !== undefined)).map(r => Object.fromEntries(k.map((h, j) => [h, r[j] === undefined ? '' : r[j]]))); };
const cek = n => console.log('  ✓ ' + n);

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const STUB_APK = `window.SembadaPrinter = { versi: () => 2, status: () => '{"ada":true,"nyala":true,"izin":true}', daftar: () => '[]' };
  window.SembadaKontak = { ada: () => true, pilih: (id) => { window.__dipilih = (window.__dipilih || 0) + 1;
    setTimeout(() => window.__hasilKontak(id, window.__batal ? null : { nama: 'Bu Rina Haldin', hp: '\\u202a+62 812-7777-8888\\u202c' }, ''), 30); } };`;
const STUB_WEB = `window.ContactsManager = function () {};
  Object.defineProperty(navigator, 'contacts', { value: { getProperties: async () => ['name', 'tel', 'email', 'address'],
    select: async (props) => { window.__props = props; return [{ name: ['Pak Joko'], tel: ['0812 1111 0000', '+62 857-9999-0000'], email: ['joko@contoh.com'],
      address: [{ addressLine: ['Jl. Pahlawan 5'], city: 'Tulungagung', region: 'Jawa Timur', postalCode: '66219' }] }]; } } });`;

async function buka(browser, ua, skrip) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta', userAgent: ua });
  if (skrip) await ctx.addInitScript(skrip);
  const page = await ctx.newPage();
  page.on('pageerror', e => galat.push(e.message));
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
  await page.goto(ASAL);
  await page.waitForSelector('#form-masuk');
  await page.fill('#pengguna', 'wildan');
  await page.fill('#sandi', '250610');
  await page.click('#form-masuk button[type=submit]');
  await page.waitForSelector('.tombol-pembeli');
  return { ctx, page };
}
async function formPembeliBaru(page) {
  await page.goto(ASAL + '#/pembeli');
  await page.waitForSelector('#pembeli-tambah');
  await page.click('#pembeli-tambah');
  await page.waitForSelector('.tirai [name=p0]');
}
const galat = [];

(async () => {
  const browser = await chromium.launch();

  // 1. APK: pemilih kontak Android lewat window.SembadaKontak
  {
    const { ctx, page } = await buka(browser, UA_ANDROID + ' CatatanSembadaApp', STUB_APK);
    await formPembeliBaru(page);
    assert.ok(await page.isVisible('.tirai .tombol-kontak'));
    assert.deepStrictEqual(await page.$$eval('.tirai [name=p0], .tirai [name=p2], .tirai [name=p3], .tirai [name=p4], .tirai [name=p5]', xs => xs.map(x => x.name + '=' + x.getAttribute('autocomplete'))),
      ['p0=name', 'p2=off', 'p3=tel', 'p4=email', 'p5=street-address'], 'isian siap untuk IsiOtomatis');
    await page.screenshot({ path: path.join(OUT, 'kontak-form.png') });
    await page.click('.tirai .tombol-kontak');
    await page.waitForFunction(() => document.querySelector('.tirai [name=p3]').value);
    assert.deepStrictEqual([await page.inputValue('.tirai [name=p0]'), await page.inputValue('.tirai [name=p3]')], ['Bu Rina Haldin', '+62 812-7777-8888'], 'nama & nomor terisi, tanda arah teks dibuang');
    // Nama sudah terisi: kontak kedua tidak menimpa nama, nama orangnya masuk ke "Nama kontak".
    await page.fill('.tirai [name=p0]', 'PT Haldin Pacific Semesta');
    await page.fill('.tirai [name=p3]', '');
    await page.click('.tirai .tombol-kontak');
    await page.waitForFunction(() => document.querySelector('.tirai [name=p3]').value);
    assert.deepStrictEqual([await page.inputValue('.tirai [name=p0]'), await page.inputValue('.tirai [name=p2]')], ['PT Haldin Pacific Semesta', 'Bu Rina Haldin']);
    // Batal di pemilih kontak: tidak ada yang berubah.
    await page.evaluate(() => { window.__batal = true; });
    await page.fill('.tirai [name=p3]', '0811');
    await page.click('.tirai .tombol-kontak');
    await page.waitForFunction(() => window.__dipilih === 3);
    await page.waitForTimeout(150);
    assert.strictEqual(await page.inputValue('.tirai [name=p3]'), '0811');
    await page.evaluate(() => { window.__batal = false; });
    await page.click('.tirai .tombol-kontak');
    await page.waitForFunction(() => document.querySelector('.tirai [name=p3]').value !== '0811');
    await page.click('.tirai [data-aksi="simpan"]');
    await page.waitForSelector('.tirai .rinci-kepala');
    const pb = objek('Data Pembeli').find(x => x['Nama'] === 'PT Haldin Pacific Semesta');
    assert.deepStrictEqual([pb['Nama kontak'], pb['No HP']], ['Bu Rina Haldin', '+62 812-7777-8888']);
    // Formulir supplier juga punya tombolnya.
    await page.goto(ASAL + '#/suplier');
    await page.waitForSelector('#suplier-tambah');
    await page.click('#suplier-tambah');
    await page.waitForSelector('.tirai .tombol-kontak');
    await page.click('.tirai .tombol-kontak');
    await page.waitForFunction(() => document.querySelector('.tirai [name=s2]').value);
    assert.deepStrictEqual([await page.inputValue('.tirai [name=s0]'), await page.inputValue('.tirai [name=s2]')], ['Bu Rina Haldin', '+62 812-7777-8888']);
    await ctx.close();
    cek('APK: ambil nama & nomor dari kontak (pembeli & supplier); nama yang sudah diisi tidak ditimpa; batal tidak mengubah apa pun');
  }

  // 2. Chrome Android: Contact Picker, kontak dengan 2 nomor -> pilih nomor; email & alamat ikut
  {
    const { ctx, page } = await buka(browser, UA_ANDROID, STUB_WEB);
    await formPembeliBaru(page);
    await page.click('.tirai .tombol-kontak');
    await page.waitForSelector('[data-nomor="1"]');
    await page.screenshot({ path: path.join(OUT, 'kontak-pilih-nomor.png') });
    await page.click('[data-nomor="1"]');
    await page.waitForFunction(() => document.querySelector('.tirai [name=p3]').value);
    assert.deepStrictEqual(await page.evaluate(() => ['p0', 'p3', 'p4', 'p5'].map(n => document.querySelector('.tirai [name=' + n + ']').value)),
      ['Pak Joko', '+62 857-9999-0000', 'joko@contoh.com', 'Jl. Pahlawan 5, Tulungagung, Jawa Timur, 66219']);
    assert.deepStrictEqual(await page.evaluate(() => window.__props), ['name', 'tel', 'email', 'address']);
    await ctx.close();
    cek('Chrome Android: pilih kontak, pilih salah satu dari 2 nomor, email & alamat ikut terisi');
  }

  // 3. APK lama (tanpa SembadaKontak): arahkan ke APK terbaru
  {
    const { ctx, page } = await buka(browser, UA_ANDROID + ' CatatanSembadaApp', `window.SembadaPrinter = { versi: () => 2 };`);
    await formPembeliBaru(page);
    await page.click('.tirai .tombol-kontak');
    assert.ok(/APK Sembada terbaru/.test(await page.textContent('.tirai .catatan-kontak')));
    await ctx.close();
    cek('APK lama: diarahkan memasang APK terbaru');
  }

  // 4. iPhone: petunjuk IsiOtomatis Kontak, kolom No HP difokuskan
  {
    const { ctx, page } = await buka(browser, UA_IPHONE);
    await formPembeliBaru(page);
    await page.click('.tirai .tombol-kontak');
    assert.ok(/IsiOtomatis Kontak[\s\S]*Kontak Lain/.test(await page.textContent('.tirai .catatan-kontak')));
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.name), 'p3');
    await page.screenshot({ path: path.join(OUT, 'kontak-iphone.png') });
    await ctx.close();
    cek('iPhone: petunjuk IsiOtomatis Kontak › Kontak Lain, kolom No HP langsung aktif');
  }

  // 5. Komputer: tidak ada tombol (tidak ada kontak HP)
  {
    const { ctx, page } = await buka(browser, undefined);
    await formPembeliBaru(page);
    assert.strictEqual(await page.$('.tirai .tombol-kontak'), null);
    await ctx.close();
    cek('komputer: tombol tidak ditampilkan');
  }

  assert.deepStrictEqual(galat, [], 'tidak ada galat di halaman');
  await browser.close();
  console.log('Uji ambil dari kontak lulus.');
})().catch(e => { console.error(e); process.exit(1); });
