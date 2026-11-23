// Uji Data supplier: tambah (nama dari kotak cari), cari kata apa saja (nama, barang, No HP tanpa tanda hubung,
// alamat, catatan) dengan sorotan, saring per barang, rincian + pilihan WhatsApp, ubah, hapus.
// Jalankan: node tes/suplier_test.js
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
const namaKartu = page => page.$$eval('#daftar-suplier .kartu-suplier h3 > span', s => s.map(x => x.textContent.trim()));
async function tambah(page, n) {
  await page.click('#suplier-tambah');
  await page.waitForSelector('.tirai [name=s0]');
  await isi(page, '.tirai [name=s0]', n.nama);
  for (const b of n.barang) {
    const ada = await page.$('.tirai input[name=s1][value="' + b + '"]');
    if (ada) await pilihChip(page, 's1', b);
    else {
      await page.evaluate(() => { const i = [...document.querySelectorAll('.tirai input[name=s1]')].find(x => x.value === '__lain'); i.closest('label').click(); });
      await isi(page, '.tirai #s1_lt', b);
    }
  }
  if (n.hp) await isi(page, '.tirai [name=s2]', n.hp);
  if (n.alamat) await isi(page, '.tirai [name=s3]', n.alamat);
  if (n.catatan) await isi(page, '.tirai [name=s4]', n.catatan);
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai .rinci-kepala');
  await page.click('.tirai [data-aksi="tutup"]');
  await page.waitForFunction(() => !document.querySelector('.tirai'));
}

