// Service worker: aplikasi terbuka cepat dan tetap bisa dibuka tanpa sinyal.
// Strategi "simpanan dulu, perbarui di belakang": aplikasi langsung dibuka dari salinan di HP (tidak menunggu sinyal),
// sambil mengambil versi terbaru dari GitHub. Kalau ada yang berubah, aplikasi diberi tahu dan menawarkan
// "Versi baru siap" (dipakai setelah diketuk, atau otomatis saat aplikasi dibuka berikutnya).
// Nama cache berawalan "sembada-" dan hanya cache berawalan itu yang dibersihkan,
// supaya tidak mengganggu aplikasi Catatan Sembada Kepuh di alamat yang sama.
const CACHE = 'sembada-v21';
const ASET = ['./', './index.html', './app.js', './style.css', './config.js', './manifest.webmanifest', './ikon-192.png', './logo.png'];

function kabari() {
  return self.clients.matchAll({type: 'window'}).then((cs) => cs.forEach((c) => c.postMessage({jenis: 'versiBaru'})));
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASET.map((u) => new Request(u, {cache: 'no-cache'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => {
      const lama = keys.filter((k) => k.indexOf('sembada-') === 0 && k !== CACHE);
      return Promise.all(lama.map((k) => caches.delete(k))).then(() => lama.length);
    })
    .then((adaLama) => self.clients.claim().then(() => { if (adaLama) return kabari(); })));
});

// Tanda isi berkas untuk tahu apakah berubah (ETag dari GitHub Pages, atau isi teksnya).
async function tanda(res) {
  if (!res) return '';
  const etag = res.headers.get('etag');
  if (etag) return etag.replace(/^W\//, '');
  try { return await res.clone().text(); } catch (err) { return ''; }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // panggilan API ke Google tidak disimpan
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  const kunci = req.mode === 'navigate' ? './index.html' : req;
  const ambilBaru = caches.open(CACHE).then(async (cache) => {
    const lama = await cache.match(kunci, {ignoreSearch: true});
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(req, {signal: ctrl.signal, cache: 'no-cache'});
      clearTimeout(t);
      if (res && res.ok && res.type === 'basic' && !res.redirected) {
        const berubah = lama && (await tanda(lama)) !== (await tanda(res));
        await cache.put(kunci, res.clone());
        if (berubah && /\.(js|css|html)$|\/$/.test(url.pathname)) kabari();
      }
      return res;
    } catch (err) {
      clearTimeout(t);
      return null;
    }
  });

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const simpanan = await cache.match(kunci, {ignoreSearch: true});
    if (simpanan) {
      e.waitUntil(ambilBaru);
      return simpanan;
    }
    const res = await ambilBaru;
    return res || Response.error();
  }));
});
