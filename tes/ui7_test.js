// Uji alur aplikasi (versi 3, API 7) di browser HP dengan api.gs asli di atas Google Sheet tiruan.
// Jalankan: node tes/ui7_test.js   (gambar layar disimpan di folder OUT)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { muat, formatTanggal } = require('./tiruan7');
const { buatData, isoHari } = require('./data_sembada');

const ASAL = 'https://papaaikidil.github.io/catatan-sembada/';
const API = 'https://script.google.com/macros/s/TES-SEMBADA/exec';
const OUT = process.env.OUT || '/tmp/sembada-layar';
const DOCS = path.join(__dirname, '..', 'docs');
fs.mkdirSync(OUT, { recursive: true });

const sheets = buatData();
const server = muat(sheets);
server.ctx.urutkanTab_ = sh => {
  const info = server.ctx.kolomForm_(sh);
  const akhir = sh.getLastRow();
  if (akhir >= 3) sh.getRange(2, 2, akhir - 1, info.kepala.length).sort([{ column: 3, ascending: false }, { column: 2, ascending: false }]);
};
const hariIni = isoHari(0), kemarin = isoHari(-1);
let jaringanMati = false;

const objek = n => { const sh = sheets[n]; const k = sh.data[0]; return sh.data.slice(1).filter(r => r.some(v => v !== '' && v !== undefined)).map(r => Object.fromEntries(k.map((h, j) => [h, r[j] === undefined ? '' : r[j]]))); };
const iso = d => formatTanggal(d, 'yyyy-MM-dd');
const tunggu = ms => new Promise(r => setTimeout(r, ms));
let langkah = 0;
const cek = (nama) => { langkah++; console.log('  ✓ ' + nama); };

async function pasang(page) {
  await page.route(API + '**', async route => {
    if (jaringanMati) return route.abort('internetdisconnected');
    const req = JSON.parse(route.request().postData() || '{}');
    const body = server.panggil(req);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route(ASAL + '**', async route => {
    const url = new URL(route.request().url());
    let f = url.pathname.replace('/catatan-sembada/', '') || 'index.html';
    if (f === 'config.js') return route.fulfill({ contentType: 'application/javascript', body: `window.SEMBADA_CONFIG={API_URL:'${API}',VERSI:'tes'};` });
    const p = path.join(DOCS, f);
    if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'tidak ada' });
    const jenis = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(p)] || 'application/octet-stream';
    await route.fulfill({ contentType: jenis, body: fs.readFileSync(p) });
  });
}

