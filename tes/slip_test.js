// Uji slip upah: pratinjau (lebar 32/48 kolom), tambahan/potongan, kirim WA, dan cetak ke printer Bluetooth tiruan (ESC/POS).
// Jalankan: node tes/slip_test.js
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
const server = muat(buatData());

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
const baris = async page => (await page.textContent('.slip-pratinjau')).split('\n');

(async () => {
  const browser = await chromium.launch();
  const galat = [];

  // ---- APK dengan printer Bluetooth (tiruan)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 CatatanSembadaApp' });
  await ctx.addInitScript(() => {
    window.SembadaPrinter = {
      status: () => JSON.stringify({ ada: true, izin: true, nyala: true }),
      daftar: () => JSON.stringify([{ nama: 'RPP02N', alamat: '00:11:22:33:44:55', printer: true }, { nama: 'Headset', alamat: 'AA:BB:CC:DD:EE:FF', printer: false }]),
      mintaIzin() {},
      versi: () => 2,
      cetak(alamat, data, id) { window.__dicetak = { alamat, data, id }; setTimeout(() => window.__hasilCetak(id, true, ''), 50); }
    };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => galat.push(e.message));
  await pasang(page);
  await masuk(page);

  const ring = await page.evaluate(() => JSON.parse(localStorage.getItem('sembada7.ringkasan')));
  const m = ring.minggu[0];
  assert.ok(m.orang.length >= 2, 'ada beberapa orang di minggu ini');
  await page.click('#kotak-ringkas .tombol-slip');
  await page.waitForSelector('.lembar-slip .slip-pratinjau');
  let b = await baris(page);
  assert.ok(b.every(x => x.length <= 32), 'semua baris muat 32 kolom (kertas 58 mm): ' + b.filter(x => x.length > 32).join(' | '));
  const teks = b.join('\n');
  assert.ok(/SLIP UPAH MINGGUAN/.test(teks) && /DIBAYAR/.test(teks));
  m.orang.forEach(o => assert.ok(teks.includes(o.nama), 'slip ' + o.nama));
  await page.screenshot({ path: path.join(OUT, 'slip-semua.png') });
  cek('Slip semua orang: pratinjau 32 kolom, satu slip per orang');

  // Satu orang + tambahan & potongan
  const o = m.orang.find(x => x.rinci && x.rinci.length) || m.orang[0];
  await page.evaluate(n => { const i = [...document.querySelectorAll('input[name="slip-siapa"]')].find(x => x.value === n); i.closest('label').click(); }, o.nama);
  await page.waitForFunction(n => document.querySelector('.slip-pratinjau').textContent.includes(n) && !/\n- - -/.test(document.querySelector('.slip-pratinjau').textContent), o.nama);
  b = await baris(page);
  const rpTeks = n => 'Rp' + n.toLocaleString('id-ID');
  assert.ok(b.some(x => /^Total upah/.test(x) && x.endsWith(rpTeks(o.total))), 'total upah ' + o.nama + ': ' + b.join('\n'));
  if (o.rinci) assert.strictEqual(b.filter(x => /^(Sen|Sel|Rab|Kam|Jum|Sab|Min) \d\d\/\d\d/.test(x)).length, o.rinci.length, 'satu baris per hari');
  await page.click('.slip-bonus summary');
  await page.fill('[data-tambah="bonus"]', '50000');
  await page.fill('[data-tambah="ketBonus"]', 'bonus rajin');
  await page.fill('[data-tambah="potong"]', '20000');
  await page.fill('[data-tambah="ketPotong"]', 'kasbon');
  b = await baris(page);
  assert.ok(b.some(x => /^DIBAYAR/.test(x) && x.endsWith(rpTeks(o.total + 30000))), 'dibayar = total + tambahan - potongan: ' + b.filter(x => /DIBAYAR|Tambahan|Potongan/.test(x)).join(' | '));
  assert.ok(b.every(x => x.length <= 32));
  const wa = await page.$$eval('.slip-wa [data-aksi="wa"]', as => as.map(a => ({ label: a.textContent.trim(), href: a.getAttribute('href') })));
  assert.deepStrictEqual(wa.map(x => x.label), ['WhatsApp', 'WA Bisnis'], 'pilihan WhatsApp biasa dan WA Bisnis');
  assert.ok(/^intent:\/\/send\?(phone=\d+&)?text=.*#Intent;scheme=whatsapp;package=com\.whatsapp;end$/.test(wa[0].href), wa[0].href);
  assert.ok(/package=com\.whatsapp\.w4b;end$/.test(wa[1].href), wa[1].href);
  assert.ok(decodeURIComponent(wa[0].href).includes(o.nama) && decodeURIComponent(wa[0].href).includes('DIBAYAR'), 'isi slip ikut terkirim');
  await page.screenshot({ path: path.join(OUT, 'slip-satu.png') });
  await page.evaluate(() => document.querySelector('.slip-wa').scrollIntoView({ block: 'end' }));
  await page.screenshot({ path: path.join(OUT, 'slip-wa.png') });
  cek('Slip satu orang: rincian per hari, tambahan & potongan, pilihan WhatsApp biasa / WA Bisnis');

  // Kertas 80 mm
  await page.evaluate(() => [...document.querySelectorAll('input[name="slip-kertas"]')].find(x => x.value === '80').closest('label').click());
  await page.waitForFunction(() => document.querySelector('.slip-pratinjau').textContent.split('\n').some(x => x.length > 32));
  b = await baris(page);
  assert.ok(b.every(x => x.length <= 48) && b.some(x => x.length === 48), 'kertas 80 mm = 48 kolom');
  cek('Kertas 80 mm: 48 kolom, pilihan tersimpan di HP');

  // Cetak ke printer tiruan
  assert.strictEqual(await page.inputValue('#slip-pilih-printer'), '00:11:22:33:44:55', 'printer (kelas Imaging) dipilih otomatis');
  await page.click('[data-aksi="cetak"]');
  await page.waitForFunction(() => window.__dicetak);
  await page.waitForSelector('#toast:not([hidden])');
  assert.ok(/dikirim ke printer/.test(await page.textContent('#toast')));
  const dicetak = await page.evaluate(() => window.__dicetak);
  const byte = Buffer.from(dicetak.data, 'base64');
  assert.deepStrictEqual([...byte.slice(0, 2)], [0x1B, 0x40], 'diawali ESC @ (reset printer)');
  assert.ok(byte.includes(Buffer.from(o.nama)) && byte.includes(Buffer.from('DIBAYAR')), 'isi slip terkirim');
  assert.ok([...byte].every(x => x < 128), 'hanya ASCII (aman untuk semua printer)');
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('sembada7.slipPrinter')), JSON.stringify('00:11:22:33:44:55'));
  cek('Cetak: perintah ESC/POS dikirim ke printer Bluetooth yang dipilih');

  // Tablet landscape
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'slip-tablet.png') });
  await ctx.close();

  // ---- Browser biasa (tanpa APK): tawarkan RawBT
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => galat.push(e.message));
  await pasang(p2);
  await masuk(p2);
  await p2.goto(ASAL + '#/ringkasan');
  await p2.waitForSelector('.kartu-minggu .tombol-slip');
  await p2.click('.kartu-minggu .tombol-slip');
  await p2.waitForSelector('[data-aksi="gambar"]');
  assert.strictEqual(await p2.$('[data-aksi="rawbt"]'), null, 'RawBT hanya untuk Android');
  const [unduh] = await Promise.all([p2.waitForEvent('download'), p2.click('[data-aksi="gambar"]')]);
  const png = fs.readFileSync(await unduh.path());
  assert.ok(png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 384, 'gambar slip PNG selebar 384 titik (58 mm)');
  assert.ok(/^slip-upah-semua-\d{4}-\d{2}-\d{2}\.png$/.test(unduh.suggestedFilename()), unduh.suggestedFilename());
  await p2.evaluate(() => [...document.querySelectorAll('input[name="slip-siapa"]')][1].closest('label').click());
  await p2.waitForSelector('.slip-wa [data-aksi="wa"]');
  const wa2 = await p2.$$eval('.slip-wa [data-aksi="wa"]', as => as.map(a => a.getAttribute('href')));
  assert.ok(wa2.length === 1 && /^https:\/\/wa\.me\//.test(wa2[0]), 'di luar Android: satu tautan wa.me biasa');
  await p2.screenshot({ path: path.join(OUT, 'slip-browser.png') });
  cek('Di komputer: unduh gambar slip (PNG 384 titik), kirim lewat wa.me');

  // ---- iPhone (Safari): tidak ada RawBT; gambar slip dibagikan ke aplikasi printer lewat menu Bagikan
  const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ctx4.addInitScript(() => {
    navigator.canShare = d => !!(d && d.files && d.files.length);
    navigator.share = async d => { const f = d.files[0]; window.__dibagikan = { nama: f.name, jenis: f.type, isi: Array.from(new Uint8Array(await f.arrayBuffer())) }; };
  });
  const p4 = await ctx4.newPage();
  p4.on('pageerror', e => galat.push(e.message));
  await pasang(p4);
  await masuk(p4);
  await p4.click('#kotak-ringkas .tombol-slip');
  await p4.evaluate(() => [...document.querySelectorAll('input[name="slip-siapa"]')][1].closest('label').click());
  await p4.waitForSelector('[data-aksi="gambar"]');
  assert.strictEqual(await p4.$('[data-aksi="rawbt"]'), null, 'iPhone: tidak ada tombol RawBT');
  assert.ok(/aplikasi printer thermal/.test(await p4.textContent('.slip-printer')));
  await p4.evaluate(() => [...document.querySelectorAll('input[name="slip-kertas"]')].find(x => x.value === '80').closest('label').click());
  await p4.click('[data-aksi="gambar"]');
  await p4.waitForFunction(() => window.__dibagikan);
  const dib = await p4.evaluate(() => window.__dibagikan);
  const png4 = Buffer.from(dib.isi);
  assert.ok(dib.jenis === 'image/png' && /^slip-upah-.+\.png$/.test(dib.nama) && png4.readUInt32BE(16) === 576, 'iPhone: PNG 576 titik (80 mm) dibagikan: ' + dib.nama);
  fs.writeFileSync(path.join(OUT, 'slip-gambar.png'), png4);
  await p4.screenshot({ path: path.join(OUT, 'slip-iphone.png') });
  cek('iPhone: tanpa RawBT, gambar slip dibagikan ke aplikasi printer (PNG selebar kertas)');
  await ctx4.close();

  // ---- Chrome di Android tanpa APK: RawBT dan gambar slip
  const ctx5 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36' });
  const p5 = await ctx5.newPage();
  p5.on('pageerror', e => galat.push(e.message));
  await pasang(p5);
  await masuk(p5);
  await p5.click('#kotak-ringkas .tombol-slip');
  await p5.waitForSelector('[data-aksi="rawbt"]');
  assert.ok(await p5.$('[data-aksi="gambar"]'), 'Android: ada juga gambar slip');
  cek('Chrome Android: RawBT dan gambar slip');
  await ctx5.close();

  // ---- APK lama (1.0.4, belum bisa memilih): satu tombol WhatsApp + saran pasang APK terbaru
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 CatatanSembadaApp' });
  await ctx3.addInitScript(() => { window.SembadaPrinter = { status: () => '{"ada":true,"izin":true,"nyala":true}', daftar: () => '[]', mintaIzin() {}, cetak() {} }; });
  const p3 = await ctx3.newPage();
  p3.on('pageerror', e => galat.push(e.message));
  await pasang(p3);
  await masuk(p3);
  await p3.click('#kotak-ringkas .tombol-slip');
  await p3.evaluate(() => [...document.querySelectorAll('input[name="slip-siapa"]')][1].closest('label').click());
  await p3.waitForSelector('.slip-wa [data-aksi="wa"]');
  assert.strictEqual((await p3.$$('.slip-wa [data-aksi="wa"]')).length, 1);
  assert.ok(/APK Sembada terbaru/.test(await p3.textContent('.slip-wa')));
  cek('APK lama: satu tombol WhatsApp dan saran pasang APK terbaru');
  await ctx3.close();
  await ctx2.close();

  await browser.close();
  assert.deepStrictEqual(galat, [], 'galat di halaman');
  console.log('Uji slip upah lulus.');
})().catch(e => { console.error(e); process.exit(1); });