(async () => {
  const browser = await chromium.launch();
  const galat = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  page.on('pageerror', e => galat.push(e.message));
  await pasang(page);
  await page.goto(ASAL);
  await page.waitForSelector('#form-masuk');
  await page.fill('#pengguna', 'wildan');
  await page.fill('#sandi', '250610');
  await page.click('#form-masuk button[type=submit]');
  await page.waitForSelector('.tombol-suplier');
  await page.click('.tombol-suplier');
  await page.waitForSelector('#suplier-tambah');
  assert.ok(/Belum ada supplier/.test(await page.textContent('#isi-suplier')));

  // Tambah: nama terisi dari kotak cari; barang lebih dari satu & barang lain (Lainnya); wajib & No HP dicek.
  await page.fill('#suplier-cari', 'Pak Darmo');
  await page.click('#suplier-tambah');
  await page.waitForSelector('.tirai [name=s0]');
  assert.strictEqual(await page.inputValue('.tirai [name=s0]'), 'Pak Darmo');
  await isi(page, '.tirai [name=s2]', '0813');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai .bidang.salah[data-h="Supplier apa"]');
  assert.ok(await page.$('.tirai .bidang.salah[data-h="No HP"]'), 'No HP pendek ditolak');
  await pilihChip(page, 's1', 'Kayu bakar');
  await pilihChip(page, 's1', 'Bahan jeruk purut');
  await isi(page, '.tirai [name=s2]', '0813-1111-2222');
  await isi(page, '.tirai [name=s3]', 'Ngunut, Tulungagung');
  await isi(page, '.tirai [name=s4]', 'Kayu jati sisa, Rp350rb per rit, kirim tiap Kamis');
  await page.screenshot({ path: path.join(OUT, 'suplier-form.png'), fullPage: true });
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai .rinci-kepala');
  const rinci = await page.textContent('.tirai');
  assert.ok(/Pak Darmo/.test(rinci) && /Bahan jeruk purut, Kayu bakar/.test(rinci) && /No HP \/ WA\s*0813-1111-2222\s*Chat WhatsApp/.test(rinci), rinci);
  const t = await page.$$eval('.tirai .aksi-kontak a', as => as.map(a => a.textContent.trim() + '=' + a.getAttribute('href')));
  assert.ok(t.includes('Telepon=tel:081311112222') && t.some(x => /^Peta=https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Ngunut/.test(x)), t.join(' | '));
  await page.click('.tirai [data-aksi="wa-pilih"]');
  await page.waitForSelector('.tirai .pilih-wa');
  const pil = await page.$$eval('.tirai .pilih-wa a', as => as.map(a => a.getAttribute('href')));
  assert.deepStrictEqual(pil, ['intent://send?phone=6281311112222&text=#Intent;scheme=whatsapp;package=com.whatsapp;end',
    'intent://send?phone=6281311112222&text=#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end']);
  await page.screenshot({ path: path.join(OUT, 'suplier-rinci.png') });
  await page.locator('.tirai').last().locator('[data-aksi="tutup"]').click();
  await page.click('.tirai [data-aksi="tutup"]');
  const sp = objek('Data Supplier');
  assert.deepStrictEqual([sp.length, sp[0]['Nama'], sp[0]['Supplier apa'], sp[0]['No HP']], [1, 'Pak Darmo', 'Bahan jeruk purut, Kayu bakar', '0813-1111-2222']);
  cek('tambah supplier: nama dari kotak cari, barang lebih dari satu, rincian dengan Telepon/Peta/Chat WhatsApp');

  await page.fill('#suplier-cari', '');
  await tambah(page, { nama: 'Toko Plastik Makmur', barang: ['Jeriken / kemasan'], hp: '0857 2222 3333', alamat: 'Pasar Ngemplak, Tulungagung', catatan: 'jeriken 20 liter Rp35rb' });
  await tambah(page, { nama: 'Bu Sri', barang: ['Bahan jeruk purut', 'Daun jeruk kering'], hp: '+62 812 4444 5555', alamat: 'Bangunsari, Trenggalek' });
  await tambah(page, { nama: 'Bengkel Las Lukman', barang: ['Alat & perbaikan'], alamat: 'Sukorejo' });
  assert.deepStrictEqual(await namaKartu(page), ['Bengkel Las Lukman', 'Bu Sri', 'Pak Darmo', 'Toko Plastik Makmur'], 'urut nama');
  assert.ok(await page.$('input[name="suplier-saring"][value="Daun jeruk kering"]'), 'barang dari Lainnya jadi pilihan saring');
  cek('beberapa supplier; barang dari "Lainnya" ikut jadi pilihan');

  // Cari kata apa saja + sorotan
  const cari = async (kata, harap) => {
    await page.fill('#suplier-cari', kata);
    await page.waitForFunction(n => document.querySelectorAll('#daftar-suplier .kartu-suplier').length === n, harap.length);
    assert.deepStrictEqual(await namaKartu(page), harap, 'cari "' + kata + '"');
  };
  await cari('tulungagung', ['Pak Darmo', 'Toko Plastik Makmur']);            // alamat
  assert.strictEqual(await page.$$eval('#daftar-suplier mark', m => m.map(x => x.textContent).join('|')), 'Tulungagung|Tulungagung');
  await cari('jeriken', ['Toko Plastik Makmur']);                              // barang + catatan
  await cari('kamis', ['Pak Darmo']);                                          // catatan
  await cari('08131111', ['Pak Darmo']);                                       // No HP tanpa tanda hubung
  await cari('4444 5555', ['Bu Sri']);                                         // No HP dengan spasi
  await cari('BAHAN', ['Bu Sri', 'Pak Darmo']);                                // huruf besar
  await cari('bahan trenggalek', ['Bu Sri']);                                  // semua kata harus ada
  await cari('lukman', ['Bengkel Las Lukman']);
  assert.ok(/Menampilkan 1 dari 4 supplier/.test(await page.textContent('#daftar-suplier')));
  await page.fill('#suplier-cari', 'semen');
  await page.waitForFunction(() => /Tidak ada supplier yang cocok dengan "semen"/.test(document.getElementById('daftar-suplier').textContent));
  await page.fill('#suplier-cari', 'kayu');
  await page.waitForFunction(() => document.querySelectorAll('#daftar-suplier mark').length >= 2);
  await page.screenshot({ path: path.join(OUT, 'suplier-cari.png'), fullPage: true });
  await page.fill('#suplier-cari', '');
  cek('cari kata apa saja: nama, barang, alamat, catatan, No HP (tanpa/ dengan spasi), huruf besar/kecil, beberapa kata; kata disorot');

  // Saring per barang (bersama pencarian)
  await pilihChip(page, 'suplier-saring', 'Bahan jeruk purut');
  await page.waitForFunction(() => document.querySelectorAll('#daftar-suplier .kartu-suplier').length === 2);
  await page.fill('#suplier-cari', 'ngunut');
  await page.waitForFunction(() => document.querySelectorAll('#daftar-suplier .kartu-suplier').length === 1);
  await page.fill('#suplier-cari', '');
  await pilihChip(page, 'suplier-saring', '');
  await page.waitForFunction(() => document.querySelectorAll('#daftar-suplier .kartu-suplier').length === 4);
  cek('saring per barang, bisa digabung dengan pencarian');

  // WA dari kartu (tanpa membuka rincian), ubah, hapus
  await page.click('[data-suplier] [data-wa]');
  await page.waitForSelector('.tirai .pilih-wa');
  assert.strictEqual((await page.$$('.tirai')).length, 1);
  await page.click('.tirai [data-aksi="tutup"]');
  const idDarmo = objek('Data Supplier').find(x => x['Nama'] === 'Pak Darmo')['ID'];
  await page.click('[data-suplier="' + idDarmo + '"] h3');
  await page.click('.tirai [data-aksi="ubah"]');
  await page.waitForSelector('.tirai [name=s0]');
  assert.ok(await page.$eval('.tirai input[name=s1][value="Kayu bakar"]', x => x.checked) && await page.$eval('.tirai input[name=s1][value="Bahan jeruk purut"]', x => x.checked));
  await pilihChip(page, 's1', 'Bahan jeruk purut');
  await isi(page, '.tirai [name=s4]', 'Rp375rb per rit mulai Desember');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForSelector('.tirai .rinci-kepala');
  assert.ok(/Rp375rb/.test(await page.textContent('.tirai')));
  assert.deepStrictEqual([objek('Data Supplier').length, objek('Data Supplier').find(x => x['ID'] === idDarmo)['Supplier apa']], [4, 'Kayu bakar']);
  await page.click('.tirai [data-aksi="hapus"]');
  await page.waitForFunction(() => document.querySelectorAll('.tirai').length === 2);
  await page.locator('.tirai').last().locator('[data-aksi="hapus"]').click();
  await page.waitForFunction(() => !document.querySelector('.tirai') && document.querySelectorAll('#daftar-suplier .kartu-suplier').length === 3);
  assert.ok(!objek('Data Supplier').some(x => x['Nama'] === 'Pak Darmo'));
  cek('WhatsApp dari kartu; ubah barang & catatan; hapus');

  // Beranda menampilkan jumlah supplier; layar lebar tidak bisa digeser ke samping
  await page.goto(ASAL + '#/');
  await page.waitForSelector('.tombol-suplier');
  assert.ok(/3 supplier/.test(await page.textContent('.tombol-suplier')));
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(ASAL + '#/suplier');
    await page.waitForSelector('#daftar-suplier .kartu-suplier');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1, 'tidak bisa digeser ke samping di ' + w);
  }
  await page.screenshot({ path: path.join(OUT, 'suplier-lebar.png') });

  assert.deepStrictEqual(galat, [], 'tidak ada galat di halaman');
  await browser.close();
  console.log('Uji data supplier lulus.');
})().catch(e => { console.error(e); process.exit(1); });