async function foto(page, nama, penuh) { await page.screenshot({ path: path.join(OUT, nama + '.png'), fullPage: !!penuh }); }
async function pilih(page, nama, nilai, akar) {
  const ok = await page.evaluate(([n, v, a]) => {
    const wadah = a ? document.querySelector(a) : document;
    const i = [...wadah.querySelectorAll('input[name="' + n + '"]')].find(x => x.value === v);
    if (!i) return false;
    i.closest('label').click();
    return true;
  }, [nama, nilai, akar || '']);
  assert.ok(ok, 'pilihan tidak ada: ' + nama + '=' + nilai);
}
async function isi(page, sel, nilai) { await page.fill(sel, ''); await page.fill(sel, String(nilai)); }
async function simpanDanKonfirmasi(page) {
  await page.click('#tombol-simpan');
  await page.waitForSelector('.tirai [data-aksi="kirim"]');
  await foto(page, 'konfirmasi-' + langkah);
  await page.click('.tirai [data-aksi="kirim"]');
  await page.waitForFunction(() => location.hash === '#/');
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('sembada7.antrian') || '[]').length, null, { timeout: 8000 });
}
// Gambar PNG polos 40x30 untuk uji unggah logo.
function pngPolos(w, h) {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const potong = (jenis, data) => { const pj = Buffer.alloc(4); pj.writeUInt32BE(data.length); const jd = Buffer.concat([Buffer.from(jenis), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(jd)); return Buffer.concat([pj, jd, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const baris = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [200, 120, 30]).flat())])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), potong('IHDR', ihdr), potong('IDAT', zlib.deflateSync(baris)), potong('IEND', Buffer.alloc(0))]);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await context.newPage();
  const galatHalaman = [];
  page.on('pageerror', e => galatHalaman.push(e.message));
  page.on('console', m => { if (m.type() === 'error') galatHalaman.push(m.text()); });
  page.on('dialog', d => d.accept());
  await pasang(page);

  console.log('Dari aplikasi versi lama');
  // HP yang sebelumnya memakai versi 2 (PIN) dan masih punya 1 absensi belum terkirim.
  await page.goto(ASAL + 'tidak-ada');
  await page.evaluate(([tgl]) => {
    localStorage.setItem('sembada.sesi', JSON.stringify({pin: '250610', nama: 'Mas Wildan'}));
    localStorage.setItem('sembada.antrian', JSON.stringify([{id: 'lama1', tab: 'Absensi', waktu: Date.now(), status: 'galat', galat: 'PIN salah',
      nilai: {'Tanggal': tgl, 'Keterangan': 'dari HP lama', baris: [{nama: 'Rofik', pekerjaan: '2 trip', alat: '', upah: 0}]}}]));
    localStorage.setItem('kepuh.sesi', '{"token":"punya-kepuh"}');
  }, [isoHari(-6)]);
  await page.goto(ASAL);
  await page.waitForSelector('#form-masuk');
  const sisa = await page.evaluate(() => Object.keys(localStorage).sort());
  assert.ok(!sisa.some(k => k.indexOf('sembada.') === 0), 'data versi lama (termasuk PIN) dihapus: ' + sisa);
  assert.ok(sisa.includes('kepuh.sesi'), 'data Catatan Sembada Kepuh di alamat yang sama tidak disentuh');
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sembada7.antrian')).length), 1);
  await foto(page, '01-masuk');
  cek('antrian versi lama dipindahkan, PIN lama dihapus, data Kepuh tidak tersentuh');

  console.log('Masuk');
  await isi(page, '#pengguna', 'wildan');
  await isi(page, '#sandi', '1234');
  await page.click('#form-masuk button[type=submit]');
  await page.waitForSelector('.galat-kartu');
  await isi(page, '#sandi', '250610');
  await page.click('#form-masuk button[type=submit]');
  await page.waitForSelector('.grid-catatan');
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('sembada7.antrian') || '[]').length);
  assert.ok(objek('Absensi Harian').some(a => a['Keterangan'] === 'dari HP lama' && a['Pekerjaan'] === '2 trip'), 'absensi dari HP lama terkirim');
  const menu = await page.$$eval('.tombol-catatan b', bs => bs.map(b => b.textContent));
  assert.deepStrictEqual(menu, ['Ambil Bahan', 'Produksi Suling', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas']);
  await page.waitForSelector('#kotak-ringkas .angka-grid');
  await foto(page, '02-beranda', true);
  cek('masuk dengan nama pengguna + PIN lama sebagai sandi; antrian lama terkirim');

  console.log('Produksi suling');
  await page.goto(ASAL + '#/isi/suling');
  await page.waitForSelector('.kisi-alat');
  assert.strictEqual(await page.locator('.kisi-alat').count(), 1);
  assert.ok(/1x Rp90\.000 · 2x Rp180\.000 · 3x Rp295\.000/.test(await page.textContent('.kisi-judul')), await page.textContent('.kisi-judul'));
  await pilih(page, 'b1_a0_n', '2');
  assert.strictEqual(await page.$eval('input[name="b1_a0_op"]:checked', e => e.value), 'Eko & Pak Gatot', 'operator tetap terpilih otomatis');
  await page.waitForSelector('#pratinjau:not([hidden])');
  assert.ok(/180\.000/.test(await page.textContent('#pratinjau')));
  await foto(page, '03-produksi', true);
  await simpanDanKonfirmasi(page);
  const ps = objek('Produksi Suling');
  assert.strictEqual(ps.length, 1); assert.strictEqual(ps[0]['Upah (Rp)'], 180000); assert.strictEqual(ps[0]['Kondisi alat'], 'Normal');
  assert.strictEqual(ps[0]['Diisi oleh'], 'Mas Wildan');
  cek('produksi suling: upah dari tarif 2x suling');

  console.log('Absensi');
  await page.goto(ASAL + '#/isi/absensi');
  await page.waitForSelector('.baris-kisi');
  const judulTim = await page.$$eval('.kelompok-judul span', s => s.map(x => x.textContent));
  assert.deepStrictEqual(judulTim, ['Pengumpul · 3 orang', 'Tim suling · 1 orang']);
  const opsiSuling = await page.$$eval('.baris-kisi[data-peran="Tim suling"] input', i => i.map(x => x.value));
  assert.ok(opsiSuling.includes('Nyuling (upah dari produksi)') && !opsiSuling.includes('2x suling') && !opsiSuling.includes('Kerja lain'), opsiSuling.join());
  await page.click('[data-isi-semua="Pengumpul"]');
  await page.click('[data-isi-semua="Tim suling"]');
  const namaOrang = await page.evaluate(() => JSON.parse(localStorage.getItem('sembada7.konfig')).master.Karyawan.filter(k => k.aktif).map(k => k.nilai.Nama));
  const j = n => namaOrang.indexOf(n);
  await pilih(page, 'b1_o' + j('Mas Romadi'), 'Harian kenek');
  await pilih(page, 'b2_ada', 'Ya');
  await isi(page, '[name=b2_kerja]', 'Tambal kolam');
  await pilih(page, 'b2_siapa', 'Pak Muh');
  await page.click('#tombol-simpan');
  await page.waitForSelector('.bidang-kerja-lain.salah');
  assert.ok(/untuk apa/.test(await page.textContent('.bidang-kerja-lain .pesan-salah')));
  await pilih(page, 'b2_untuk', 'Proyek bangunan & lainnya');
  await isi(page, '[name=b2_u' + j('Pak Muh') + ']', '50000');
  await foto(page, '04-absensi', true);
  await simpanDanKonfirmasi(page);
  const ah = objek('Absensi Harian').filter(a => iso(a['Tanggal']) === hariIni);
  assert.strictEqual(ah.find(a => a.Nama === 'Rofik')['Upah (Rp)'], 76000);
  assert.strictEqual(ah.find(a => a.Nama === 'Mas Romadi')['Pekerjaan'], 'Harian kenek');
  const kl = ah.find(a => a.Nama === 'Pak Muh' && a['Pekerjaan'] === 'Kerja lain');
  assert.strictEqual(kl['Upah (Rp)'], 50000); assert.strictEqual(kl['Kerja lain untuk'], 'Proyek bangunan & lainnya'); assert.strictEqual(kl['Pos upah'], 'Harian & lain');
  assert.strictEqual(ah.find(a => a.Nama === 'Eko & Pak Gatot')['Pekerjaan'], 'Nyuling (upah dari produksi)');
  assert.strictEqual(ah.length, 5);
  cek('absensi semua karyawan sekaligus, kerja lain dengan "untuk"');

  console.log('Ambil bahan, saring, penjualan, kas');
  await page.goto(ASAL + '#/isi/ambil');
  await page.waitForSelector('#formulir');
  await pilih(page, 'b1', 'Rofik');
  await pilih(page, 'b1', 'Mas Romadi');
  await pilih(page, 'b2', 'Tanen');
  await pilih(page, 'b3', 'Segar semua');
  await isi(page, '[name=b4]', '1.075');
  await isi(page, '[name=b5]', '550000');
  await isi(page, '[name=b6]', '40000');
  await simpanDanKonfirmasi(page);
  const ab = objek('Ambil Bahan')[0];
  assert.strictEqual(ab['Berat bahan (kg)'], 1075); assert.strictEqual(ab['Pengumpul'], 'Rofik, Mas Romadi'); assert.strictEqual(ab['Biaya lain di jalan (Rp)'], 0);
  await page.goto(ASAL + '#/isi/saring');
  await page.waitForSelector('#formulir');
  await isi(page, '[name=b1]', '2');
  await isi(page, '[name=b2]', '3,4');
  await pilih(page, 'b4', 'Segar semua');
  await pilih(page, 'b5', 'Normal');
  await simpanDanKonfirmasi(page);
  const sm = objek('Saring Minyak')[0];
  assert.strictEqual(sm['Minyak (kg)'], 3.4); assert.strictEqual(sm['Kondisi alat'], 'Normal');
  await page.goto(ASAL + '#/isi/jual');
  await page.waitForSelector('#formulir');
  await pilih(page, 'b1', 'Lusiani');
  await pilih(page, 'b2', 'Minyak jeruk purut (campur)');
  assert.strictEqual(await page.inputValue('[name=b4]'), '600000', 'harga biasa terisi otomatis');
  await isi(page, '[name=b3]', '10');
  await pilih(page, 'b5', 'Lunas');
  await simpanDanKonfirmasi(page);
  assert.strictEqual(objek('Penjualan')[0]['Jumlah'], 10);
  await page.goto(ASAL + '#/isi/kas');
  await page.waitForSelector('#formulir');
  await page.selectOption('[name=b1]', 'Bensin & servis pikap');
  await isi(page, '[name=b2]', '150000');
  await isi(page, '[name=b3]', 'bensin grandmax');
  await simpanDanKonfirmasi(page);
  assert.strictEqual(objek('Kas')[0]['Kategori'], 'Bensin & servis pikap');
  cek('ambil bahan, saring minyak, penjualan (harga otomatis), kas');

  console.log('Ringkasan & riwayat');
  await page.goto(ASAL + '#/ringkasan');
  await page.waitForSelector('.daftar-baris');
  const teks = await page.textContent('.isi');
  assert.ok(/Per alat suling/.test(teks) && /Ketel 1/.test(teks) && /Upah per orang/.test(teks) && /PERHATIAN/.test(teks) && /Cicilan kendaraan/.test(teks), teks.slice(0, 400));
  await page.waitForSelector('#daftar-keterangan .baris-ket');
  assert.ok(/Tambal kolam/.test(await page.textContent('#daftar-keterangan')), 'kerja lain muncul di daftar keterangan');
  await page.click('details.lipat summary');
  await foto(page, '05-ringkasan', true);
  await page.goto(ASAL + '#/terbaru/absensi');
  await page.waitForSelector('.baris-entri');
  await foto(page, '06-riwayat-absensi', true);
  await page.evaluate(() => [...document.querySelectorAll('.baris-entri')].find(x => x.querySelector('b').textContent === 'Mas Romadi').querySelector('[data-ubah]').click());
  await page.waitForSelector('#formulir');
  await pilih(page, 'b2', '2 trip');
  await foto(page, '07-ubah-absensi', true);
  await page.click('#tombol-simpan');
  await page.click('.tirai [data-aksi="kirim"]');
  await page.waitForFunction(() => location.hash === '#/terbaru/absensi');
  await tunggu(200);
  assert.strictEqual(objek('Absensi Harian').find(a => a.Nama === 'Mas Romadi' && iso(a['Tanggal']) === hariIni)['Upah (Rp)'], 126000);
  await page.goto(ASAL + '#/terbaru/suling');
  await page.waitForSelector('.baris-entri');
  assert.ok(/Total 2 sulingan · upah Rp180\.000/.test(await page.textContent('.ringkas-kartu')));
  await page.goto(ASAL + '#/terbaru/ambil');
  await page.waitForSelector('.entri');
  await foto(page, '08-riwayat-ambil');
  cek('ringkasan, riwayat per tanggal, ubah absensi');

  console.log('Kelola');
  await page.goto(ASAL + '#/kelola');
  await page.waitForSelector('.menu-kelola');
  await foto(page, '09-kelola');
  await page.click('a[href="#/kelola/karyawan"]');
  await page.waitForSelector('#tambah-induk');
  await page.click('#tambah-induk');
  await page.waitForSelector('.tirai form');
  await isi(page, '.tirai [name=m0]', 'Pak Budi');
  await pilih(page, 'm1', 'Pengumpul', '.tirai');
  await foto(page, '10-tambah-karyawan');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.item-induk b')].some(b => b.textContent === 'Pak Budi') && !document.querySelector('.tirai'));
  assert.ok(objek('Karyawan').some(k => k.Nama === 'Pak Budi' && k.Tim === 'Pengumpul' && k.Aktif === 'Ya'));
  await foto(page, '11-karyawan');
  await page.goto(ASAL + '#/kelola/tarif');
  await page.waitForSelector('#tambah-induk');
  await page.click('#tambah-induk');
  await page.waitForSelector('.tirai form');
  await isi(page, '.tirai [name=m0]', '4x suling');
  await pilih(page, 'm1', 'Tim suling', '.tirai');
  await isi(page, '.tirai [name=m2]', '380000');
  await pilih(page, 'm3', 'Penyulingan', '.tirai');
  await isi(page, '.tirai [name=m4]', '4');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.item-induk b')].some(b => b.textContent === '4x suling') && !document.querySelector('.tirai'));
  await foto(page, '12-tarif', true);
  await page.goto(ASAL + '#/kelola/pilihan');
  await page.waitForSelector('.pilih-tab');
  await page.click('[data-kel="Daerah"]');
  await page.click('#tambah-induk');
  await page.waitForSelector('.tirai form');
  await isi(page, '.tirai [name=m1]', 'Gilang');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.item-induk b')].some(b => b.textContent === 'Gilang'));
  await page.evaluate(() => [...document.querySelectorAll('.item-induk .teks')].find(x => x.querySelector('b').textContent === 'Banjarejo').click());
  await page.waitForSelector('.tirai [data-aksi="mati"]');
  assert.strictEqual((await page.textContent('.tirai [data-aksi="mati"]')).trim(), 'Hapus dari daftar');
  await page.click('.tirai [data-aksi="mati"]');
  await page.waitForFunction(() => !document.querySelector('.tirai') && ![...document.querySelectorAll('.item-induk b')].some(b => b.textContent === 'Banjarejo'));
  assert.ok(!sheets['Daftar'].data.some(r => r[4] === 'Banjarejo') && sheets['Daftar'].data.some(r => r[4] === 'Gilang'));
  await foto(page, '13-pilihan');
  await page.goto(ASAL + '#/isi/suling');
  await page.waitForSelector('.kisi-alat');
  assert.ok(/4x Rp380\.000/.test(await page.textContent('.kisi-judul')), 'tarif baru langsung tampil di Produksi Suling');
  cek('kelola karyawan, tarif borongan, dan daftar pilihan dari aplikasi');

  console.log('Tampilan, nama & logo');
  await page.goto(ASAL + '#/tampilan');
  await page.waitForSelector('#kartu-identitas');
  await isi(page, '#nama-aplikasi', 'Catatan SKW');
  await page.setInputFiles('#berkas-logo', { name: 'logo.png', mimeType: 'image/png', buffer: pngPolos(40, 30) });
  await page.waitForFunction(() => /^data:image/.test(document.querySelector('.logo-pratinjau').src));
  await page.click('#simpan-identitas');
  await page.waitForFunction(() => document.querySelector('#simpan-identitas') && document.querySelector('#simpan-identitas').disabled && /Simpan nama/.test(document.querySelector('#simpan-identitas').textContent));
  await page.click('[data-preset="laut"]');
  await pilih(page, 't-beranda', '1');
  await page.click('#tampilan-simpan');
  await page.waitForFunction(() => document.querySelector('#tampilan-simpan').textContent === 'Tersimpan');
  await foto(page, '14-tampilan', true);
  await page.goto(ASAL + '#/');
  await page.waitForSelector('.grid-catatan.k1');
  assert.ok((await page.textContent('.kepala h1')).startsWith('Catatan SKW'), 'nama aplikasi baru di kepala');
  assert.ok(/^data:image/.test(await page.getAttribute('.logo-kecil', 'src')));
  await foto(page, '15-beranda-baru');
  const app = objek('Pengaturan Aplikasi');
  assert.ok(app.some(x => x.Kunci === 'namaAplikasi' && x.Nilai === 'Catatan SKW'));
  assert.ok(app.some(x => x.Kunci === 'logo' && /^data:image\/png;base64,/.test(x.Nilai)));
  cek('nama aplikasi, logo, warna, dan tata letak beranda bisa diatur');

  console.log('Pengguna');
  await page.goto(ASAL + '#/pengguna');
  await page.waitForSelector('#tambah-bawah');
  const daftarAkun = await page.textContent('#daftar-pengguna');
  ['wildan', 'rofik', 'pakmuh', 'romadi', 'eko', 'pakgatot'].forEach(u => assert.ok(daftarAkun.includes(u + ' ·'), u));
  await foto(page, '16-pengguna', true);
  await page.click('#tambah-bawah');
  await page.waitForSelector('.tirai form');
  await isi(page, '.tirai [name=u0]', 'Tata');
  await isi(page, '.tirai [name=u1]', 'tata');
  await pilih(page, 'u2', 'Pencatat', '.tirai');
  await page.evaluate(() => document.querySelectorAll('.tirai input[name=u3]').forEach(i => { if (i.checked) i.closest('label').click(); }));
  await pilih(page, 'u3', 'Absensi', '.tirai');
  await pilih(page, 'u3', 'Kas', '.tirai');
  await isi(page, '.tirai [name=u6]', '2468');
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForFunction(() => /Tata/.test(document.getElementById('daftar-pengguna').textContent));
  // Pemilik mengganti nama penggunanya sendiri dan tetap masuk.
  await page.evaluate(() => [...document.querySelectorAll('#daftar-pengguna .teks')].find(x => /\(Anda\)/.test(x.textContent)).click());
  await page.waitForSelector('.tirai form');
  assert.strictEqual(await page.inputValue('.tirai [name=u1]'), 'wildan');
  await isi(page, '.tirai [name=u1]', 'skw.wildan');
  await foto(page, '16b-ganti-nama-pengguna', true);
  await page.click('.tirai [data-aksi="simpan"]');
  await page.waitForFunction(() => /skw\.wildan ·/.test(document.getElementById('daftar-pengguna').textContent));
  assert.ok(objek('Akun Aplikasi').some(a => a['Nama pengguna'] === 'skw.wildan'));
  await page.goto(ASAL + '#/akun');
  await page.waitForSelector('#keluar');
  assert.ok((await page.textContent('.isi')).includes('skw.wildan'), 'masih masuk dengan nama pengguna baru');
  cek('daftar akun hasil PIN lama tampil; pemilik menambah pengguna dan mengganti nama penggunanya sendiri');

  await page.goto(ASAL + '#/akun');
  await page.click('#keluar');
  await page.waitForSelector('#form-masuk');
  assert.strictEqual(await page.textContent('.layar-masuk h1'), 'Catatan SKW', 'nama aplikasi juga di layar masuk');
  assert.strictEqual(await page.inputValue('#pengguna'), 'skw.wildan', 'nama pengguna baru sudah terisi di layar masuk');
  await isi(page, '#pengguna', 'eko');
  await isi(page, '#sandi', '9937');
  await page.click('#form-masuk button[type=submit]');
  await page.waitForSelector('.grid-catatan');
  assert.deepStrictEqual(await page.$$eval('.tombol-catatan b', bs => bs.map(b => b.textContent)), ['Produksi Suling']);
  await page.evaluate(() => { location.hash = '#/isi/suling'; });
  await page.waitForSelector('.kisi-alat');
  await pilih(page, 'b1_a0_n', '2');
  await page.waitForSelector('#pratinjau:not([hidden])');
  assert.ok(!/Rp/.test(await page.textContent('#formulir')), 'formulir tim suling tanpa angka upah');
  await foto(page, '17a-produksi-tim-suling', true);
  await page.evaluate(() => { location.hash = '#/terbaru/suling'; });
  await page.waitForSelector('.baris-entri');
  assert.ok(!/Rp/.test(await page.textContent('#daftar-entri')), 'riwayat tim suling tanpa angka upah');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForSelector('.grid-catatan');
  assert.strictEqual(await page.$('.nav a[href="#/kelola"]'), null);
  await foto(page, '17-beranda-eko');
  cek('Eko masuk dengan PIN lamanya dan hanya melihat Produksi Suling');

  jaringanMati = true;
  await context.setOffline(true);
  await page.evaluate(() => { location.hash = '#/isi/suling'; });
  await page.waitForSelector('.kisi-alat');
  await page.fill('[name=b0]', kemarin);
  await pilih(page, 'b1_a0_n', '3');
  await page.click('#tombol-simpan');
  await page.click('.tirai [data-aksi="kirim"]');
  await page.waitForSelector('.status.tunggu');
  await foto(page, '18-tanpa-sinyal');
  jaringanMati = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('.status.aman');
  assert.ok(objek('Produksi Suling').some(r => r['Diisi oleh'] === 'Eko' && r['Jumlah sulingan'] === 3 && r['Upah (Rp)'] === 295000));
  cek('catatan tanpa sinyal tersimpan di HP lalu terkirim');

  assert.deepStrictEqual(galatHalaman.filter(g => !/ERR_INTERNET_DISCONNECTED|status of 404/.test(g)), [], 'tidak ada galat di halaman');
  await browser.close();
  console.log('\n' + langkah + ' langkah lulus. Gambar layar: ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
