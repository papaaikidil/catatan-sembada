// Uji tampilan layar lebar (tablet landscape, tablet tegak, HP landscape) dan HP tegak.
// Memeriksa: tidak ada gulir ke samping, navigasi pindah ke samping, tata letak dua kolom. Gambar layar ke OUT.
// Jalankan: node tes/lebar_test.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { muat } = require('./tiruan7');
const { buatData } = require('./data_sembada');

const ASAL = 'https://papaaikidil.github.io/catatan-sembada/';
const API = 'https://script.google.com/macros/s/TES-SEMBADA/exec';
const OUT = process.env.OUT || '/tmp/sembada-lebar';
const DOCS = path.join(__dirname, '..', 'docs');
fs.mkdirSync(OUT, { recursive: true });

const server = muat(buatData());

async function pasang(page) {
  await page.route(API + '**', async route => {
    const req = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(server.panggil(req)) });
  });
  await page.route(ASAL + '**', async route => {
    const url = new URL(route.request().url());
    const f = url.pathname.replace('/catatan-sembada/', '') || 'index.html';
    if (f === 'config.js') return route.fulfill({ contentType: 'application/javascript', body: `window.SEMBADA_CONFIG={API_URL:'${API}',VERSI:'tes'};` });
    const p = path.join(DOCS, f);
    if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'tidak ada' });
    const jenis = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(p)] || 'application/octet-stream';
    await route.fulfill({ contentType: jenis, body: fs.readFileSync(p) });
  });
}

const UKURAN = [
  { nama: 'tablet-landscape', width: 1280, height: 800, rail: true, duaKolom: true },
  { nama: 'tablet-tegak', width: 800, height: 1280, rail: true, duaKolom: false },
  { nama: 'hp-landscape', width: 880, height: 400, rail: true, duaKolom: false },
  { nama: 'hp-tegak', width: 390, height: 844, rail: false, duaKolom: false }
];

async function tanpaGeserSamping(page, layar) {
  const lebih = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(lebih <= 1, layar + ': halaman bisa digeser ke samping ' + lebih + 'px');
}

