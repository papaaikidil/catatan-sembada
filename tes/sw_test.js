// Uji service worker: aplikasi dibuka dari salinan di HP (cepat, tanpa sinyal pun bisa),
// versi baru diambil di belakang lalu ditawarkan lewat "Versi baru aplikasi sudah siap".
// Jalankan: node tes/sw_test.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs');
let tambahan = '';          // diselipkan ke app.js untuk meniru versi baru
let jumlahMinta = 0;
let lambatMs = 0;           // meniru sinyal lambat

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let f = url.pathname.replace(/^\/catatan-sembada\//, '') || 'index.html';
  if (f === '' || f.endsWith('/')) f = 'index.html';
  const kirim = () => {
    jumlahMinta++;
    if (f === 'config.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end("window.SEMBADA_CONFIG={API_URL:'',VERSI:'tes'};"); }
    const p = path.join(DOCS, f);
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end('tidak ada'); }
    let isi = fs.readFileSync(p);
    if (f === 'app.js') isi = Buffer.concat([isi, Buffer.from(tambahan)]);
    const jenis = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': jenis, 'Cache-Control': 'no-cache' });
    res.end(isi);
  };
  if (lambatMs) setTimeout(kirim, lambatMs); else kirim();
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const ASAL = 'http://localhost:' + server.address().port + '/catatan-sembada/';
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const galat = [];
  page.on('pageerror', e => galat.push(e.message));

  // 1. Kunjungan pertama: service worker terpasang dan menyimpan aplikasi.
  await page.goto(ASAL);
  await page.waitForSelector('#form-masuk');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller || (location.reload(), false), null, { timeout: 10000 }).catch(() => {});
  await page.reload();
  await page.waitForSelector('#form-masuk');
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'halaman dikendalikan service worker');
  console.log('  ✓ service worker terpasang');

  // 2. Sinyal sangat lambat: aplikasi tetap langsung terbuka dari salinan.
  lambatMs = 8000;
  const t0 = Date.now();
  await page.reload();
  await page.waitForSelector('#form-masuk');
  const lama = Date.now() - t0;
  assert.ok(lama < 3000, 'terbuka dari salinan tanpa menunggu sinyal (' + lama + ' ms)');
  console.log('  ✓ sinyal lambat (8 detik per berkas): aplikasi tetap terbuka dalam ' + lama + ' ms');
  lambatMs = 0;
  await page.waitForTimeout(300);

  // 3. Tanpa sinyal sama sekali: tetap terbuka.
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#form-masuk');
  await context.setOffline(false);
  console.log('  ✓ tanpa sinyal: aplikasi tetap terbuka');

  // 4. Ada versi baru di GitHub: dibuka dulu dari salinan, lalu tawaran "Versi baru" muncul; diketuk = versi baru dipakai.
  await page.reload();
  await page.waitForSelector('#form-masuk');
  await page.waitForTimeout(500);
  assert.strictEqual(await page.$('#versi-baru'), null, 'tidak ada tawaran kalau tidak ada yang berubah');
  tambahan = '\nwindow.__versiUji = 2;\n';
  await page.reload();
  await page.waitForSelector('#form-masuk');
  assert.strictEqual(await page.evaluate(() => window.__versiUji), undefined, 'masih versi lama dari salinan');
  await page.waitForSelector('#versi-baru', { timeout: 8000 });
  await page.screenshot({ path: '/tmp/sembada-layar/sw-versi-baru.png' });
  await Promise.all([page.waitForNavigation(), page.click('#versi-baru .tombol')]);
  await page.waitForSelector('#form-masuk');
  assert.strictEqual(await page.evaluate(() => window.__versiUji), 2, 'versi baru dipakai setelah diketuk');
  console.log('  ✓ versi baru diambil di belakang, ditawarkan, dan dipakai setelah diketuk');

  assert.deepStrictEqual(galat, []);
  await browser.close();
  server.close();
  console.log('Uji service worker lulus.');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