(async () => {
  const browser = await chromium.launch();
  const galat = [];
  for (const u of UKURAN) {
    console.log(u.nama + ' (' + u.width + 'x' + u.height + ')');
    const context = await browser.newContext({ viewport: { width: u.width, height: u.height }, deviceScaleFactor: 1.5, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    const page = await context.newPage();
    page.on('pageerror', e => galat.push(u.nama + ': ' + e.message));
    page.on('dialog', d => d.accept());
    await pasang(page);
    const foto = async (n, penuh) => { await tanpaGeserSamping(page, u.nama + '/' + n); await page.screenshot({ path: path.join(OUT, u.nama + '-' + n + '.png'), fullPage: !!penuh }); };

    await page.goto(ASAL);
    await page.waitForSelector('#form-masuk');
    await foto('00-masuk');
    await page.fill('#pengguna', 'wildan');
    await page.fill('#sandi', '250610');
    await page.click('#form-masuk button[type=submit]');
    await page.waitForSelector('#kotak-ringkas .angka-grid');
    await page.waitForSelector('#kotak-ringkas .kartu-stok');

    // Navigasi: samping di layar lebar, bawah di HP tegak
    const nav = await page.$eval('.nav', n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    if (u.rail) assert.ok(nav.x === 0 && nav.y === 0 && nav.w < 120 && nav.h >= u.height - 1, 'navigasi di samping: ' + JSON.stringify(nav));
    else assert.ok(nav.y > u.height - 100 && nav.w === u.width, 'navigasi di bawah: ' + JSON.stringify(nav));

    // Beranda: ringkasan di kiri, tombol catatan di kanan (hanya layar lebar sekali)
    const posisi = await page.evaluate(() => {
      const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width }; };
      return { ringkas: r('.kartu-ringkas'), stok: r('.kartu-stok'), catat: r('.bagian-catat') };
    });
    if (u.duaKolom) {
      assert.ok(posisi.catat.x > posisi.ringkas.x + posisi.ringkas.w - 1, 'tombol catatan di kanan ringkasan: ' + JSON.stringify(posisi));
      assert.ok(posisi.stok.x > posisi.ringkas.x + 100, 'stok di kolom kanan');
    } else {
      assert.ok(posisi.catat.y > posisi.ringkas.y, 'tombol catatan di bawah ringkasan');
    }
    await foto('01-beranda', true);

    // Rincian kotak angka (dialog)
    await page.click('#kotak-ringkas .angka[data-angka="penjualan"]');
    await page.waitForSelector('.tirai .lembar');
    await foto('02-rincian');
    await page.click('.tirai', { position: { x: 5, y: 5 } });
    await page.waitForFunction(() => !document.querySelector('.tirai'));

    await page.click('.nav a[href="#/ringkasan"]');
    await page.waitForSelector('.tata-ringkasan .kartu-minggu');
    await page.waitForTimeout(300);
    if (u.duaKolom) {
      const r = await page.evaluate(() => {
        const b = s => document.querySelector(s).getBoundingClientRect();
        return { minggu: b('.kartu-minggu'), stok: b('.tata-ringkasan .kartu-stok'), bulan: b('.kartu-bulan'), per: b('.bagian-peringatan') };
      });
      assert.ok(r.stok.x > r.minggu.x + r.minggu.width - 1 && r.per.x === r.stok.x, 'stok & peringatan di kolom kanan: ' + JSON.stringify(r));
      assert.ok(r.bulan.x === r.minggu.x && r.bulan.y > r.minggu.y && r.per.y > r.stok.y, 'Bulan di bawah Minggu, peringatan di bawah stok');
    } else {
      const y = await page.evaluate(() => ['.kartu-stok', '.kartu-minggu', '.kartu-bulan', '.bagian-peringatan'].map(s => document.querySelector('.tata-ringkasan ' + s).getBoundingClientRect().y));
      assert.ok(y[0] < y[1] && y[1] < y[2] && y[2] < y[3], 'urutan satu kolom: stok, minggu, bulan, peringatan');
    }
    await foto('03-ringkasan', true);

    await page.click('.nav a[href="#/terbaru"]');
    await page.waitForSelector('#daftar-entri .kartu');
    await page.click('.pilih-tab button[data-ke="#/terbaru/absensi"]');
    await page.waitForSelector('#daftar-entri .kartu .baris-entri');
    await foto('04-riwayat-absensi', true);

    await page.click('.nav a[href="#/kelola"]');
    await page.waitForSelector('.kisi-menu');
    await foto('05-kelola', true);

    await page.click('.nav a[href="#/akun"]');
    await page.waitForSelector('.tata-akun');
    await foto('06-akun');

    await page.goto(ASAL + '#/isi/ambil');
    await page.waitForSelector('.form-isi');
    if (u.width >= 760) {
      const k = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.form-isi > .bidang')].map(e => e.getBoundingClientRect());
        return { kiri: b[0].x, kanan: b[1].x, lebarKet: document.querySelector('.form-isi > .bidang-lebar').getBoundingClientRect().width, lebarForm: document.querySelector('.form-isi').getBoundingClientRect().width };
      });
      assert.ok(k.kanan > k.kiri + 100, 'formulir dua kolom: ' + JSON.stringify(k));
      assert.ok(k.lebarKet > k.lebarForm * 0.85, 'keterangan selebar formulir');
    }
    await foto('07-form-ambil', true);

    await page.goto(ASAL + '#/isi/laporan');
    await page.waitForSelector('.form-isi .masukan-jam');
    const lebihLap = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(lebihLap <= 1, 'formulir Laporan Suling tidak bisa digeser ke samping: ' + lebihLap);
    await foto('07b-form-laporan', true);

    await page.goto(ASAL + '#/isi/absensi');
    await page.waitForSelector('.form-isi .baris-kisi');
    await foto('08-form-absensi', true);
    await page.click('#tombol-simpan');
    await page.waitForTimeout(300);
    await foto('09-form-salah');

    await page.goto(ASAL + '#/batas');
    await page.waitForSelector('#form-batas .kartu');
    await foto('10-batas', true);

    await page.goto(ASAL + '#/tampilan');
    await page.waitForSelector('.isi .kartu');
    await foto('11-tampilan');
    await context.close();
  }
  await browser.close();
  assert.deepStrictEqual(galat, [], 'galat di halaman');
  console.log('Semua ukuran layar lulus. Gambar di ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
