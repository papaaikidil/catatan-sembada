/* Catatan Sembada - aplikasi pencatatan Sembada Karya Wangi.
 * Semua isian dikirim ke Google Sheet lewat API Apps Script.
 * Isian disimpan dulu di HP (antrian), lalu dikirim begitu ada sinyal.
 * Versi 2: karyawan, alat suling, pengguna, tampilan, dan pertanyaan formulir diatur dari aplikasi (API versi 6). */
(function () {
  'use strict';

  var KONF = window.SEMBADA_CONFIG || {};
  var API = KONF.API_URL || '';
  var VERSI = KONF.VERSI || '2.0.0';
  var KLIEN = 2;                                 // versi format permintaan aplikasi
  var DI_APK = /CatatanSembadaApp/.test(navigator.userAgent);
  var app = document.getElementById('app');

  // ------------------------------------------------------------ penyimpanan
  function simpan(k, v) { try { localStorage.setItem('sembada.' + k, JSON.stringify(v)); } catch (e) { /* abaikan */ } }
  function ambil(k, d) {
    try { var v = localStorage.getItem('sembada.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function buang(k) { try { localStorage.removeItem('sembada.' + k); } catch (e) { /* abaikan */ } }

  var sesi = ambil('sesi', null);          // {pin, nama, peran, tab, semua, mandor}
  var konfig = ambil('konfig', null);      // daftar pilihan, tarif, karyawan, judul kolom
  var antrian = ambil('antrian', []);      // isian yang belum terkirim
  var mengirim = false;
  var promptPasang = null;
  var sedangDiubah = null;                 // catatan yang sedang diubah pemilik
  var jumlahRiwayat = {};                  // berapa catatan ditampilkan per tab di Riwayat

  // ------------------------------------------------------------ alat bantu
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hariIni() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function tglIndo(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
  }
  function rp(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '–';
    return (n < 0 ? '-' : '') + 'Rp' + Math.round(Math.abs(n)).toLocaleString('id-ID');
  }
  function ang(n, d) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '–';
    return Number(n).toLocaleString('id-ID', {maximumFractionDigits: d === undefined ? 2 : d});
  }
  function idBaru() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function toast(pesan, lama) {
    var t = document.getElementById('toast');
    t.textContent = pesan; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, lama || 3200);
  }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }

  var IKON = {
    daun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-10-1 12-5 16-9 17Z"/><path d="M4 21c3-6 7-9 11-11"/></svg>',
    tetes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7s6 6.4 6 11.3a6 6 0 0 1-12 0c0-4.9 6-11.3 6-11.3Z"/></svg>',
    orang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
    keranjang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20.5" r="1"/><circle cx="17" cy="20.5" r="1"/></svg>',
    dompet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/></svg>',
    rumah: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/></svg>',
    grafik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>',
    jam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    akun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    kembali: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    muat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
    centang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    awan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H8a5 5 0 1 1 1-9.9A6 6 0 0 1 20.6 11 4 4 0 0 1 17.5 19Z"/><path d="M12 12v4M12 18.5v.01"/></svg>',
    naik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
    turun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    tambah: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    lanjut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
  };

  // ------------------------------------------------------------ API
  function panggil(aksi, data, batasMs) {
    if (!API) return Promise.reject(new Error('Aplikasi belum tersambung ke Google Sheet. Hubungi pemilik.'));
    var isi = {aksi: aksi, pin: sesi ? sesi.pin : '', klien: KLIEN};
    Object.keys(data || {}).forEach(function (k) { isi[k] = data[k]; });
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, batasMs || 30000);
    return fetch(API, {method: 'POST', body: JSON.stringify(isi), redirect: 'follow', signal: ctrl ? ctrl.signal : undefined})
      .then(function (res) {
        if (!res.ok) { var e = new Error('Server membalas ' + res.status + '.'); e.jaringan = true; throw e; }
        return res.json();
      })
      .catch(function (e) {
        if (e.jaringan || e.name === 'AbortError' || e instanceof TypeError) {
          var g = new Error('Tidak ada sinyal atau server sedang lambat.'); g.jaringan = true; throw g;
        }
        throw e;
      })
      .then(function (r) {
        if (r && r.kode === 'PIN' && aksi !== 'masuk') { keluar('PIN sudah diganti atau dinonaktifkan. Masukkan PIN yang baru.'); }
        return r;
      })
      .finally(function () { clearTimeout(t); });
  }

  // Fitur versi 2 butuh API versi 6 di Apps Script.
  function v6() { return !!(konfig && konfig.versiApi >= 6); }
  function bisaKelola() { return !!(sesi && sesi.semua && konfig && konfig.versiApi >= 2); }
  function pemilikV6() { return !!(sesi && sesi.semua && v6()); }

  // ------------------------------------------------------------ tampilan (nama, logo, warna)
  var BAWAAN = {namaUsaha: 'Sembada Karya Wangi', namaAplikasi: 'Catatan Sembada', warna: '#2D7C5B'};
  function tampilan() {
    var t = ambil('tampilan', {}) || {};
    return {namaUsaha: t.namaUsaha || BAWAAN.namaUsaha, namaAplikasi: t.namaAplikasi || BAWAAN.namaAplikasi,
      warna: t.warna || '', menuBeranda: t.menuBeranda || null, kartuRingkasan: t.kartuRingkasan || null,
      kartuBeranda: t.kartuBeranda || null, logoTanda: t.logoTanda || ''};
  }
  function logoSrc() { return ambil('logo', null) || 'logo.png'; }

  // Warna: dari satu warna utama dibuat warna kepala, tombol, dan latar lembut (terang dan gelap).
  function hexKeRgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbKeHex(c) { return '#' + c.map(function (x) { return pad16(Math.max(0, Math.min(255, Math.round(x)))); }).join(''); }
  function pad16(x) { var s = x.toString(16); return s.length < 2 ? '0' + s : s; }
  function campur(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] * (1 - t) + b[i] * t; }); }
  function terang(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function paletWarna(hex) {
    var c = hexKeRgb(hex) || hexKeRgb(BAWAAN.warna);
    var putih = [255, 255, 255], hitam = [0, 0, 0];
    var utama = c.slice(), i = 0;
    while (terang(utama) > 0.18 && i++ < 30) utama = campur(utama, hitam, 0.06);          // teks putih tetap terbaca
    var gelapUtama = c.slice(); i = 0;
    while (terang(gelapUtama) < 0.32 && i++ < 30) gelapUtama = campur(gelapUtama, putih, 0.08);
    return {
      terang: {hijau: rgbKeHex(utama), tua: rgbKeHex(campur(utama, hitam, 0.42)), muda: rgbKeHex(campur(c, putih, 0.88))},
      gelap: {hijau: rgbKeHex(gelapUtama), tua: rgbKeHex(campur(c, hitam, 0.72)), muda: rgbKeHex(campur(c, [17, 22, 19], 0.8))}
    };
  }
  function terapkanTampilan(t) {
    t = t || tampilan();
    document.title = t.namaAplikasi;
    var el = document.getElementById('tema-khusus');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!t.warna || t.warna.toLowerCase() === BAWAAN.warna.toLowerCase()) {
      if (el) el.remove();
      if (meta) meta.setAttribute('content', '#1B4331');
      return;
    }
    var p = paletWarna(t.warna);
    var v = function (x) { return '--hijau:' + x.hijau + ';--hijau-tua:' + x.tua + ';--hijau-muda:' + x.muda + ';'; };
    var css = ':root{' + v(p.terang) + '}' +
      '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + v(p.gelap) + '}}' +
      ':root[data-theme="dark"]{' + v(p.gelap) + '}';
    if (!el) { el = document.createElement('style'); el.id = 'tema-khusus'; document.head.appendChild(el); }
    el.textContent = css;
    if (meta) meta.setAttribute('content', p.terang.tua);
  }

  // ------------------------------------------------------------ definisi formulir
  // h = judul kolom di Google Sheet (harus sama persis).
  var FORM = {
    'Ambil Bahan': {
      kunci: 'ambil', ikon: 'daun', ket: 'Satu isian untuk satu trip.',
      bidang: [
        {j: 'tanggal', h: 'Tanggal'},
        {j: 'centang', h: 'Pengumpul', daftar: 'Pengumpul', bantuan: 'Pilih semua yang ikut trip ini.'},
        {j: 'centang', h: 'Daerah', daftar: 'Daerah', lainnya: true},
        {j: 'pilih', h: 'Kondisi bahan', daftar: 'Kondisi bahan'},
        {j: 'desimal', h: 'Berat bahan (kg)', ribuan: true, bantuan: 'Hasil timbang, contoh 1075.'},
        {j: 'rupiah', h: 'Uang dibawa (Rp)'},
        {j: 'rupiah', h: 'Uang sisa (Rp)', bantuan: 'Uang yang kembali setelah beli bahan.'},
        {j: 'rupiah', h: 'Biaya lain di jalan (Rp)', bawaan: '0', bantuan: 'Es, tali rafia, tambal ban. Isi 0 kalau tidak ada.'},
        {j: 'teks', h: 'Keterangan biaya lain', wajib: false},
        {j: 'paragraf', h: 'Keterangan', wajib: false, bantuan: 'Isi kalau ada yang tidak seperti biasa: harga bahan naik, bahan basah, ganti daerah, pikap bermasalah.'}
      ],
      pratinjau: function (n) {
        var beli = (n['Uang dibawa (Rp)'] || 0) - (n['Uang sisa (Rp)'] || 0) - (n['Biaya lain di jalan (Rp)'] || 0);
        if (n['Uang dibawa (Rp)'] === undefined) return null;
        var baris = ['Uang beli bahan: ' + rp(beli)];
        if (n['Berat bahan (kg)'] > 0) baris.push('Harga bahan per kg: ' + rp(beli / n['Berat bahan (kg)']));
        return baris;
      },
      cek: function (n) {
        var s = [];
        if (n['Uang sisa (Rp)'] > n['Uang dibawa (Rp)']) s.push(['Uang sisa (Rp)', 'Uang sisa lebih besar dari uang yang dibawa.']);
        if (n['Berat bahan (kg)'] === 0) s.push(['Berat bahan (kg)', 'Berat tidak boleh 0.']);
        return s;
      }
    },
    'Saring Minyak': {
      kunci: 'saring', ikon: 'tetes', ket: 'Setiap kali menyaring minyak.',
      bidang: [
        {j: 'tanggal', h: 'Tanggal saring'},
        {j: 'angka', h: 'Jumlah sulingan yang disaring', bantuan: 'Berapa kali suling sejak saringan terakhir.'},
        {j: 'desimal', h: 'Minyak (kg)', bantuan: 'Contoh 3,28 atau 3.28.'},
        {j: 'desimal', h: 'Hidrosol diambil (liter)', wajib: false},
        {j: 'pilih', h: 'Kondisi bahan', daftar: 'Kondisi bahan'},
        {j: 'centang', h: 'Kondisi alat', daftar: 'Kondisi alat', lainnya: true},
        {j: 'desimal', h: 'Stok minyak di gudang (kg)', wajib: false, bantuan: 'Timbang semua minyak yang ada setelah disaring.'},
        {j: 'paragraf', h: 'Keterangan', wajib: false, bantuan: 'Isi kalau minyak lebih sedikit, bahan terlalu kering atau basah, alat rusak, atau minyak dicampur.'}
      ],
      pratinjau: function (n) {
        if (!(n['Jumlah sulingan yang disaring'] > 0) || n['Minyak (kg)'] === undefined) return null;
        return ['Minyak per sulingan: ' + ang(n['Minyak (kg)'] / n['Jumlah sulingan yang disaring']) + ' kg'];
      }
    },
    'Absensi': {
      kunci: 'absensi', ikon: 'orang', ket: 'Diisi setiap sore.',
      // Format lama (API versi 5 ke bawah): satu baris per hari, satu kolom per orang.
      bidang: [
        {j: 'tanggal', h: 'Tanggal'},
        {j: 'kisi'},
        {j: 'paragraf', h: 'Keterangan', wajib: false, bantuan: 'Isi kalau ada yang izin, sakit, pulang lebih awal, ketel tidak jalan, atau hujan.'},
        {j: 'pilih', h: 'Ada kerja lain dengan upah khusus hari ini?', opsi: ['Ya', 'Tidak'], label: 'Ada kerja lain dengan upah khusus hari ini?',
          bantuan: 'Pilih Ya kalau ada pekerjaan di luar tarif biasa, misalnya tambal kolam.'},
        {j: 'teks', h: 'Pekerjaan lain', bantuan: 'Contoh: tambal kolam bocor.', syarat: 'kerjaLain'},
        {j: 'pilih', h: 'Kerja lain untuk', daftar: 'Kerja lain untuk', syarat: 'kerjaLain'},
        {j: 'upahLain', syarat: 'kerjaLain'}
      ],
      pratinjau: function (n, bidang) {
        if (v6()) return pratinjauAbsensi(n, bidang);
        var total = 0, ada = false;
        bidang.forEach(function (b) {
          if (b.j === 'kisiBaris' && n[b.h]) { ada = true; total += upahTarif(n[b.h]); }
          if (b.j === 'rupiah' && /^Upah kerja lain/.test(b.h) && n[b.h] > 0 && n['Ada kerja lain dengan upah khusus hari ini?'] === 'Ya') total += n[b.h];
        });
        return ada ? ['Perkiraan upah hari ini: ' + rp(total)] : null;
      },
      cek: function (n, bidang) {
        if (v6()) return cekAbsensi(n, bidang);
        var s = [];
        var adaKerjaLain = bidang.some(function (b) { return b.j === 'kisiBaris' && n[b.h] === 'Kerja lain'; });
        if (adaKerjaLain && n['Ada kerja lain dengan upah khusus hari ini?'] === 'Tidak') {
          s.push(['Ada kerja lain dengan upah khusus hari ini?', 'Ada yang dipilih Kerja lain. Pilih Ya, lalu isi upahnya.']);
        }
        var kisi = bidang.filter(function (b) { return b.j === 'kisiBaris'; });
        if (kisi.length && !kisi.some(function (b) { return n[b.h]; })) s.push([kisi[0].h, 'Isi minimal satu orang.']);
        if (n['Ada kerja lain dengan upah khusus hari ini?'] === 'Ya') {
          var adaUpah = bidang.some(function (b) { return /^Upah kerja lain/.test(b.h || '') && n[b.h] > 0; });
          if (!adaUpah) s.push(['_upah', 'Isi upah kerja lain untuk minimal satu orang.']);
        }
        return s;
      }
    },
    'Penjualan': {
      kunci: 'jual', ikon: 'keranjang', ket: 'Satu isian untuk satu produk.',
      bidang: [
        {j: 'tanggal', h: 'Tanggal'},
        {j: 'pilih', h: 'Pembeli', daftar: 'Pembeli', lainnya: true},
        {j: 'pilih', h: 'Produk', daftar: 'Produk'},
        {j: 'desimal', h: 'Jumlah', bantuan: 'kg untuk minyak, liter untuk hidrosol.'},
        {j: 'rupiah', h: 'Harga satuan (Rp)', bantuan: 'Harga per kg atau per liter.'},
        {j: 'pilih', h: 'Status bayar', daftar: 'Status bayar'},
        {j: 'teks', h: 'Pengiriman', wajib: false},
        {j: 'paragraf', h: 'Keterangan', wajib: false, bantuan: 'Isi kalau harga beda dari biasanya, dibayar sebagian, atau ada potongan.'}
      ],
      pratinjau: function (n) {
        if (!(n['Jumlah'] > 0) || !(n['Harga satuan (Rp)'] > 0)) return null;
        var satuan = (konfig && konfig.satuanProduk && konfig.satuanProduk[n['Produk']]) || '';
        return [ang(n['Jumlah']) + ' ' + satuan + ' × ' + rp(n['Harga satuan (Rp)']) + ' = ' + rp(n['Jumlah'] * n['Harga satuan (Rp)'])];
      },
      cek: function (n) {
        var s = [];
        if (n['Jumlah'] === 0) s.push(['Jumlah', 'Jumlah tidak boleh 0.']);
        if (n['Harga satuan (Rp)'] === 0) s.push(['Harga satuan (Rp)', 'Harga tidak boleh 0.']);
        return s;
      }
    },
    'Kas': {
      kunci: 'kas', ikon: 'dompet', ket: 'Uang keluar atau masuk di luar bahan, upah, dan penjualan.',
      bidang: [
        {j: 'tanggal', h: 'Tanggal'},
        {j: 'daftar', h: 'Kategori', daftar: 'Kategori kas'},
        {j: 'rupiah', h: 'Jumlah (Rp)'},
        {j: 'teks', h: 'Keterangan', bantuan: 'Untuk apa uangnya, contoh: bensin Grandmax, semen 10 sak.'}
      ],
      pratinjau: function (n) {
        if (!n['Kategori'] || !(n['Jumlah (Rp)'] > 0)) return null;
        var arah = (konfig && konfig.arahKas && konfig.arahKas[n['Kategori']]) || '';
        return [(arah === 'Masuk' ? 'Uang masuk ' : 'Uang keluar ') + rp(n['Jumlah (Rp)'])];
      },
      cek: function (n) { return n['Jumlah (Rp)'] === 0 ? [['Jumlah (Rp)', 'Jumlah tidak boleh 0.']] : []; }
    }
  };
  var URUTAN_TAB = ['Ambil Bahan', 'Saring Minyak', 'Absensi', 'Penjualan', 'Kas'];
  var TAB_DIATUR = ['Ambil Bahan', 'Saring Minyak', 'Penjualan', 'Kas'];
  function tabDariKunci(k) { return URUTAN_TAB.filter(function (t) { return FORM[t].kunci === k; })[0]; }

  function tarifDari(pilihan) { return (konfig && konfig.tarif || []).filter(function (x) { return x.pilihan === pilihan; })[0]; }
  function upahTarif(pilihan) { var t = tarifDari(pilihan); return t ? t.upah : 0; }
  function jenisTarif(pilihan) { var t = tarifDari(pilihan); return t ? t.jenis : ''; }

  // ---- format lama: kelompok absensi untuk PIN ini (Pengumpul / Tim suling). Kosong = boleh mengabsen semua.
  function kelompokSaya() { return (sesi && sesi.kelompokAbsensi) || ''; }
  var JOBDESK = {'Pengumpul': 'Pengumpulan', 'Tim suling': 'Penyulingan'};

  // Bidang lengkap sebuah tab.
  function bidangLengkap(tab, semua) {
    if (tab === 'Absensi') return v6() ? bidangAbsensi() : bidangAbsensiLama();
    var daftar = bidangFormulir(tab);
    return semua ? daftar : daftar.filter(function (b) { return !b.sembunyi; });
  }

  // Pertanyaan bawaan + pengaturan pemilik (tulisan, urutan, sembunyi) + pertanyaan tambahan.
  function bidangFormulir(tab) {
    var atur = (konfig && konfig.formulir && konfig.formulir[tab]) || [];
    var out = FORM[tab].bidang.map(function (b, i) {
      var x = Object.assign({}, b, {urutan: (i + 1) * 10, asal: 'Bawaan', labelAsli: b.label || b.h, bantuanAsli: b.bantuan || ''});
      var a = atur.filter(function (r) { return r.kolom === b.h && r.asal !== 'Tambahan'; })[0];
      if (a) {
        if (a.label) x.label = a.label;
        if (a.bantuan) x.bantuan = a.bantuan;
        if (a.urutan) x.urutan = a.urutan;
        if (a.tampil === false && b.wajib === false) x.sembunyi = true;
      }
      return x;
    });
    atur.filter(function (r) { return r.asal === 'Tambahan'; }).forEach(function (a) {
      var b = {j: a.jenis, h: a.kolom, label: a.label || a.kolom, bantuan: a.bantuan || '', wajib: !!a.wajib,
        urutan: a.urutan || 999, asal: 'Tambahan', sembunyi: a.tampil === false};
      if (a.jenis === 'pilih' || a.jenis === 'centang') b.opsi = a.pilihan || [];
      if (a.jenis === 'tanggal') b.bebas = true;
      out.push(b);
    });
    out.sort(function (a, b) { return a.urutan - b.urutan; });
    return out;
  }

  // ---- format lama (API versi 5): baris absensi dan upah kerja lain mengikuti judul kolom di Sheet.
  function bidangAbsensiLama() {
    var kepala = (konfig && konfig.kepala && konfig.kepala['Absensi']) || [];
    var kelompok = kelompokSaya();
    var out = [];
    FORM['Absensi'].bidang.forEach(function (b) {
      if (b.j === 'kisi') {
        kepala.forEach(function (h) {
          var m = /^(.+) \[(.+)\]$/.exec(h);
          if (m && (!kelompok || m[1] === kelompok)) out.push({j: 'kisiBaris', h: h, kelompok: m[1], label: m[2], wajib: !!kelompok, lama: true});
        });
      } else if (kelompok && (b.syarat === 'kerjaLain' || b.h === 'Ada kerja lain dengan upah khusus hari ini?')) {
        // Kerja di luar jobdesk diisi mandor atau pemilik.
      } else if (b.j === 'upahLain') {
        kepala.forEach(function (h) {
          var m = /^Upah kerja lain (.+) \(Rp\)$/.exec(h);
          if (m) out.push({j: 'rupiah', h: h, label: 'Upah kerja lain ' + m[1], wajib: false, syarat: b.syarat,
            bantuan: /&|dan/.test(m[1]) ? 'Upah untuk berdua. Kosongkan kalau tidak ikut.' : 'Kosongkan kalau tidak ikut.'});
        });
      } else {
        out.push(b);
      }
    });
    return out;
  }

  // ---- absensi versi 2: satu baris per orang. Pekerja hanya mengabsen dirinya / timnya dengan pilihan jobdesk.
  function karyawanAbsen() {
    var boleh = konfig.absenUntuk;
    var tim = konfig.tim || [];
    return (konfig.karyawan || []).filter(function (k) {
      return k.aktif && (!boleh || boleh.indexOf(k.nama) >= 0);
    }).sort(function (a, b) { return tim.indexOf(a.tim) - tim.indexOf(b.tim); });
  }
  function absensiPenuh() { return !konfig.jobdeskSaja; }          // mandor & pemilik
  function alatAktif() { return (konfig.alat || []).filter(function (a) { return a.aktif; }).map(function (a) { return a.nama; }); }
  function opsiAbsensi(tim, penuh) {
    return (konfig.tarif || []).filter(function (t) {
      if (t.untuk !== tim && !/^semua$/i.test(t.untuk)) return false;
      if (t.jenis === 'Kerja lain') return false;                       // kerja lain lewat tombol sendiri
      if (!penuh && t.jenis === 'Kerja harian') return false;
      return true;
    }).map(function (t) { return t.pilihan; });
  }
  function adaKerjaLain(n, nama) { var v = n['K|' + nama]; return Array.isArray(v) ? v.length > 0 : !!v; }

  function bidangAbsensi() {
    var penuh = absensiPenuh();
    var alat = alatAktif();
    var out = [{j: 'tanggal', h: 'Tanggal'}];
    karyawanAbsen().forEach(function (k) {
      var nama = k.nama;
      out.push({j: 'kisiBaris', h: 'P|' + nama, nama: nama, kelompok: k.tim, label: nama, wajib: !penuh, opsi: opsiAbsensi(k.tim, penuh)});
      if (alat.length > 1) {
        out.push({j: 'pilih', h: 'A|' + nama, label: 'Alat yang dipakai', opsi: alat, kelas: 'anak', bawaan: k.alat,
          syarat: function (n) { return jenisTarif(n['P|' + nama]) === 'Penyulingan'; }});
      }
      if (penuh) {
        var adaKL = function (n) { return adaKerjaLain(n, nama); };
        out.push({j: 'centang', h: 'K|' + nama, opsi: ['+ Kerja lain (upah khusus)'], wajib: false, kelas: 'anak tombol-kl', tanpaLabel: true});
        out.push({j: 'rupiah', h: 'KU|' + nama, label: 'Upah kerja lain ' + nama, kelas: 'anak', syarat: adaKL});
        out.push({j: 'teks', h: 'KP|' + nama, label: 'Pekerjaan lain', bantuan: 'Contoh: tambal kolam bocor.', kelas: 'anak', syarat: adaKL});
        out.push({j: 'pilih', h: 'KK|' + nama, label: 'Kerja lain untuk', daftar: 'Kerja lain untuk', kelas: 'anak', syarat: adaKL});
      }
    });
    out.push({j: 'paragraf', h: 'Keterangan', wajib: false, bantuan: 'Isi kalau ada yang izin, sakit, pulang lebih awal, ketel tidak jalan, atau hujan.'});
    return out;
  }

  // Satu baris absensi (untuk pemilik mengubah catatan di Riwayat).
  function bidangUbahAbsensi() {
    var nama = (konfig.karyawan || []).map(function (k) { return k.nama; });
    var adaKL = function (n) { return n['Pekerjaan'] === 'Kerja lain'; };
    return [
      {j: 'tanggal', h: 'Tanggal'},
      {j: 'daftar', h: 'Nama', opsi: nama, wajib: false, bantuan: 'Kosongkan hanya untuk catatan keterangan saja.'},
      {j: 'pilih', h: 'Pekerjaan', opsi: (konfig.tarif || []).map(function (t) { return t.pilihan; }), wajib: false},
      {j: 'pilih', h: 'Alat', opsi: (konfig.alat || []).map(function (a) { return a.nama; }), wajib: false,
        syarat: function (n) { return jenisTarif(n['Pekerjaan']) === 'Penyulingan'; }},
      {j: 'rupiah', h: 'Upah (Rp)', label: 'Upah kerja lain', syarat: adaKL},
      {j: 'teks', h: 'Pekerjaan lain', wajib: false, syarat: adaKL},
      {j: 'pilih', h: 'Kerja lain untuk', daftar: 'Kerja lain untuk', syarat: adaKL},
      {j: 'paragraf', h: 'Keterangan', wajib: false}
    ];
  }

  function pratinjauAbsensi(n, bidang) {
    var total = 0, ada = false;
    bidang.forEach(function (b) {
      if (b.j !== 'kisiBaris') return;
      if (n[b.h]) { ada = true; total += upahTarif(n[b.h]); }
      if (n['KU|' + b.nama] > 0 && adaKerjaLain(n, b.nama)) { ada = true; total += n['KU|' + b.nama]; }
    });
    if (n['Pekerjaan'] !== undefined && bidang.some(function (b) { return b.h === 'Nama'; })) {
      ada = !!n['Pekerjaan']; total = n['Pekerjaan'] === 'Kerja lain' ? (n['Upah (Rp)'] || 0) : upahTarif(n['Pekerjaan']);
    }
    return ada ? ['Perkiraan upah: ' + rp(total)] : null;
  }

  function cekAbsensi(n, bidang) {
    var s = [];
    var kisi = bidang.filter(function (b) { return b.j === 'kisiBaris'; });
    if (!kisi.length) return s;
    var ada = kisi.some(function (b) { return n[b.h] || adaKerjaLain(n, b.nama); });
    if (!ada) s.push([kisi[0].h, 'Isi minimal satu orang.']);
    kisi.forEach(function (b) {
      if (adaKerjaLain(n, b.nama) && !(n['KU|' + b.nama] > 0)) s.push(['KU|' + b.nama, 'Isi upah kerja lain.']);
    });
    return s;
  }

  // Isian formulir absensi → data yang dikirim: {Tanggal, Keterangan, baris: [...]}
  function dataAbsensi(n, bidang) {
    var baris = [];
    bidang.filter(function (b) { return b.j === 'kisiBaris'; }).forEach(function (b) {
      var nama = b.nama, pek = n[b.h];
      if (pek) baris.push({nama: nama, pekerjaan: pek, alat: jenisTarif(pek) === 'Penyulingan' ? (n['A|' + nama] || '') : ''});
      if (adaKerjaLain(n, nama)) {
        baris.push({nama: nama, pekerjaan: 'Kerja lain', upah: n['KU|' + nama] || 0, pekerjaanLain: n['KP|' + nama] || '',
          kerjaLainUntuk: n['KK|' + nama] || ''});
      }
    });
    return {'Tanggal': n['Tanggal'], 'Keterangan': n['Keterangan'] || '', baris: baris};
  }

  function opsiBidang(b) {
    if (b.opsi) return b.opsi;
    if (b.j === 'kisiBaris') {
      var kelompok = kelompokSaya();
      return (konfig && konfig.tarif || []).filter(function (t) {
        if (t.untuk !== b.kelompok && t.untuk !== 'Semua') return false;
        if (!kelompok) return true;
        if (t.jenis) return t.jenis === 'Libur' || t.jenis === JOBDESK[kelompok];
        return !/harian|kerja lain/i.test(t.pilihan);
      }).map(function (t) { return t.pilihan; });
    }
    return (konfig && konfig.daftar && konfig.daftar[b.daftar]) || [];
  }

  function terlihat(b, n) {
    if (typeof b.syarat === 'function') return b.syarat(n);
    if (b.syarat === 'kerjaLain') return n['Ada kerja lain dengan upah khusus hari ini?'] === 'Ya';
    return true;
  }

  // ------------------------------------------------------------ antrian kirim
  function simpanAntrian() { simpan('antrian', antrian); perbaruiLencana(); }

  function kirimAntrian() {
    if (mengirim || !sesi || !antrian.length) return Promise.resolve();
    var siap = antrian.filter(function (a) { return a.status !== 'galat'; });
    if (!siap.length) return Promise.resolve();
    mengirim = true; perbaruiStatus();
    var terkirim = 0;
    var urut = siap.reduce(function (p, item) {
      return p.then(function (lanjut) {
        if (lanjut === false) return false;
        return panggil('simpan', {tab: item.tab, id: item.id, nilai: item.nilai}).then(function (r) {
          if (r && r.ok) {
            antrian = antrian.filter(function (a) { return a.id !== item.id; });
            terkirim++; simpanAntrian(); return true;
          }
          if (r && r.kode === 'PIN') return false;
          item.status = 'galat'; item.galat = (r && r.galat) || 'Ditolak server.'; simpanAntrian(); return true;
        }, function (e) {
          if (e.jaringan) return false;
          item.status = 'galat'; item.galat = e.message; simpanAntrian(); return true;
        });
      });
    }, Promise.resolve(true));
    return urut.then(function () {
      mengirim = false;
      if (terkirim) toast(terkirim === 1 ? 'Catatan terkirim ke Google Sheet.' : terkirim + ' catatan terkirim ke Google Sheet.');
      perbaruiStatus();
      if (location.hash === '#/antrian' || location.hash === '' || location.hash === '#/') tampilkan();
    });
  }

  function perbaruiLencana() {
    var el = document.querySelector('.nav .lencana');
    var n = antrian.length;
    if (el) { el.textContent = n; el.hidden = !n; }
  }

  function htmlStatus() {
    var galat = antrian.filter(function (a) { return a.status === 'galat'; }).length;
    var tunggu = antrian.length - galat;
    if (galat) return '<button class="status galat" data-ke="#/antrian">' + IKON.awan + galat + ' catatan gagal dikirim. Ketuk untuk melihat.</button>';
    if (tunggu) {
      var teks = mengirim ? 'Mengirim ' + tunggu + ' catatan…' : (navigator.onLine ? tunggu + ' catatan menunggu dikirim.' : 'Tanpa sinyal. ' + tunggu + ' catatan tersimpan di HP.');
      return '<button class="status tunggu" data-ke="#/antrian">' + IKON.awan + esc(teks) + '</button>';
    }
    return '<div class="status aman">' + IKON.centang + 'Semua catatan sudah terkirim.</div>';
  }
  function perbaruiStatus() {
    var el = document.getElementById('kotak-status');
    if (el) el.innerHTML = htmlStatus();
    perbaruiLencana();
  }

  // ------------------------------------------------------------ kerangka layar
  function kerangka(judul, sub, isi, opsi) {
    opsi = opsi || {};
    var kiri = opsi.kembali ? '<button class="tombol-ikon" data-ke="' + opsi.kembali + '" aria-label="Kembali">' + IKON.kembali + '</button>' : '';
    var kanan = opsi.muat ? '<button class="tombol-ikon" id="tombol-muat" aria-label="Muat ulang">' + IKON.muat + '</button>' : '';
    var html = '<header class="kepala">' + kiri + '<h1>' + esc(judul) + (sub ? '<span class="kecil">' + esc(sub) + '</span>' : '') + '</h1>' + kanan + '</header>' +
      '<main class="isi">' + isi + '</main>';
    if (!opsi.tanpaNav) html += navBawah(opsi.aktif);
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function navBawah(aktif) {
    var item = [['#/', 'Beranda', 'rumah', 'beranda']];
    if (sesi && sesi.semua) item.push(['#/ringkasan', 'Ringkasan', 'grafik', 'ringkasan']);
    item.push(['#/terbaru', 'Riwayat', 'jam', 'terbaru']);
    item.push(['#/akun', 'Akun', 'akun', 'akun']);
    return '<nav class="nav">' + item.map(function (i) {
      var lencana = i[3] === 'beranda' ? '<span class="lencana"' + (antrian.length ? '' : ' hidden') + '>' + antrian.length + '</span>' : '';
      return '<a href="' + i[0] + '" class="' + (aktif === i[3] ? 'aktif' : '') + '">' + IKON[i[2]] + i[1] + lencana + '</a>';
    }).join('') + '</nav>';
  }

  // ------------------------------------------------------------ layar: masuk
  function layarMasuk(pesan) {
    var t = tampilan();
    app.innerHTML = '<div class="layar-masuk">' +
      '<img class="logo" src="' + esc(logoSrc()) + '" alt="Logo ' + esc(t.namaUsaha) + '">' +
      '<h1>' + esc(t.namaAplikasi) + '</h1>' +
      '<p>' + esc(t.namaUsaha) + ' · Masukkan PIN Anda.</p>' +
      '<form id="form-pin" class="tumpuk" autocomplete="off">' +
      '<input class="masukan pin" id="pin" type="password" inputmode="numeric" maxlength="8" placeholder="••••" aria-label="PIN">' +
      (pesan ? '<div class="galat-kartu">' + esc(pesan) + '</div>' : '') +
      '<button class="tombol utama penuh" type="submit">Masuk</button>' +
      '</form>' +
      (!API ? '<p style="margin-top:20px">Aplikasi belum tersambung ke Google Sheet.</p>' : '') +
      '</div>';
    var input = document.getElementById('pin');
    input.focus();
    document.getElementById('form-pin').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var pin = input.value.trim();
      if (!pin) return;
      var tombol = ev.target.querySelector('button');
      tombol.disabled = true; tombol.textContent = 'Memeriksa…';
      sesi = {pin: pin};
      panggil('masuk', {pin: pin}).then(function (r) {
        if (!r.ok) { sesi = null; layarMasuk(r.galat || 'PIN salah.'); return; }
        sesi = {pin: pin, nama: r.nama || '', peran: r.peran, tab: r.tab, semua: r.semua, mandor: !!r.mandor, kelompokAbsensi: r.kelompokAbsensi || ''};
        simpan('sesi', sesi);
        return muatKonfig().then(function () { location.hash = '#/'; tampilkan(); });
      }).catch(function (e) { sesi = null; layarMasuk(e.message); });
    });
  }

  function keluar(pesan) {
    sesi = null; buang('sesi'); buang('ringkasan');
    layarMasuk(pesan);
  }

  function muatKonfig() {
    return panggil('config').then(function (r) {
      if (r && r.ok) {
        konfig = r; simpan('konfig', r);
        if (sesi) {
          sesi.tab = r.tab; sesi.semua = r.semua; sesi.peran = r.peran; sesi.nama = r.nama || sesi.nama || '';
          sesi.mandor = !!r.mandor; sesi.kelompokAbsensi = r.kelompokAbsensi || ''; simpan('sesi', sesi);
        }
        if (r.tampilan) {
          simpan('tampilan', r.tampilan);
          terapkanTampilan();
          muatLogo(r.tampilan.logoTanda || '');
        }
      }
      return r;
    });
  }

  // Logo dikirim terpisah dan hanya diambil kalau berubah.
  function muatLogo(tanda) {
    if (tanda === ambil('logoTanda', '')) return Promise.resolve();
    if (!tanda) { buang('logo'); simpan('logoTanda', ''); gantiLogoDiLayar(); return Promise.resolve(); }
    return panggil('logo').then(function (r) {
      if (r && r.ok) { if (r.logo) simpan('logo', r.logo); else buang('logo'); simpan('logoTanda', r.tanda || ''); gantiLogoDiLayar(); }
    }, function () { /* coba lagi lain kali */ });
  }
  function gantiLogoDiLayar() { document.querySelectorAll('img.logo').forEach(function (i) { i.src = logoSrc(); }); }

  // ------------------------------------------------------------ layar: beranda
  function tabBeranda() {
    var boleh = (sesi.tab || []).filter(function (t) { return FORM[t]; });
    var menu = tampilan().menuBeranda;
    if (!menu) return boleh;
    var urut = menu.filter(function (t) { return boleh.indexOf(t) >= 0; });
    return urut;
  }

  function ketTombolAbsensi() {
    if (!v6()) return kelompokSaya() ? 'Absensi ' + kelompokSaya().toLowerCase() + ' saja.' : FORM['Absensi'].ket;
    if (!konfig.jobdeskSaja) return sesi.semua ? FORM['Absensi'].ket : 'Kerja harian dan kerja lain.';
    var k = karyawanAbsen();
    return k.length === 1 ? 'Absensi ' + k[0].nama + '.' : 'Absensi ' + k.map(function (x) { return x.nama; }).join(', ') + '.';
  }

  function layarBeranda() {
    var tab = tabBeranda();
    var tombol = tab.map(function (t) {
      var f = FORM[t];
      var ket = t === 'Absensi' ? ketTombolAbsensi() : f.ket;
      return '<a class="tombol-catatan" href="#/isi/' + f.kunci + '"><span class="lingkar">' + IKON[f.ikon] + '</span><b>' + esc(t) + '</b><small>' + esc(ket) + '</small></a>';
    }).join('');
    var isi = '<div id="kotak-status">' + htmlStatus() + '</div>';
    if (sesi.semua) isi += '<div id="kotak-ringkas">' + htmlRingkasMini(ambil('ringkasan', null)) + '</div>';
    isi += '<div class="judul-bagian">Isi catatan</div>' +
      (tab.length ? '<div class="grid-catatan' + (tab.length <= 2 ? ' satu' : '') + '">' + tombol + '</div>' : '<div class="kosong">PIN ini belum diberi akses ke catatan mana pun.</div>');
    kerangka(tampilan().namaAplikasi, 'Masuk sebagai ' + (sesi.nama && sesi.nama !== sesi.peran ? sesi.nama + ' (' + sesi.peran + ')' : (sesi.peran || '')), isi, {aktif: 'beranda'});
    if (!sesi.semua) return;
    var kotak = document.getElementById('kotak-ringkas');
    kotak.addEventListener('change', function (ev) {
      if (ev.target.id !== 'pilih-minggu') return;
      simpan('mingguDipilih', ev.target.value);
      kotak.innerHTML = htmlRingkasMini(ambil('ringkasan', null));
    });
    muatRingkasan().then(function (r) {
      var el = document.getElementById('kotak-ringkas');
      if (el && r) el.innerHTML = htmlRingkasMini(r);
    }, function () { /* tetap pakai data tersimpan */ });
  }

  // ---- pilihan minggu & bulan (dipakai di Beranda dan Ringkasan)
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function pecahTgl(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? {d: +m[1], m: +m[2], y: +m[3]} : null; }
  function labelMinggu(mg) {
    var a = pecahTgl(mg.mulai), b = pecahTgl(mg.sampai);
    if (!a || !b) return mg.mulai + ' – ' + mg.sampai;
    if (a.m === b.m && a.y === b.y) return a.d + '–' + b.d + ' ' + BULAN[b.m - 1] + ' ' + b.y;
    return a.d + ' ' + BULAN[a.m - 1] + (a.y !== b.y ? ' ' + a.y : '') + ' – ' + b.d + ' ' + BULAN[b.m - 1] + ' ' + b.y;
  }
  function labelBulan(bl) {
    var m = /^(\d{2})\/(\d{4})$/.exec(bl.bulan || '');
    return m ? BULAN_PANJANG[+m[1] - 1] + ' ' + m[2] : (bl.bulan || '');
  }
  function daftarMinggu(r) {
    if (r.semuaMinggu && r.semuaMinggu.length) return r.semuaMinggu;
    var out = [];
    [r.mingguBerjalan, r.mingguPenuh].forEach(function (m) {
      if (m && !out.some(function (x) { return x.mulai === m.mulai; })) out.push(m);
    });
    return out;
  }
  function daftarBulan(r) { return (r.semuaBulan && r.semuaBulan.length) ? r.semuaBulan : (r.bulanIni ? [r.bulanIni] : []); }
  function indeksPilihan(daftar, kunci, cocok) {
    var simpanan = ambil(kunci, '');
    for (var i = 0; i < daftar.length; i++) if (cocok(daftar[i]) === simpanan) return i;
    return 0;
  }
  function selectMinggu(daftar, idx) {
    return '<select class="masukan pilih-periode" id="pilih-minggu" aria-label="Pilih minggu">' + daftar.map(function (m, i) {
      return '<option value="' + esc(m.mulai) + '"' + (i === idx ? ' selected' : '') + '>' + esc(labelMinggu(m)) + (i === 0 ? ' (minggu ini)' : '') + '</option>';
    }).join('') + '</select>';
  }
  function banding(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return '';
    var x = (a - b) / Math.abs(b);
    return '<small class="banding ' + (x >= 0 ? 'naik' : 'turun') + '">' + (x >= 0 ? '▲ ' : '▼ ') + Math.round(Math.abs(x) * 100) + '% dari minggu sebelumnya</small>';
  }
  function kotakAngka(label, nilai, merah, tambahan) {
    var kelas = (merah ? 'minus ' : '') + (String(nilai).length > 11 ? 'panjang' : '');
    return '<div class="angka"><span>' + esc(label) + '</span><b class="' + kelas.trim() + '">' + esc(nilai) + '</b>' + (tambahan || '') + '</div>';
  }
  function totalUpah(m) { return (m.upahPengumpul || 0) + (m.upahPenyuling || 0) + (m.upahHarian || 0); }

  // Upah per pekerja satu minggu (untuk gajian), dari Rekap Mingguan.
  function htmlGaji(m, berjalan) {
    if (!m.upahOrang) {
      return '<div class="gaji"><div class="gaji-judul">Upah per orang</div><p class="catatan">Rincian upah per orang muncul setelah API di Apps Script diperbarui.</p></div>';
    }
    var orang = m.upahOrang.filter(function (o) { return o.upah; });
    var total = 0;
    var baris = orang.map(function (o) {
      total += o.upah || 0;
      return '<div class="gaji-baris"><span>' + esc(o.nama) + '</span><b>' + esc(rp(o.upah)) + '</b></div>';
    }).join('');
    return '<div class="gaji"><div class="gaji-judul">Upah per orang (untuk gajian)' + (berjalan ? ' · sampai hari ini' : '') + '</div>' +
      (baris || '<p class="catatan">Belum ada upah di minggu ini.</p>') +
      (baris ? '<div class="gaji-baris gaji-total"><span>Total</span><b>' + esc(rp(total)) + '</b></div>' : '') +
      '<p class="catatan">Dari absensi. Bonus atau tambahan yang dicatat di Kas belum termasuk.</p></div>';
  }

  // Sulingan per alat dan operatornya.
  function htmlAlat(m) {
    if (!m.alat) return '';
    if (!m.alat.length) return '<div class="gaji"><div class="gaji-judul">Sulingan per alat</div><p class="catatan">Belum ada sulingan di minggu ini.</p></div>';
    return '<div class="gaji"><div class="gaji-judul">Sulingan per alat</div>' + m.alat.map(function (a) {
      return '<div class="gaji-baris"><span>' + esc(a.nama) + '<small class="operator">' + esc(a.operator.map(function (o) {
        return o.nama + (a.operator.length > 1 ? ' (' + o.sulingan + 'x)' : '');
      }).join(', ')) + '</small></span><b>' + esc(ang(a.sulingan, 0)) + ' kali</b></div>';
    }).join('') + '</div>';
  }

  // Kartu yang bisa diatur pemilik (urutan dan tampil/tidak).
  var KARTU_MINGGU = [
    {id: 'penjualan', label: 'Penjualan', html: function (m, ms) { return kotakAngka('Penjualan', rp(m.penjualan), false, ms ? banding(m.penjualan, ms.penjualan) : ''); }},
    {id: 'laba', label: 'Laba usaha', html: function (m, ms) { return kotakAngka('Laba usaha', rp(m.laba), m.laba < 0, ms ? banding(m.laba, ms.laba) : ''); }},
    {id: 'minyak', label: 'Minyak dihasilkan', html: function (m, ms) { return kotakAngka('Minyak dihasilkan', ang(m.minyak) + ' kg', false, ms ? banding(m.minyak, ms.minyak) : ''); }},
    {id: 'terjual', label: 'Minyak terjual', html: function (m) { return kotakAngka('Minyak terjual', ang(m.terjual) + ' kg'); }},
    {id: 'bahan', label: 'Bahan masuk', html: function (m) { return kotakAngka('Bahan masuk', ang(m.bahanKg, 0) + ' kg'); }},
    {id: 'hargaBahan', label: 'Harga bahan/kg', html: function (m) { return kotakAngka('Harga bahan/kg', rp(m.hargaBahan)); }},
    {id: 'biayaPerKg', label: 'Biaya per kg minyak', html: function (m) { return kotakAngka('Biaya per kg minyak', rp(m.biayaPerKg)); }},
    {id: 'totalUpah', label: 'Total upah', html: function (m) { return kotakAngka('Total upah', rp(totalUpah(m))); }},
    {id: 'sulingan', label: 'Sulingan', html: function (m) { return kotakAngka('Sulingan', ang(m.sulingan, 0) + ' kali'); }},
    {id: 'disaring', label: 'Sulingan disaring', html: function (m) { return kotakAngka('Sulingan disaring', ang(m.sulinganDisaring, 0) + ' kali'); }},
    {id: 'ketelKosong', label: 'Hari ketel kosong', html: function (m) { return kotakAngka('Hari ketel kosong', ang(m.ketelKosong, 0) + ' hari', m.ketelKosong >= 2); }},
    {id: 'upahOrang', label: 'Upah per orang (gajian)', blok: true, html: function (m, ms, berjalan) { return htmlGaji(m, berjalan); }},
    {id: 'alat', label: 'Sulingan per alat', blok: true, html: function (m) { return htmlAlat(m); }}
  ];
  var KARTU_BULAN = [
    {id: 'b_penjualan', label: 'Penjualan (bulan)', html: function (b) { return kotakAngka('Penjualan', rp(b.penjualan)); }},
    {id: 'b_laba', label: 'Laba usaha (bulan)', html: function (b) { return kotakAngka('Laba usaha', rp(b.laba), b.laba < 0); }},
    {id: 'b_cicilan', label: 'Cicilan kendaraan', html: function (b) { return kotakAngka('Cicilan kendaraan', rp(b.cicilan)); }},
    {id: 'b_keluarga', label: 'Keluarga & pribadi', html: function (b) { return kotakAngka('Keluarga & pribadi', rp(b.keluarga)); }},
    {id: 'b_proyek', label: 'Proyek + upah harian', html: function (b) { return kotakAngka('Proyek + upah harian', rp((b.proyekBahan || 0) + (b.upahHarian || 0))); }},
    {id: 'b_kas', label: 'Perubahan kas', html: function (b) { return kotakAngka('Perubahan kas', rp(b.perubahanKas), b.perubahanKas < 0); }}
  ];
  var KARTU_LAIN = [{id: 'peringatan', label: 'Peringatan'}];
  var KARTU_BERANDA_BAWAAN = ['penjualan', 'laba', 'minyak', 'totalUpah', 'upahOrang'];
  function semuaIdKartu() { return KARTU_MINGGU.concat(KARTU_BULAN, KARTU_LAIN).map(function (k) { return k.id; }); }
  // Kartu yang tampil, sesuai urutan pengaturan.
  function pilihKartu(daftar, atur) {
    if (!atur) return daftar.slice();
    return atur.map(function (id) { return daftar.filter(function (k) { return k.id === id; })[0]; }).filter(function (k) { return k; });
  }
  function htmlKartuMinggu(daftarKartu, m, ms, berjalan) {
    var kotak = daftarKartu.filter(function (k) { return !k.blok; }).map(function (k) { return k.html(m, ms, berjalan); }).join('');
    var blok = daftarKartu.filter(function (k) { return k.blok; }).map(function (k) { return k.html(m, ms, berjalan); }).join('');
    return (kotak ? '<div class="angka-grid">' + kotak + '</div>' : '') + blok;
  }

  function htmlRingkasMini(r) {
    if (!r) return '';
    var daftar = daftarMinggu(r);
    if (!daftar.length) return '';
    var idx = indeksPilihan(daftar, 'mingguDipilih', function (m) { return m.mulai; });
    var m = daftar[idx], sebelum = daftar[idx + 1];
    var perlu = (r.peringatan || []).filter(function (p) { return /PERHATIAN|TAGIH|PERBAIKI|BACA/.test(p.status); }).length;
    var kartu = pilihKartu(KARTU_MINGGU, tampilan().kartuBeranda || KARTU_BERANDA_BAWAAN);
    return '<div class="kartu"><h2>Ringkasan minggu</h2>' + selectMinggu(daftar, idx) +
      '<p class="sub">' + (idx === 0 ? 'Data sampai ' + esc(r.dataSampai) : 'Minggu yang sudah lewat') + '</p>' +
      htmlKartuMinggu(kartu, m, sebelum, idx === 0) +
      (perlu ? '<button class="status galat" style="margin:12px 0 0" data-ke="#/ringkasan">' + IKON.awan + perlu + ' hal perlu ditangani sekarang</button>' : '') +
      '<button class="tautan" data-ke="#/ringkasan">Lihat ringkasan lengkap ›</button></div>';
  }

  function muatRingkasan() {
    return panggil('ringkasan').then(function (r) {
      if (r && r.ok) { simpan('ringkasan', r); return r; }
      throw new Error((r && r.galat) || 'Gagal memuat ringkasan.');
    });
  }

  // ------------------------------------------------------------ layar: ringkasan
  function layarRingkasan() {
    if (!sesi.semua) { location.hash = '#/'; return; }
    var tersimpan = ambil('ringkasan', null);
    kerangka('Ringkasan', 'Dari Dashboard Google Sheet', tersimpan ? htmlRingkasan(tersimpan) : '<div class="memuat">Memuat ringkasan…</div>', {aktif: 'ringkasan', muat: true});
    var isi = document.querySelector('.isi');
    isi.addEventListener('change', function (ev) {
      if (ev.target.id === 'pilih-minggu') simpan('mingguDipilih', ev.target.value);
      else if (ev.target.id === 'pilih-bulan') simpan('bulanDipilih', ev.target.value);
      else return;
      isi.innerHTML = htmlRingkasan(ambil('ringkasan', null));
    });
    var muat = function () {
      muatRingkasan().then(function (r) {
        if (location.hash !== '#/ringkasan') return;
        isi.innerHTML = htmlRingkasan(r);
      }, function (e) {
        if (location.hash !== '#/ringkasan') return;
        if (!tersimpan) isi.innerHTML = '<div class="galat-kartu">' + esc(e.message) + '</div>';
        else toast(e.message);
      });
    };
    document.getElementById('tombol-muat').addEventListener('click', function () { toast('Memuat ulang…', 1500); muat(); });
    muat();
  }

  function htmlRingkasan(r) {
    if (!r) return '';
    var atur = tampilan().kartuRingkasan;
    var p = (r.peringatan || []).map(function (x) {
      var kelas = /PERHATIAN|TAGIH|PERBAIKI|BACA/.test(x.status) ? 'perlu' : (x.status === 'Aman' ? 'aman' : 'netral');
      return '<div class="peringatan"><span class="chip-status ' + kelas + '">' + esc(x.status || '–') + '</span><div><p>' + esc(x.hal) +
        (x.nilai ? ': <b>' + esc(x.nilai) + '</b>' : '') + '</p>' + (x.saran ? '<p class="saran">' + esc(x.saran) + '</p>' : '') + '</div></div>';
    }).join('');

    var dm = daftarMinggu(r);
    var im = indeksPilihan(dm, 'mingguDipilih', function (m) { return m.mulai; });
    var m = dm[im], ms = dm[im + 1];
    var kartuM = pilihKartu(KARTU_MINGGU, atur);
    var minggu = m && kartuM.length ? '<div class="kartu"><h2>Minggu</h2>' + selectMinggu(dm, im) +
      (ms ? '<p class="sub">Panah membandingkan dengan minggu sebelumnya (' + esc(labelMinggu(ms)) + ').</p>' : '<p class="sub"></p>') +
      htmlKartuMinggu(kartuM, m, ms, im === 0) + '</div>' : '';

    var db = daftarBulan(r);
    var ib = indeksPilihan(db, 'bulanDipilih', function (x) { return x.bulan; });
    var b = db[ib];
    var kartuB = pilihKartu(KARTU_BULAN, atur);
    var bulan = b && kartuB.length ? '<div class="kartu"><h2>Bulan</h2><select class="masukan pilih-periode" id="pilih-bulan" aria-label="Pilih bulan">' +
      db.map(function (x, i) { return '<option value="' + esc(x.bulan) + '"' + (i === ib ? ' selected' : '') + '>' + esc(labelBulan(x)) + (i === 0 ? ' (bulan ini)' : '') + '</option>'; }).join('') +
      '</select><div class="angka-grid">' + kartuB.map(function (k) { return k.html(b); }).join('') + '</div></div>' : '';

    var tampilPeringatan = !atur || atur.indexOf('peringatan') >= 0;
    return '<p class="sub" style="margin:0 0 12px;color:var(--teks-2)">Data sampai ' + esc(r.dataSampai) + '</p>' + minggu + bulan +
      (tampilPeringatan ? '<div class="judul-bagian">Peringatan (kondisi terbaru)</div><div class="kartu">' + (p || '<div class="kosong">Tidak ada peringatan.</div>') + '</div>' : '');
  }

  // ------------------------------------------------------------ layar: isi formulir
  function judulIsi(tab, ubah) {
    if (ubah) return {judul: 'Ubah ' + tab, sub: 'Catatan tanggal ' + tglIndo(ubah.nilai['Tanggal'] || ubah.nilai['Tanggal saring'] || '')};
    if (tab !== 'Absensi') return {judul: tab, sub: FORM[tab].ket};
    if (!v6()) {
      if (kelompokSaya()) return {judul: 'Absensi ' + kelompokSaya(), sub: 'Hanya pekerjaan ' + kelompokSaya().toLowerCase() + '. Kerja lain diisi mandor.'};
      return {judul: 'Absensi', sub: 'Untuk kerja harian dan kerja lain.'};
    }
    if (konfig.jobdeskSaja) {
      var k = karyawanAbsen();
      return {judul: 'Absensi ' + (k.length === 1 ? k[0].nama : (k[0] ? k[0].tim : '')), sub: 'Pekerjaan rutin saja. Kerja harian dan kerja lain diisi mandor.'};
    }
    return {judul: 'Absensi', sub: 'Semua karyawan aktif.'};
  }

  function catatanAtasIsi(tab, ubah) {
    if (ubah) return '<div class="pratinjau awas">Mengubah catatan yang sudah masuk Google Sheet. Perubahan dicatat di tab Log Aplikasi.</div>';
    if (tab !== 'Absensi') return '';
    if (v6() && !konfig.jobdeskSaja) {
      return '<div class="pratinjau">Pekerja yang sudah absen sendiri lewat HP-nya biarkan <b>Tidak diisi</b>. Isi kerja harian, atau ketuk <b>+ Kerja lain</b> untuk upah khusus.</div>';
    }
    if (!v6() && !kelompokSaya()) {
      return '<div class="pratinjau">Pekerja yang sudah absen sendiri lewat HP-nya (pengumpul: trip, tim suling: sulingan) biarkan <b>Tidak diisi</b>. Isi hanya yang kerja harian atau kerja lain.</div>';
    }
    if (v6() && !karyawanAbsen().length) return '<div class="galat-kartu">Belum ada karyawan aktif untuk PIN ini. Minta pemilik mengatur di Kelola pengguna.</div>';
    return '';
  }

  // Formulir isi baru, atau ubah catatan lama (ubah = {tab, nomor, tanda, nilai}) khusus pemilik.
  function layarIsi(kunci, ubah) {
    var tab = tabDariKunci(kunci);
    if (!tab || (sesi.tab || []).indexOf(tab) < 0) { location.hash = '#/'; return; }
    if (ubah && ubah.tab !== tab) ubah = null;
    var kembali = ubah ? '#/terbaru/' + kunci : '#/';
    if (!konfig || !konfig.kepala || !konfig.kepala[tab]) {
      kerangka(tab, '', '<div class="galat-kartu">Daftar pilihan belum termuat. Sambungkan ke internet sekali, lalu buka lagi.</div>' +
        '<div style="margin-top:12px"><button class="tombol utama penuh" id="coba-muat">Muat daftar pilihan</button></div>', {kembali: kembali, tanpaNav: true});
      document.getElementById('coba-muat').addEventListener('click', function () {
        muatKonfig().then(function () { tampilkan(); }, function (e) { toast(e.message); });
      });
      return;
    }
    var absensiBaru = tab === 'Absensi' && v6();
    var bidang = (absensiBaru && ubah) ? bidangUbahAbsensi() : bidangLengkap(tab);
    var draf = ubah ? mentahDariNilai(bidang, ubah.nilai) : ambil('draf.' + kunci, {});
    var html = catatanAtasIsi(tab, ubah) +
      bidang.map(function (b, i) { return htmlBidang(b, i, draf); }).join('') +
      '<div class="bidang" data-h="_upah" hidden><div class="pesan-salah"></div></div>' +
      '<div class="pratinjau" id="pratinjau" hidden></div>';
    var jd = judulIsi(tab, ubah);
    kerangka(jd.judul, jd.sub, '<form id="formulir" novalidate>' + html + '</form>', {kembali: kembali, tanpaNav: true});
    app.insertAdjacentHTML('beforeend', '<div class="aksi-bawah"><button class="tombol kedua" id="tombol-kosong" type="button">' + (ubah ? 'Batal' : 'Kosongkan') + '</button>' +
      '<button class="tombol utama" id="tombol-simpan" type="button">' + (ubah ? 'Simpan perubahan' : 'Simpan') + '</button></div>');

    var form = document.getElementById('formulir');
    var segarkan = function () {
      var n = bacaIsian(bidang, true).nilai;
      var mentah = bacaMentah(bidang);
      bidang.forEach(function (b, i) {
        var el = document.getElementById('b' + i);
        if (el) el.hidden = !terlihat(b, mentah);
      });
      var p = FORM[tab].pratinjau ? FORM[tab].pratinjau(n, bidang) : null;
      var kotak = document.getElementById('pratinjau');
      kotak.hidden = !p; kotak.innerHTML = p ? p.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') : '';
      bidang.forEach(function (b, i) {
        if (b.j !== 'rupiah') return;
        var pet = document.getElementById('pet' + i);
        if (pet) pet.textContent = n[b.h] > 0 ? rp(n[b.h]) : '';
      });
      if (!ubah) simpan('draf.' + kunci, mentah);
    };
    var hapusSalah = function (t) {
      var b = t.closest('.bidang');
      if (!b) return;
      b.classList.remove('salah');
      var p = b.querySelector(':scope > .pesan-salah'); if (p) { p.hidden = true; p.textContent = ''; }
    };
    form.addEventListener('input', function (ev) { hapusSalah(ev.target); segarkan(); });
    form.addEventListener('change', function (ev) {
      var t = ev.target;
      hapusSalah(t);
      if (t.dataset && t.dataset.lainnya !== undefined) {
        var kotak = document.getElementById('lt' + t.dataset.lainnya);
        if (kotak) { kotak.hidden = !t.checked; if (t.checked) kotak.focus(); }
      }
      if (t.type === 'radio') {
        var wadah = t.closest('.bidang');
        var lain = wadah && wadah.querySelector('input[data-lainnya]');
        if (lain && t !== lain) { var k2 = document.getElementById('lt' + lain.dataset.lainnya); if (k2) k2.hidden = true; }
      }
      segarkan();
    });
    segarkan();

    document.getElementById('tombol-kosong').addEventListener('click', function () {
      if (ubah) { location.hash = kembali; return; }
      if (!confirm('Kosongkan semua isian di formulir ini?')) return;
      buang('draf.' + kunci); layarIsi(kunci);
    });
    document.getElementById('tombol-simpan').addEventListener('click', function () {
      var hasil = bacaIsian(bidang, false);
      var salah = hasil.salah.concat(FORM[tab].cek ? FORM[tab].cek(hasil.nilai, bidang) : []);
      tandaiSalah(salah);
      if (salah.length) { toast('Ada isian yang perlu diperbaiki.'); return; }
      if (!absensiBaru) {
        var kepala = konfig.kepala[tab] || [];
        var asing = Object.keys(hasil.nilai).filter(function (h) { return kepala.indexOf(h) < 0; });
        if (asing.length) { toast('Aplikasi perlu diperbarui (kolom ' + asing.join(', ') + ' tidak ada). Buka Akun > Perbarui pilihan.', 6000); return; }
      }
      var tombolSimpan = document.getElementById('tombol-simpan');

      if (ubah) {
        // Kirim semua kolom formulir: yang kosong atau tersembunyi ikut dikosongkan di Sheet.
        var nilaiUbah = {};
        bidang.forEach(function (b) { if (b.h) nilaiUbah[b.h] = hasil.nilai[b.h] !== undefined ? hasil.nilai[b.h] : ''; });
        konfirmasi(tab, bidang, hasil.nilai, function () {
          tombolSimpan.disabled = true; tombolSimpan.textContent = 'Menyimpan…';
          panggil('ubah', {tab: tab, nomor: ubah.nomor, tanda: ubah.tanda, nilai: nilaiUbah}).then(function (r) {
            if (r && r.ok) { sedangDiubah = null; toast('Catatan sudah diperbarui di Google Sheet.'); location.hash = kembali; return; }
            tombolSimpan.disabled = false; tombolSimpan.textContent = 'Simpan perubahan';
            toast((r && r.galat) || 'Gagal menyimpan perubahan.', 6000);
            if (r && r.kode === 'BERUBAH') { sedangDiubah = null; location.hash = kembali; }
          }, function (e) {
            tombolSimpan.disabled = false; tombolSimpan.textContent = 'Simpan perubahan';
            toast(e.jaringan ? 'Perlu sinyal untuk mengubah catatan. Coba lagi nanti.' : e.message, 6000);
          });
        }, 'Benar, simpan perubahan');
        return;
      }

      var kirim = absensiBaru ? dataAbsensi(hasil.nilai, bidang) : hasil.nilai;
      var lanjut = function () {
        konfirmasi(tab, bidang, hasil.nilai, function () {
          antrian.push({id: idBaru(), tab: tab, nilai: kirim, waktu: Date.now(), status: 'menunggu'});
          simpanAntrian();
          buang('draf.' + kunci);
          location.hash = '#/';
          toast(navigator.onLine ? 'Tersimpan. Sedang dikirim…' : 'Tersimpan di HP. Akan dikirim saat ada sinyal.');
          kirimAntrian();
        });
      };
      if (tab !== 'Absensi') { lanjut(); return; }
      tombolSimpan.disabled = true;
      (absensiBaru ? cekAbsensiDobel(kirim) : cekAbsensiDobelLama(hasil.nilai)).then(function (boleh) {
        tombolSimpan.disabled = false;
        if (boleh) lanjut();
      });
    });
  }

  // Nilai dari Sheet menjadi isian formulir (untuk mode ubah).
  function mentahDariNilai(bidang, nilai) {
    var out = {};
    bidang.forEach(function (b) {
      if (!b.h) return;
      var v = nilai[b.h];
      if (v === undefined || v === null || v === '') return;
      if (b.j === 'centang') out[b.h] = String(v).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
      else if (b.j === 'desimal') out[b.h] = String(v).replace('.', ',');
      else out[b.h] = String(v);
    });
    return out;
  }

  // Satu orang tidak boleh tercatat dua kali di tanggal yang sama dengan isi berbeda (upah bisa dobel).
  function cekAbsensiDobel(data) {
    var iso = data['Tanggal'], tgl = tglIndo(iso);
    var nama = data.baris.map(function (b) { return b.nama; });
    var diHp = antrian.some(function (a) {
      return a.tab === 'Absensi' && a.nilai['Tanggal'] === iso && (a.nilai.baris || []).some(function (b) { return nama.indexOf(b.nama) >= 0; });
    });
    if (diHp) return Promise.resolve(confirm('Absensi tanggal ' + tgl + ' untuk orang yang sama sudah tersimpan di HP ini dan menunggu dikirim.\n\nTetap simpan?'));
    if (!navigator.onLine || !data.baris.length) return Promise.resolve(true);
    toast('Memeriksa absensi tanggal ' + tgl + '…', 2500);
    return panggil('terbaru', {tab: 'Absensi', n: 60}, 12000).then(function (r) {
      if (!r || !r.ok) return true;
      var k = r.kepala, iT = k.indexOf('Tanggal'), iN = k.indexOf('Nama'), iP = k.indexOf('Pekerjaan'), iU = k.indexOf('Upah (Rp)');
      if (iN < 0) return true;
      var hari = r.baris.filter(function (row) { return row[iT] === tgl; });
      var bentrok = [], sama = 0;
      data.baris.forEach(function (b) {
        var lain = b.pekerjaan === 'Kerja lain';
        var ada = hari.filter(function (row) { return row[iN] === b.nama && ((row[iP] === 'Kerja lain') === lain); })[0];
        if (!ada) return;
        var upahAda = Number(String(ada[iU] || '').replace(/[^\d]/g, '')) || 0;
        if (ada[iP] === b.pekerjaan && (!lain || upahAda === Number(b.upah))) sama++;
        else bentrok.push(b.nama + ' sudah tercatat "' + ada[iP] + (lain ? ' ' + ada[iU] : '') + '"');
      });
      if (bentrok.length) {
        alert('Absensi ' + tgl + ': ' + bentrok.join('; ') + '.\n\nKalau salah, pemilik bisa mengubahnya lewat Riwayat.');
        return false;
      }
      if (sama === data.baris.length && !data['Keterangan']) {
        toast('Absensi tanggal ' + tgl + ' ini sudah tercatat sebelumnya.', 4000);
        return false;
      }
      return true;
    }, function () { return true; });
  }

  // Format lama: satu tanggal = satu baris absensi.
  function cekAbsensiDobelLama(nilai) {
    var iso = nilai['Tanggal'], tgl = tglIndo(iso);
    var orang = Object.keys(nilai).filter(function (h) { return /^(.+) \[(.+)\]$/.test(h); });
    var nama = function (h) { return /\[(.+)\]$/.exec(h)[1]; };
    var diHp = antrian.some(function (a) {
      return a.tab === 'Absensi' && a.nilai['Tanggal'] === iso && orang.some(function (h) { return a.nilai[h]; });
    });
    if (diHp) return Promise.resolve(confirm('Absensi tanggal ' + tgl + ' untuk orang yang sama sudah tersimpan di HP ini dan menunggu dikirim.\n\nTetap simpan?'));
    if (!navigator.onLine) return Promise.resolve(true);
    toast('Memeriksa absensi tanggal ' + tgl + '…', 2500);
    return panggil('terbaru', {tab: 'Absensi', n: 15}, 12000).then(function (r) {
      if (!r || !r.ok) return true;
      var iT = r.kepala.indexOf('Tanggal');
      var baris = r.baris.filter(function (row) { return row[iT] === tgl; })[0];
      if (!baris) return true;
      var bentrok = [], sama = 0;
      orang.forEach(function (h) {
        var i = r.kepala.indexOf(h);
        if (i < 0 || !baris[i] || baris[i] === '-') return;
        if (baris[i] === nilai[h]) sama++;
        else bentrok.push(nama(h) + ' sudah tercatat "' + baris[i] + '"');
      });
      if (bentrok.length) {
        alert('Absensi ' + tgl + ': ' + bentrok.join('; ') + '.\n\nKalau salah, pemilik bisa mengubahnya lewat Riwayat.');
        return false;
      }
      if (orang.length && sama === orang.length && !nilai['Keterangan'] && !nilai['Pekerjaan lain']) {
        toast('Absensi tanggal ' + tgl + ' ini sudah tercatat sebelumnya.', 4000);
        return false;
      }
      return true;
    }, function () { return true; });
  }

  function htmlBidang(b, i, draf) {
    var id = 'b' + i;
    var wajib = b.wajib !== false;
    var label = b.label || b.h;
    var kepala = b.tanpaLabel ? '' : '<span class="label">' + esc(label) + (wajib ? '' : ' <span class="opsional">(boleh kosong)</span>') + '</span>' +
      (b.bantuan ? '<div class="bantuan">' + esc(b.bantuan) + '</div>' : '');
    var d = draf[b.h];
    if ((d === undefined || d === '') && b.bawaan && b.j === 'pilih') d = b.bawaan;
    var isi = '';
    if (b.j === 'tanggal') {
      isi = '<input class="masukan" type="date" name="' + id + '" value="' + esc(d || (b.bebas ? '' : hariIni())) + '"' + (b.bebas ? '' : ' max="' + hariIni() + '"') + '>';
    } else if (b.j === 'pilih' || b.j === 'kisiBaris' || b.j === 'centang') {
      var tipe = b.j === 'centang' ? 'checkbox' : 'radio';
      var pilihan = opsiBidang(b);
      var terpilih = Array.isArray(d) ? d : (d ? [d] : []);
      var lainTeks = terpilih.filter(function (v) { return pilihan.indexOf(v) < 0; })[0] || '';
      isi = '<div class="chips">' + pilihan.map(function (o) {
        return '<label class="chip"><input type="' + tipe + '" name="' + id + '" value="' + esc(o) + '"' + (terpilih.indexOf(o) >= 0 ? ' checked' : '') + '><span>' + esc(o) + '</span></label>';
      }).join('') +
      (b.lainnya ? '<label class="chip"><input type="' + tipe + '" name="' + id + '" value="__lain" data-lainnya="' + i + '"' + (lainTeks ? ' checked' : '') + '><span>Lainnya…</span></label>' : '') +
      '</div>' +
      (b.lainnya ? '<input class="masukan lainnya-teks" id="lt' + i + '" placeholder="Tulis ' + esc(label.toLowerCase()) + ' lainnya" value="' + esc(lainTeks) + '"' + (lainTeks ? '' : ' hidden') + '>' : '');
      if (b.j === 'kisiBaris' && b.wajib === false && pilihan.length) {
        isi = isi.replace('<div class="chips">', '<div class="chips"><label class="chip lewati"><input type="radio" name="' + id + '" value=""' + (terpilih.length ? '' : ' checked') + '><span>Tidak diisi</span></label>');
      }
      if (!pilihan.length) isi = '<div class="galat-kartu">Daftar pilihan kosong. Buka Akun > Perbarui pilihan.</div>';
    } else if (b.j === 'daftar') {
      isi = '<select class="masukan" name="' + id + '"><option value="">Pilih…</option>' + opsiBidang(b).map(function (o) {
        return '<option' + (d === o ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('') + '</select>';
    } else if (b.j === 'rupiah' || b.j === 'angka') {
      var awal = d !== undefined ? d : (b.bawaan || '');
      isi = '<input class="masukan" type="text" inputmode="numeric" name="' + id + '" value="' + esc(awal) + '" placeholder="' + (b.j === 'rupiah' ? 'contoh 250000' : '') + '">' +
        (b.j === 'rupiah' ? '<div class="petunjuk-angka" id="pet' + i + '"></div>' : '');
    } else if (b.j === 'desimal') {
      isi = '<input class="masukan" type="text" inputmode="decimal" name="' + id + '" value="' + esc(d || '') + '">';
    } else if (b.j === 'teks') {
      isi = '<input class="masukan" type="text" name="' + id + '" value="' + esc(d || '') + '" autocomplete="off">';
    } else if (b.j === 'paragraf') {
      isi = '<textarea class="masukan" name="' + id + '">' + esc(d || '') + '</textarea>';
    }
    var kelas = 'bidang' + (b.kelas ? ' ' + b.kelas : '');
    if (b.j === 'kisiBaris') {
      return '<div class="' + kelas + ' baris-kisi" id="' + id + '" data-h="' + esc(b.h) + '"><div class="nama">' + esc(b.kelompok) + ': ' + esc(b.label) + '</div>' + isi + '<div class="pesan-salah" hidden></div></div>';
    }
    return '<div class="' + kelas + '" id="' + id + '" data-h="' + esc(b.h) + '">' + kepala + isi + '<div class="pesan-salah" hidden></div></div>';
  }

  // Nilai mentah (untuk draf), dikunci dengan judul kolom.
  function bacaMentah(bidang) {
    var out = {};
    bidang.forEach(function (b, i) {
      var nama = 'b' + i;
      if (b.j === 'pilih' || b.j === 'kisiBaris' || b.j === 'centang') {
        var dipilih = [].slice.call(document.querySelectorAll('input[name="' + nama + '"]:checked')).map(function (x) {
          return x.value === '__lain' ? (document.getElementById('lt' + i) || {}).value || '' : x.value;
        }).filter(function (v) { return v; });
        out[b.h] = b.j === 'centang' ? dipilih : (dipilih[0] || '');
      } else {
        var el = document.querySelector('[name="' + nama + '"]');
        if (el) out[b.h] = el.value;
      }
    });
    return out;
  }

  function angkaBulat(s) { var t = String(s || '').replace(/[^\d]/g, ''); return t ? parseInt(t, 10) : NaN; }
  function angkaDesimal(s, ribuan) {
    var t = String(s || '').trim().replace(/\s/g, '');
    if (!t) return NaN;
    if (t.indexOf('.') >= 0 && t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');   // 1.075,5
    else if (ribuan && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');                    // 1.075 (berat)
    else t = t.replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
  }

  // Membaca isian menjadi nilai siap kirim. diam = true: tanpa pesan salah (untuk pratinjau).
  function bacaIsian(bidang, diam) {
    var mentah = bacaMentah(bidang);
    var nilai = {}, salah = [];
    bidang.forEach(function (b) {
      if (!b.h) return;
      if (!terlihat(b, mentah)) return;
      var v = mentah[b.h];
      var wajib = b.wajib !== false;
      var kosong = v === undefined || v === '' || (Array.isArray(v) && !v.length);
      if (kosong) { if (wajib) salah.push([b.h, b.j === 'kisiBaris' ? 'Pilih salah satu.' : 'Wajib diisi.']); return; }
      if (b.j === 'rupiah' || b.j === 'angka') {
        var x = angkaBulat(v);
        if (isNaN(x)) { salah.push([b.h, 'Tulis angka saja.']); return; }
        nilai[b.h] = x;
      } else if (b.j === 'desimal') {
        var y = angkaDesimal(v, b.ribuan);
        if (isNaN(y)) { salah.push([b.h, 'Tulis angka, contoh 3,28.']); return; }
        nilai[b.h] = y;
      } else if (b.j === 'tanggal') {
        if (!b.bebas && v > hariIni()) { salah.push([b.h, 'Tanggal tidak boleh setelah hari ini.']); return; }
        nilai[b.h] = v;
      } else if (typeof v === 'string') {
        nilai[b.h] = v.trim();
      } else {
        nilai[b.h] = v;
      }
    });
    return {nilai: nilai, salah: diam ? [] : salah};
  }

  function tandaiSalah(salah) {
    document.querySelectorAll('.bidang').forEach(function (el) {
      el.classList.remove('salah');
      var p = el.querySelector(':scope > .pesan-salah'); if (p) { p.hidden = true; p.textContent = ''; }
    });
    var pertama = null;
    salah.forEach(function (s) {
      var el = [].slice.call(document.querySelectorAll('.bidang')).filter(function (x) { return x.dataset.h === s[0]; })[0];
      if (!el) return;
      el.hidden = false;
      el.classList.add('salah');
      var p = el.querySelector(':scope > .pesan-salah'); if (p) { p.hidden = false; p.textContent = s[1]; }
      if (!pertama) pertama = el;
    });
    if (pertama) pertama.scrollIntoView({behavior: 'smooth', block: 'center'});
  }

  function tampilNilai(b, v) {
    if (Array.isArray(v)) return v.join(', ');
    if (b.j === 'rupiah') return rp(v);
    if (b.j === 'desimal' || b.j === 'angka') return ang(v);
    if (b.j === 'tanggal') return tglIndo(v);
    return String(v);
  }

  function labelRingkas(b) {
    if (b.j === 'kisiBaris') return b.label;
    if (/^A\|/.test(b.h)) return 'Alat ' + b.h.slice(2);
    if (/^K\|/.test(b.h)) return 'Kerja lain ' + b.h.slice(2);
    if (/^KP\|/.test(b.h)) return 'Pekerjaan lain ' + b.h.slice(3);
    if (/^KK\|/.test(b.h)) return 'Kerja lain untuk (' + b.h.slice(3) + ')';
    return b.label || b.h;
  }

  function konfirmasi(tab, bidang, nilai, lanjut, labelKirim) {
    var baris = bidang.filter(function (b) { return b.h && nilai[b.h] !== undefined && nilai[b.h] !== '' && !/^K\|/.test(b.h); }).map(function (b) {
      return '<li><span>' + esc(labelRingkas(b)) + '</span><b>' + esc(tampilNilai(b, nilai[b.h])) + '</b></li>';
    }).join('');
    var p = FORM[tab].pratinjau ? FORM[tab].pratinjau(nilai, bidang) : null;
    var div = document.createElement('div');
    div.className = 'tirai';
    div.innerHTML = '<div class="lembar" role="dialog" aria-modal="true"><h2>Periksa lagi</h2><p class="sub">' + esc(tab) + '</p>' +
      '<ul class="ringkas">' + baris + '</ul>' +
      (p ? '<div class="pratinjau">' + p.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') + '</div>' : '') +
      '<div class="baris-tombol"><button class="tombol kedua" data-aksi="ubah">Ubah</button><button class="tombol utama" data-aksi="kirim">' + esc(labelKirim || 'Benar, simpan') + '</button></div></div>';
    document.body.appendChild(div);
    div.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-aksi]');
      if (ev.target === div || (a && a.dataset.aksi === 'ubah')) { div.remove(); return; }
      if (a && a.dataset.aksi === 'kirim') { div.remove(); lanjut(); }
    });
  }

  // ------------------------------------------------------------ layar: riwayat (entri terakhir)
  function layarTerbaru(kunci) {
    var tabBoleh = (sesi.tab || []).filter(function (t) { return FORM[t]; });
    var tab = tabDariKunci(kunci) || tabBoleh[0];
    if (!tab || tabBoleh.indexOf(tab) < 0) tab = tabBoleh[0];
    if (!tab) { kerangka('Riwayat', '', '<div class="kosong">Tidak ada catatan.</div>', {aktif: 'terbaru'}); return; }
    var k = FORM[tab].kunci;
    var n = jumlahRiwayat[k] || 10;
    var pilih = '<div class="pilih-tab">' + tabBoleh.map(function (t) {
      return '<button data-ke="#/terbaru/' + FORM[t].kunci + '" class="' + (t === tab ? 'aktif' : '') + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
    var tunggu = antrian.filter(function (a) { return a.tab === tab; });
    var htmlTunggu = tunggu.length ? '<div class="pratinjau awas">' + tunggu.length + ' catatan ' + esc(tab) + ' masih di HP, belum masuk Sheet.</div>' : '';
    var cache = ambil('terbaru.' + k, null);
    var data = cache;
    kerangka('Riwayat', n + ' catatan terakhir di Google Sheet', pilih + htmlTunggu + '<div id="daftar-entri">' +
      (cache ? htmlEntri(tab, cache, n) : '<div class="memuat">Memuat…</div>') + '</div>', {aktif: 'terbaru', muat: true});
    var muat = function () {
      panggil('terbaru', {tab: tab, n: n}).then(function (r) {
        if (!r.ok) throw new Error(r.galat || 'Gagal memuat.');
        data = r;
        simpan('terbaru.' + k, r);
        var el = document.getElementById('daftar-entri');
        if (el && location.hash.indexOf('#/terbaru') === 0) el.innerHTML = htmlEntri(tab, r, n);
      }).catch(function (e) {
        var el = document.getElementById('daftar-entri');
        if (!el) return;
        if (cache) toast(e.message + ' Menampilkan data terakhir yang tersimpan.');
        else el.innerHTML = '<div class="galat-kartu">' + esc(e.message) + '</div>';
      });
    };
    document.getElementById('tombol-muat').addEventListener('click', function () { toast('Memuat ulang…', 1500); muat(); });
    document.getElementById('daftar-entri').addEventListener('click', function (ev) {
      var lebih = ev.target.closest('[data-lebih]');
      if (lebih) { jumlahRiwayat[k] = Math.min(n + 20, 60); layarTerbaru(k); return; }
      var tUbah = ev.target.closest('[data-ubah-entri]'), tHapus = ev.target.closest('[data-hapus-entri]');
      var el = tUbah || tHapus;
      if (!el && !ev.target.closest('button')) {
        var kartuDiketuk = ev.target.closest('.entri[data-idx]');
        if (kartuDiketuk && data && data.baris) tampilRincian(tab, data.kepala, data.baris[Number(kartuDiketuk.dataset.idx)]);
        return;
      }
      if (!el || !data || !data.data) return;
      var d = data.data[Number(el.dataset.ubahEntri || el.dataset.hapusEntri)];
      if (!d) return;
      if (tUbah) {
        sedangDiubah = {tab: tab, nomor: d.nomor, tanda: d.tanda, nilai: d.nilai};
        location.hash = '#/ubah/' + k;
        return;
      }
      var kartu = el.closest('.entri');
      tanyaYa('Hapus catatan ini?', tab + ' · ' + (kartu ? kartu.querySelector('h3 span').textContent : ''),
        'Catatan akan hilang dari Google Sheet dan semua rekap ikut berubah. Isinya tetap tersimpan di tab Log Aplikasi kalau perlu dikembalikan.',
        'Ya, hapus', function () {
          el.disabled = true; el.textContent = 'Menghapus…';
          panggil('hapus', {tab: tab, nomor: d.nomor, tanda: d.tanda}).then(function (r) {
            if (r && r.ok) { toast('Catatan dihapus dari Google Sheet.'); muat(); return; }
            toast((r && r.galat) || 'Gagal menghapus.', 6000); muat();
          }, function (e) {
            el.disabled = false; el.textContent = 'Hapus';
            toast(e.jaringan ? 'Perlu sinyal untuk menghapus catatan.' : e.message, 6000);
          });
        });
    });
    document.getElementById('daftar-entri').addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var kartu = ev.target.closest && ev.target.closest('.entri[data-idx]');
      if (kartu && ev.target === kartu && data && data.baris) tampilRincian(tab, data.kepala, data.baris[Number(kartu.dataset.idx)]);
    });
    muat();
  }

  // Rincian satu catatan, hanya untuk dibaca.
  function tampilRincian(tab, kepala, baris) {
    if (!baris) return;
    var LABEL = {'Timestamp': 'Waktu dikirim', 'Hari': 'Hari'};
    var isi = kepala.map(function (h, i) {
      var v = baris[i];
      if (!h || v === '' || v === null || v === undefined || v === '-' || v === '–') return '';
      return '<li><span>' + esc(LABEL[h] || h) + '</span><b>' + esc(v) + '</b></li>';
    }).join('');
    var tglI = kepala.indexOf('Tanggal') >= 0 ? kepala.indexOf('Tanggal') : kepala.indexOf('Tanggal saring');
    var div = document.createElement('div');
    div.className = 'tirai';
    div.innerHTML = '<div class="lembar" role="dialog" aria-modal="true"><h2>Rincian ' + esc(tab) + '</h2>' +
      '<p class="sub">' + esc(tglI >= 0 ? baris[tglI] : '') + ' · hanya untuk dibaca</p>' +
      '<ul class="rincian">' + isi + '</ul>' +
      '<div class="baris-tombol"><button class="tombol kedua" data-aksi="tutup">Tutup</button></div></div>';
    document.body.appendChild(div);
    var tutup = function () { div.remove(); };
    div.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-aksi]');
      if (ev.target === div || (a && a.dataset.aksi === 'tutup')) tutup();
    });
  }

  function tanyaYa(judul, sub, teks, labelYa, lanjut) {
    var div = document.createElement('div');
    div.className = 'tirai';
    div.innerHTML = '<div class="lembar" role="dialog" aria-modal="true"><h2>' + esc(judul) + '</h2>' +
      (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') +
      '<p style="margin:0 0 16px;font-size:14px">' + esc(teks) + '</p>' +
      '<div class="baris-tombol"><button class="tombol kedua" data-aksi="batal">Batal</button><button class="tombol bahaya" data-aksi="ya">' + esc(labelYa) + '</button></div></div>';
    document.body.appendChild(div);
    div.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-aksi]');
      if (ev.target === div || (a && a.dataset.aksi === 'batal')) { div.remove(); return; }
      if (a && a.dataset.aksi === 'ya') { div.remove(); lanjut(); }
    });
  }

  function htmlEntri(tab, r, n) {
    if (!r.baris || !r.baris.length) return '<div class="kosong">Belum ada catatan.</div>';
    var k = r.kepala;
    var kelola = bisaKelola() && r.data && r.data.length === r.baris.length;
    var html = r.baris.map(function (row, idx) {
      var g = function (h) { var i = k.indexOf(h); return i >= 0 ? row[i] : ''; };
      var e = function (h) { return esc(g(h)); };
      var judul = '', baris = [], ket = g('Keterangan');
      if (tab === 'Ambil Bahan') {
        judul = g('Tanggal') + ' · ' + g('Pengumpul');
        baris.push(e('Berat bahan (kg)') + ' kg · ' + e('Kondisi bahan'));
        baris.push('Beli bahan ' + e('Uang beli bahan (Rp)') + ' · ' + e('Harga bahan per kg (Rp)') + '/kg');
        baris.push('<span class="redup">' + e('Daerah') + '</span>');
      } else if (tab === 'Saring Minyak') {
        judul = g('Tanggal saring');
        baris.push(e('Minyak (kg)') + ' kg dari ' + e('Jumlah sulingan yang disaring') + ' sulingan (' + e('Minyak per sulingan (kg)') + ' kg/sulingan)');
        baris.push('Alat: ' + e('Kondisi alat') + ' · Bahan: ' + e('Kondisi bahan'));
      } else if (tab === 'Absensi' && k.indexOf('Nama') >= 0) {
        judul = g('Tanggal') + ' · ' + (g('Nama') || 'Keterangan');
        if (g('Nama')) baris.push(e('Pekerjaan') + (g('Alat') ? ' · ' + e('Alat') : '') + ' · <b>' + e('Upah (Rp)') + '</b>');
        if (g('Pekerjaan lain')) baris.push('Kerja lain: ' + e('Pekerjaan lain') + (g('Kerja lain untuk') ? ' (' + e('Kerja lain untuk') + ')' : ''));
        if (g('Diisi oleh')) baris.push('<span class="redup">Diisi ' + e('Diisi oleh') + '</span>');
      } else if (tab === 'Absensi') {
        judul = g('Tanggal');
        k.forEach(function (h, i) { var m = /^(.+) \[(.+)\]$/.exec(h); if (m && row[i]) baris.push(esc(m[2]) + ': ' + esc(row[i])); });
        baris.push('<span class="redup">Upah: pengumpulan ' + e('Upah pengumpulan') + ' · suling ' + e('Upah penyulingan') + ' · harian & lain ' + e('Upah kerja harian & lain') + '</span>');
        if (g('Pekerjaan lain')) baris.push('Kerja lain: ' + e('Pekerjaan lain'));
      } else if (tab === 'Penjualan') {
        judul = g('Tanggal') + ' · ' + g('Pembeli');
        baris.push(e('Jumlah') + ' ' + e('Satuan') + ' ' + e('Produk'));
        baris.push(e('Harga satuan (Rp)') + ' × ' + e('Jumlah') + ' = <b>' + e('Total (Rp)') + '</b> · ' + e('Status bayar'));
      } else if (tab === 'Kas') {
        judul = g('Tanggal') + ' · ' + g('Kategori');
        baris.push((g('Arah') === 'Masuk' ? 'Masuk ' : 'Keluar ') + '<b>' + e('Jumlah (Rp)') + '</b>');
        if (ket) { baris.push(esc(ket)); ket = ''; }
      }
      return '<div class="kartu entri bisa-ketuk" data-idx="' + idx + '" role="button" tabindex="0" aria-label="Lihat rincian">' +
        '<h3><span>' + esc(judul) + '</span><small>' + esc(String(g('Timestamp')).slice(-5)) + ' ›</small></h3>' +
        baris.map(function (x) { return '<p>' + x + '</p>'; }).join('') +
        (ket ? '<div class="ket">' + esc(ket) + '</div>' : '') +
        (kelola ? '<div class="aksi-entri"><button class="tombol kedua" data-ubah-entri="' + idx + '">Ubah</button>' +
          '<button class="tombol bahaya" data-hapus-entri="' + idx + '">Hapus</button></div>' : '') +
        '</div>';
    }).join('');
    if (r.baris.length >= (n || 10) && (n || 10) < 60) html += '<button class="tombol kedua penuh" style="margin-top:12px" data-lebih="1">Tampilkan lebih banyak</button>';
    return html;
  }

  // ------------------------------------------------------------ layar: antrian
  function infoAntrian(a) {
    if (a.nilai.baris) return a.nilai.baris.map(function (b) { return b.nama + ': ' + b.pekerjaan; }).join(' · ') || (a.nilai['Keterangan'] || '');
    return Object.keys(a.nilai).filter(function (h) { return !/^Tanggal/.test(h); }).slice(0, 3).map(function (h) {
      var v = a.nilai[h]; return Array.isArray(v) ? v.join(', ') : v;
    }).join(' · ');
  }

  function layarAntrian() {
    var isi = antrian.length ? antrian.map(function (a) {
      var tgl = a.nilai['Tanggal'] || a.nilai['Tanggal saring'] || '';
      return '<div class="kartu entri"><h3><span>' + esc(a.tab) + ' · ' + esc(tglIndo(tgl)) + '</span><small>' + (a.status === 'galat' ? 'Gagal' : 'Menunggu') + '</small></h3>' +
        '<p class="redup">' + esc(infoAntrian(a)) + '</p>' +
        (a.galat ? '<div class="galat-kartu" style="margin-top:8px">' + esc(a.galat) + '</div>' : '') +
        '<div class="baris-tombol" style="display:flex;gap:10px;margin-top:10px">' +
        '<button class="tombol kedua" style="flex:1" data-ulang="' + esc(a.id) + '">Kirim ulang</button>' +
        '<button class="tombol bahaya" style="flex:1" data-hapus="' + esc(a.id) + '">Hapus</button></div></div>';
    }).join('') : '<div class="kosong">Tidak ada catatan yang menunggu. Semua sudah masuk Google Sheet.</div>';
    kerangka('Belum terkirim', antrian.length + ' catatan', isi, {kembali: '#/', aktif: 'beranda'});
    app.querySelector('.isi').addEventListener('click', function (ev) {
      var u = ev.target.closest('[data-ulang]'), h = ev.target.closest('[data-hapus]');
      if (u) {
        antrian.forEach(function (a) { if (a.id === u.dataset.ulang) { a.status = 'menunggu'; a.galat = ''; } });
        simpanAntrian(); toast('Mengirim…', 1500);
        kirimAntrian().then(layarAntrian);
      }
      if (h && confirm('Hapus catatan ini dari HP? Catatan yang dihapus tidak akan masuk Google Sheet.')) {
        antrian = antrian.filter(function (a) { return a.id !== h.dataset.hapus; });
        simpanAntrian(); layarAntrian();
      }
    });
  }

  // ------------------------------------------------------------ layar: akun
  function layarAkun() {
    var menuPemilik = '';
    if (sesi.semua) {
      if (v6()) {
        menuPemilik = '<div class="judul-bagian">Pengaturan (pemilik)</div><div class="kartu menu-atur">' +
          [['#/pengguna', 'Pengguna & PIN', 'Tambah, hapus, ganti PIN dan hak akses'],
            ['#/karyawan', 'Karyawan', 'Tambah atau nonaktifkan karyawan'],
            ['#/alat', 'Alat suling', 'Tambah atau nonaktifkan alat'],
            ['#/tampilan', 'Tampilan', 'Nama, logo, warna, tombol, dan kartu'],
            ['#/formulir', 'Pertanyaan formulir', 'Ubah tulisan, urutan, dan tambah pertanyaan']].map(function (m) {
            return '<button class="baris-menu" data-ke="' + m[0] + '"><span><b>' + esc(m[1]) + '</b><small>' + esc(m[2]) + '</small></span>' + IKON.lanjut + '</button>';
          }).join('') + '</div>';
      } else if (bisaKelola()) {
        menuPemilik = '<div class="tumpuk" style="margin-top:16px"><button class="tombol utama penuh" data-ke="#/pin">Kelola PIN pekerja</button>' +
          '<div class="pratinjau awas">Kelola karyawan, alat, pengguna, dan tampilan butuh API versi 6 di Apps Script.</div></div>';
      } else {
        menuPemilik = '<div class="pratinjau awas" style="margin-top:16px">Fitur pengaturan butuh API versi baru di Apps Script.</div>';
      }
    }
    var isi = '<div class="kartu">' +
      (sesi.nama ? '<div class="info-baris"><span>Nama</span><b>' + esc(sesi.nama) + '</b></div>' : '') +
      '<div class="info-baris"><span>Peran</span><b>' + esc(sesi.peran) + '</b></div>' +
      '<div class="info-baris"><span>Boleh mengisi</span><b>' + esc((sesi.tab || []).join(', ')) + '</b></div>' +
      '<div class="info-baris"><span>Belum terkirim</span><b>' + antrian.length + ' catatan</b></div>' +
      '<div class="info-baris"><span>Versi aplikasi</span><b>' + esc(VERSI) + (DI_APK ? ' (APK)' : '') + (konfig && konfig.versiApi ? ' · API ' + konfig.versiApi : '') + '</b></div>' +
      '</div>' + menuPemilik +
      '<div class="tumpuk" style="margin-top:16px">' +
      '<button class="tombol kedua penuh" id="perbarui">Perbarui pilihan (nama, daerah, kategori)</button>' +
      (promptPasang && !DI_APK ? '<button class="tombol utama penuh" id="pasang">Pasang aplikasi di HP ini</button>' : '') +
      '<button class="tombol bahaya penuh" id="keluar">Keluar / ganti PIN</button></div>';
    kerangka('Akun', tampilan().namaUsaha, isi, {aktif: 'akun'});
    document.getElementById('perbarui').addEventListener('click', function (ev) {
      ev.target.disabled = true; ev.target.textContent = 'Memuat…';
      muatKonfig().then(function (r) { toast(r && r.ok ? 'Daftar pilihan sudah diperbarui.' : (r && r.galat) || 'Gagal.'); layarAkun(); },
        function (e) { toast(e.message); layarAkun(); });
    });
    var ps = document.getElementById('pasang');
    if (ps) ps.addEventListener('click', function () { promptPasang.prompt(); promptPasang = null; });
    document.getElementById('keluar').addEventListener('click', function () {
      if (antrian.length && !confirm('Masih ada ' + antrian.length + ' catatan belum terkirim. Tetap keluar? Catatan tetap tersimpan di HP.')) return;
      keluar();
    });
  }

  // ------------------------------------------------------------ alat bantu layar pengaturan
  function perluPemilik() {
    if (!pemilikV6()) { location.hash = '#/akun'; return true; }
    return false;
  }
  // Menjalankan aksi pengaturan, lalu memuat ulang konfigurasi.
  function aksiAtur(aksi, data, tombol, berhasil) {
    if (tombol) tombol.disabled = true;
    return panggil(aksi, data).then(function (r) {
      if (!r || !r.ok) { if (tombol) tombol.disabled = false; toast((r && r.galat) || 'Gagal menyimpan.', 6000); return null; }
      return muatKonfig().then(function () { return r; }, function () { return r; }).then(function (x) { if (berhasil) berhasil(x); return x; });
    }, function (e) {
      if (tombol) tombol.disabled = false;
      toast(e.jaringan ? 'Perlu sinyal untuk menyimpan pengaturan.' : e.message, 6000);
      return null;
    });
  }
  function lembar(html, siap) {
    var div = document.createElement('div');
    div.className = 'tirai';
    div.innerHTML = '<div class="lembar" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(div);
    div.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-aksi="tutup"]');
      if (ev.target === div || a) div.remove();
    });
    if (siap) siap(div, function () { div.remove(); });
    return div;
  }
  function pilihanChip(nama, opsi, nilai, tipe) {
    var dipilih = Array.isArray(nilai) ? nilai : [nilai];
    return '<div class="chips">' + opsi.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<label class="chip"><input type="' + (tipe || 'radio') + '" name="' + nama + '" value="' + esc(v) + '"' + (dipilih.indexOf(v) >= 0 ? ' checked' : '') + '><span>' + esc(l) + '</span></label>';
    }).join('') + '</div>';
  }
  function nilaiChip(akar, nama) {
    return [].slice.call(akar.querySelectorAll('input[name="' + nama + '"]:checked')).map(function (x) { return x.value; });
  }

  // ------------------------------------------------------------ layar: pengguna & PIN (pemilik)
  function layarPengguna() {
    if (perluPemilik()) return;
    kerangka('Pengguna & PIN', 'Setiap orang punya PIN sendiri', '<div id="daftar-pengguna"><div class="memuat">Memuat…</div></div>' +
      '<button class="tombol utama penuh" id="tambah-pengguna" style="margin-top:14px">' + IKON.tambah + 'Tambah pengguna</button>', {kembali: '#/akun', tanpaNav: true});
    var daftar = [];
    var tulis = function () {
      var el = document.getElementById('daftar-pengguna');
      if (!el) return;
      el.innerHTML = daftar.map(function (u, i) {
        var akses = u.peran === 'Pemilik' ? 'Semua catatan + pengaturan'
          : [u.boleh, u.peran === 'Mandor' ? 'absensi semua karyawan' : (u.absenUntuk ? 'absen: ' + u.absenUntuk : '')].filter(function (x) { return x; }).join(' · ');
        return '<div class="kartu pengguna' + (u.aktif ? '' : ' nonaktif') + '"><div class="baris-judul"><h2>' + esc(u.nama) + (u.saya ? ' (Anda)' : '') + '</h2>' +
          '<span class="chip-status ' + (u.peran === 'Pemilik' ? 'perlu' : (u.peran === 'Mandor' ? 'netral' : 'aman')) + '">' + esc(u.peran.toUpperCase()) + '</span></div>' +
          '<p class="sub">PIN <b class="pin-tampil">' + esc(u.pin) + '</b>' + (u.aktif ? '' : ' · <b>nonaktif</b>') + '</p>' +
          '<p class="sub">' + esc(akses || 'Belum diberi akses') + '</p>' +
          (u.catatan ? '<p class="sub redup">' + esc(u.catatan) + '</p>' : '') +
          '<div class="aksi-entri"><button class="tombol kedua" data-ubah="' + i + '">Ubah</button>' +
          (u.saya ? '' : '<button class="tombol bahaya" data-hapus="' + i + '">Hapus</button>') + '</div></div>';
      }).join('') + '<p class="catatan-kecil">PIN baru langsung berlaku. Orang yang sedang masuk dengan PIN lama akan diminta memasukkan PIN baru.</p>';
    };
    var muat = function () {
      panggil('penggunaDaftar').then(function (r) {
        if (!r.ok) throw new Error(r.galat || 'Gagal memuat.');
        daftar = r.pengguna; tulis();
      }).catch(function (e) {
        var el = document.getElementById('daftar-pengguna');
        if (el) el.innerHTML = '<div class="galat-kartu">' + esc(e.message) + '</div>';
      });
    };
    document.getElementById('daftar-pengguna').addEventListener('click', function (ev) {
      var u = ev.target.closest('[data-ubah]'), h = ev.target.closest('[data-hapus]');
      if (u) formPengguna(daftar[Number(u.dataset.ubah)], daftar, muat);
      if (h) {
        var p = daftar[Number(h.dataset.hapus)];
        tanyaYa('Hapus pengguna ' + p.nama + '?', '', 'PIN-nya langsung tidak bisa dipakai. Catatan yang sudah ia kirim tetap ada.', 'Ya, hapus', function () {
          aksiAtur('penggunaHapus', {baris: p.baris, nama: p.nama}, h, function () { toast('Pengguna dihapus.'); muat(); });
        });
      }
    });
    document.getElementById('tambah-pengguna').addEventListener('click', function () { formPengguna(null, daftar, muat); });
    muat();
  }

  function pinAcak(daftar) {
    var pakai = daftar.map(function (u) { return u.pin; });
    for (var i = 0; i < 50; i++) {
      var p = String(1000 + Math.floor(Math.random() * 9000));
      if (pakai.indexOf(p) < 0 && !/(\d)\1\1/.test(p)) return p;
    }
    return String(100000 + Math.floor(Math.random() * 900000));
  }

  function formPengguna(u, daftar, setelah) {
    var baru = !u;
    u = u || {nama: '', pin: pinAcak(daftar), peran: 'Pekerja', boleh: '', absenUntuk: '', aktif: true, catatan: ''};
    var boleh = u.boleh ? u.boleh.split(',').map(function (x) { return x.trim(); }) : [];
    var absen = u.absenUntuk ? u.absenUntuk.split(',').map(function (x) { return x.trim(); }) : [];
    var opsiAbsen = (konfig.tim || []).map(function (t) { return ['Semua ' + t, 'Semua ' + t.toLowerCase()]; })
      .concat((konfig.karyawan || []).filter(function (k) { return k.aktif || absen.indexOf(k.nama) >= 0; }).map(function (k) { return [k.nama, k.nama]; }));
    var tabIsi = URUTAN_TAB.filter(function (t) { return t !== 'Absensi'; });
    lembar('<h2>' + (baru ? 'Tambah pengguna' : 'Ubah ' + esc(u.nama)) + '</h2>' +
      '<form id="form-pengguna" class="form-atur" novalidate>' +
      '<label class="bidang"><span class="label">Nama</span><input class="masukan" name="nama" value="' + esc(u.nama) + '" autocomplete="off"></label>' +
      '<label class="bidang"><span class="label">PIN (4–8 angka)</span><div class="baris-input"><input class="masukan pin-baru" name="pin" inputmode="numeric" maxlength="8" value="' + esc(u.pin) + '">' +
      '<button type="button" class="tombol kedua" id="pin-acak">Acak</button></div></label>' +
      '<div class="bidang"><span class="label">Peran</span>' + pilihanChip('peran', [['Pekerja', 'Pekerja'], ['Mandor', 'Mandor'], ['Pemilik', 'Pemilik']], u.peran) +
      '<div class="bantuan" id="ket-peran"></div></div>' +
      '<div class="bidang" id="b-boleh"><span class="label">Boleh mengisi</span>' + pilihanChip('boleh', tabIsi, boleh, 'checkbox') + '</div>' +
      '<div class="bidang" id="b-absen"><span class="label">Absen untuk</span><div class="bantuan">Pilih dirinya sendiri, atau satu tim. Hanya pekerjaan rutin (trip, sulingan, libur).</div>' +
      pilihanChip('absen', opsiAbsen, absen, 'checkbox') + '</div>' +
      (u.saya ? '' : '<div class="bidang"><span class="label">Status</span>' + pilihanChip('aktif', [['Ya', 'Aktif'], ['Tidak', 'Nonaktif']], u.aktif ? 'Ya' : 'Tidak') + '</div>') +
      '<label class="bidang"><span class="label">Catatan <span class="opsional">(boleh kosong)</span></span><input class="masukan" name="catatan" value="' + esc(u.catatan || '') + '"></label>' +
      '</form><div class="baris-tombol"><button class="tombol kedua" data-aksi="tutup">Batal</button><button class="tombol utama" id="simpan-pengguna">Simpan</button></div>',
    function (div, tutup) {
      var f = div.querySelector('#form-pengguna');
      var segar = function () {
        var peran = nilaiChip(f, 'peran')[0];
        div.querySelector('#b-boleh').hidden = peran === 'Pemilik';
        div.querySelector('#b-absen').hidden = peran !== 'Pekerja';
        div.querySelector('#ket-peran').textContent = peran === 'Pemilik' ? 'Semua catatan, ringkasan, dan pengaturan.'
          : peran === 'Mandor' ? 'Mengabsen semua karyawan, termasuk kerja harian dan kerja lain.' : 'Hanya catatan yang dipilih di bawah.';
      };
      f.addEventListener('change', segar); segar();
      div.querySelector('#pin-acak').addEventListener('click', function () { f.pin.value = pinAcak(daftar.filter(function (x) { return x !== u; })); });
      div.querySelector('#simpan-pengguna').addEventListener('click', function (ev) {
        var data = {baris: baru ? undefined : u.baris, nama: f.nama.value.trim(), pin: f.pin.value.trim(), peran: nilaiChip(f, 'peran')[0],
          boleh: nilaiChip(f, 'boleh'), absenUntuk: nilaiChip(f, 'absen'), aktif: u.saya ? true : nilaiChip(f, 'aktif')[0] !== 'Tidak', catatan: f.catatan.value.trim()};
        if (!data.nama) { toast('Nama wajib diisi.'); return; }
        if (!/^\d{4,8}$/.test(data.pin)) { toast('PIN harus 4 sampai 8 angka.'); return; }
        if (data.peran === 'Pekerja' && !data.boleh.length && !data.absenUntuk.length) { toast('Pilih minimal satu catatan yang boleh diisi, atau absen untuk siapa.'); return; }
        aksiAtur('penggunaSimpan', {pengguna: data}, ev.target, function (r) {
          if (r.pinSaya) { sesi.pin = r.pinSaya; simpan('sesi', sesi); }
          tutup(); toast(baru ? 'Pengguna ditambahkan. Berikan PIN ' + data.pin + ' kepada ' + data.nama + '.' : 'Pengguna diperbarui.', 5000); setelah();
        });
      });
    });
  }

  // ------------------------------------------------------------ layar: karyawan (pemilik)
  function layarKaryawan() {
    if (perluPemilik()) return;
    var semua = konfig.karyawan || [];
    var kartu = function (k) {
      return '<div class="kartu pengguna' + (k.aktif ? '' : ' nonaktif') + '"><div class="baris-judul"><h2>' + esc(k.nama) + '</h2>' +
        '<span class="chip-status ' + (k.aktif ? 'aman' : 'netral') + '">' + (k.aktif ? 'AKTIF' : 'NONAKTIF') + '</span></div>' +
        '<p class="sub">' + esc(k.tim) + (k.alat ? ' · alat ' + esc(k.alat) : '') + '</p>' +
        '<div class="aksi-entri"><button class="tombol kedua" data-ubah="' + esc(k.nama) + '">Ubah</button>' +
        '<button class="tombol ' + (k.aktif ? 'bahaya' : 'kedua') + '" data-aktif="' + esc(k.nama) + '">' + (k.aktif ? 'Nonaktifkan' : 'Aktifkan lagi') + '</button></div></div>';
    };
    var aktif = semua.filter(function (k) { return k.aktif; }), non = semua.filter(function (k) { return !k.aktif; });
    kerangka('Karyawan', aktif.length + ' aktif' + (non.length ? ', ' + non.length + ' nonaktif' : ''),
      (aktif.map(kartu).join('') || '<div class="kosong">Belum ada karyawan aktif.</div>') +
      '<button class="tombol utama penuh" id="tambah-karyawan" style="margin-top:14px">' + IKON.tambah + 'Tambah karyawan</button>' +
      (non.length ? '<div class="judul-bagian">Nonaktif</div>' + non.map(kartu).join('') : '') +
      '<p class="catatan-kecil">Karyawan nonaktif tidak muncul di absensi, tapi riwayat upahnya tetap ada. Nama tidak bisa diganti karena dipakai di riwayat upah.</p>',
      {kembali: '#/akun', tanpaNav: true});
    var isi = app.querySelector('.isi');
    isi.addEventListener('click', function (ev) {
      var u = ev.target.closest('[data-ubah]'), a = ev.target.closest('[data-aktif]');
      var cari = function (n) { return semua.filter(function (k) { return k.nama === n; })[0]; };
      if (u) formKaryawan(cari(u.dataset.ubah));
      if (a) {
        var k = cari(a.dataset.aktif);
        var jalan = function () {
          aksiAtur('karyawanSimpan', {karyawan: {nama: k.nama, tim: k.tim, alat: k.alat, aktif: !k.aktif}}, a, function () {
            toast(k.aktif ? k.nama + ' dinonaktifkan.' : k.nama + ' aktif lagi.'); layarKaryawan();
          });
        };
        if (k.aktif) tanyaYa('Nonaktifkan ' + k.nama + '?', '', 'Tidak muncul lagi di absensi dan pilihan pengumpul. Riwayat upahnya tetap tersimpan, dan bisa diaktifkan lagi kapan saja.', 'Nonaktifkan', jalan);
        else jalan();
      }
    });
    document.getElementById('tambah-karyawan').addEventListener('click', function () { formKaryawan(null); });
  }

  function formKaryawan(k) {
    var baru = !k;
    k = k || {nama: '', tim: (konfig.tim || [])[0] || '', alat: '', aktif: true};
    var alat = [['', 'Tanpa alat tetap']].concat((konfig.alat || []).filter(function (a) { return a.aktif || a.nama === k.alat; }).map(function (a) { return [a.nama, a.nama]; }));
    lembar('<h2>' + (baru ? 'Tambah karyawan' : 'Ubah ' + esc(k.nama)) + '</h2><form id="form-karyawan" class="form-atur" novalidate>' +
      (baru ? '<label class="bidang"><span class="label">Nama</span><div class="bantuan">Nama ini dipakai di absensi dan rekap upah. Untuk regu yang dibayar bersama, tulis misalnya "Eko & Pak Gatot".</div><input class="masukan" name="nama" autocomplete="off"></label>' : '') +
      '<div class="bidang"><span class="label">Tim</span><div class="bantuan">Menentukan pilihan pekerjaan dan tarif dari tab Tarif Upah.</div>' + pilihanChip('tim', konfig.tim || [], k.tim) + '</div>' +
      '<div class="bidang"><span class="label">Alat suling yang biasa dipakai</span><div class="bantuan">Untuk tim suling. Terisi otomatis saat absen.</div>' + pilihanChip('alat', alat, k.alat || '') + '</div>' +
      '</form><div class="baris-tombol"><button class="tombol kedua" data-aksi="tutup">Batal</button><button class="tombol utama" id="simpan-karyawan">Simpan</button></div>',
    function (div, tutup) {
      div.querySelector('#simpan-karyawan').addEventListener('click', function (ev) {
        var f = div.querySelector('#form-karyawan');
        var data = {baru: baru, nama: baru ? f.nama.value.trim() : k.nama, tim: nilaiChip(f, 'tim')[0] || '', alat: nilaiChip(f, 'alat')[0] || '', aktif: k.aktif};
        if (!data.nama) { toast('Nama wajib diisi.'); return; }
        if (!data.tim) { toast('Pilih tim.'); return; }
        aksiAtur('karyawanSimpan', {karyawan: data}, ev.target, function () {
          tutup(); toast(baru ? data.nama + ' ditambahkan. Atur PIN-nya di Pengguna & PIN kalau ia absen sendiri.' : 'Karyawan diperbarui.', 5000); layarKaryawan();
        });
      });
    });
  }

  // ------------------------------------------------------------ layar: alat suling (pemilik)
  function layarAlat() {
    if (perluPemilik()) return;
    var semua = konfig.alat || [];
    kerangka('Alat suling', semua.filter(function (a) { return a.aktif; }).length + ' aktif', semua.map(function (a) {
      var pemakai = (konfig.karyawan || []).filter(function (k) { return k.aktif && k.alat === a.nama; }).map(function (k) { return k.nama; });
      return '<div class="kartu pengguna' + (a.aktif ? '' : ' nonaktif') + '"><div class="baris-judul"><h2>' + esc(a.nama) + '</h2>' +
        '<span class="chip-status ' + (a.aktif ? 'aman' : 'netral') + '">' + (a.aktif ? 'AKTIF' : 'NONAKTIF') + '</span></div>' +
        '<p class="sub">' + (pemakai.length ? 'Operator tetap: ' + esc(pemakai.join(', ')) : 'Belum ada operator tetap') + '</p>' +
        '<div class="aksi-entri"><button class="tombol ' + (a.aktif ? 'bahaya' : 'kedua') + '" data-aktif="' + esc(a.nama) + '">' + (a.aktif ? 'Nonaktifkan' : 'Aktifkan lagi') + '</button></div></div>';
    }).join('') +
    '<form id="form-alat" class="kartu form-atur" style="margin-top:14px" novalidate><label class="bidang" style="margin:0"><span class="label">Tambah alat suling</span>' +
    '<div class="baris-input"><input class="masukan" name="nama" placeholder="contoh: Ketel 2" autocomplete="off"><button class="tombol utama" type="submit">Tambah</button></div></label></form>' +
    '<p class="catatan-kecil">Kalau ada lebih dari satu alat aktif, penyuling memilih alat saat absen. Ringkasan menampilkan sulingan per alat dan operatornya.</p>',
    {kembali: '#/akun', tanpaNav: true});
    app.querySelector('.isi').addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-aktif]');
      if (!t) return;
      var a = semua.filter(function (x) { return x.nama === t.dataset.aktif; })[0];
      aksiAtur('alatSimpan', {alat: {nama: a.nama, aktif: !a.aktif}}, t, function () { toast(a.aktif ? a.nama + ' dinonaktifkan.' : a.nama + ' aktif lagi.'); layarAlat(); });
    });
    document.getElementById('form-alat').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nama = ev.target.nama.value.trim();
      if (!nama) { toast('Tulis nama alat.'); return; }
      aksiAtur('alatSimpan', {alat: {baru: true, nama: nama}}, ev.target.querySelector('button'), function () { toast(nama + ' ditambahkan.'); layarAlat(); });
    });
  }

  // ------------------------------------------------------------ daftar yang bisa diurutkan (tombol & kartu)
  function htmlDaftarUrut(id, item, aktif) {
    // item: [{id, label}], aktif: daftar id yang tampil (berurutan) atau null = semua
    var urut = aktif ? aktif.filter(function (x) { return item.some(function (i) { return i.id === x; }); }) : item.map(function (i) { return i.id; });
    var sisa = item.filter(function (i) { return urut.indexOf(i.id) < 0; }).map(function (i) { return i.id; });
    return '<ul class="urut" id="' + id + '">' + urut.concat(sisa).map(function (x) {
      var i = item.filter(function (y) { return y.id === x; })[0];
      return '<li data-id="' + esc(x) + '"><label><input type="checkbox"' + (urut.indexOf(x) >= 0 ? ' checked' : '') + '><span>' + esc(i.label) + '</span></label>' +
        '<button type="button" class="tombol-kecil" data-naik aria-label="Naikkan">' + IKON.naik + '</button>' +
        '<button type="button" class="tombol-kecil" data-turun aria-label="Turunkan">' + IKON.turun + '</button></li>';
    }).join('') + '</ul>';
  }
  function pasangDaftarUrut(akar) {
    akar.addEventListener('click', function (ev) {
      var n = ev.target.closest('[data-naik]'), t = ev.target.closest('[data-turun]');
      var li = (n || t) && (n || t).closest('li');
      if (!li) return;
      if (n && li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling);
      if (t && li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li);
    });
  }
  function bacaDaftarUrut(el) {
    return [].slice.call(el.querySelectorAll('li')).filter(function (li) { return li.querySelector('input').checked; }).map(function (li) { return li.dataset.id; });
  }

  // ------------------------------------------------------------ layar: tampilan (pemilik)
  var WARNA_SIAP = [['#2D7C5B', 'Hijau'], ['#2F6497', 'Biru'], ['#8A5A2B', 'Cokelat'], ['#6B4FA0', 'Ungu'], ['#B0463A', 'Merah bata'], ['#4A5A66', 'Abu']];

  function layarTampilan() {
    if (perluPemilik()) return;
    var t = tampilan();
    var logoBaru = null;                     // undefined = tidak berubah, '' = kembali ke bawaan
    var warna = t.warna || BAWAAN.warna;
    var kartuR = KARTU_MINGGU.concat(KARTU_BULAN, KARTU_LAIN).map(function (k) { return {id: k.id, label: k.label}; });
    var kartuB = KARTU_MINGGU.map(function (k) { return {id: k.id, label: k.label}; });
    var tombol = URUTAN_TAB.map(function (x) { return {id: x, label: x}; });
    kerangka('Tampilan', 'Berlaku untuk semua HP', '<form id="form-tampilan" class="form-atur" novalidate>' +
      '<div class="kartu"><h2>Nama dan logo</h2>' +
      '<label class="bidang"><span class="label">Nama usaha</span><input class="masukan" name="namaUsaha" maxlength="60" value="' + esc(t.namaUsaha) + '"></label>' +
      '<label class="bidang"><span class="label">Judul aplikasi</span><input class="masukan" name="namaAplikasi" maxlength="40" value="' + esc(t.namaAplikasi) + '"></label>' +
      '<div class="bidang" style="margin:0"><span class="label">Logo</span><div class="baris-logo"><img class="logo pratinjau-logo" src="' + esc(logoSrc()) + '" alt="Logo">' +
      '<div class="tumpuk"><label class="tombol kedua">Ganti logo<input type="file" accept="image/*" id="file-logo" hidden></label>' +
      '<button type="button" class="tombol kedua" id="logo-bawaan">Pakai logo bawaan</button></div></div>' +
      '<div class="bantuan" style="margin-top:8px">Ikon aplikasi di layar HP tidak ikut berubah.</div></div></div>' +
      '<div class="kartu"><h2>Warna</h2><div class="chips" id="pilih-warna">' + WARNA_SIAP.map(function (w) {
        return '<label class="chip warna"><input type="radio" name="warna" value="' + w[0] + '"' + (warna.toLowerCase() === w[0].toLowerCase() ? ' checked' : '') + '><span><i style="background:' + w[0] + '"></i>' + w[1] + '</span></label>';
      }).join('') + '<label class="chip warna"><input type="radio" name="warna" value="lain"' + (WARNA_SIAP.some(function (w) { return w[0].toLowerCase() === warna.toLowerCase(); }) ? '' : ' checked') + '><span><input type="color" id="warna-lain" value="' + esc(warna) + '" aria-label="Warna lain">Lainnya</span></label></div></div>' +
      '<div class="kartu"><h2>Tombol catatan di Beranda</h2><p class="sub">Centang yang tampil. Pakai panah untuk mengurutkan.</p>' + htmlDaftarUrut('urut-menu', tombol, t.menuBeranda) + '</div>' +
      '<div class="kartu"><h2>Ringkasan di Beranda</h2>' + htmlDaftarUrut('urut-beranda', kartuB, t.kartuBeranda || KARTU_BERANDA_BAWAAN) + '</div>' +
      '<div class="kartu"><h2>Kartu di halaman Ringkasan</h2><p class="sub">Kartu minggu, bulan, dan peringatan.</p>' + htmlDaftarUrut('urut-ringkasan', kartuR, t.kartuRingkasan) + '</div>' +
      '</form>', {kembali: '#/akun', tanpaNav: true});
    app.insertAdjacentHTML('beforeend', '<div class="aksi-bawah"><button class="tombol kedua" data-ke="#/akun">Batal</button><button class="tombol utama" id="simpan-tampilan">Simpan</button></div>');
    var f = document.getElementById('form-tampilan');
    pasangDaftarUrut(f);
    var pakaiWarna = function () {
      var v = nilaiChip(f, 'warna')[0];
      warna = v === 'lain' ? document.getElementById('warna-lain').value : v;
      terapkanTampilan(Object.assign({}, tampilan(), {warna: warna}));
    };
    f.addEventListener('change', function (ev) { if (ev.target.name === 'warna') pakaiWarna(); });
    document.getElementById('warna-lain').addEventListener('input', function () {
      f.querySelector('input[name="warna"][value="lain"]').checked = true; pakaiWarna();
    });
    document.getElementById('file-logo').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      kecilkanLogo(file).then(function (data) {
        logoBaru = data; f.querySelector('.pratinjau-logo').src = data;
      }, function (e) { toast(e.message, 5000); });
    });
    document.getElementById('logo-bawaan').addEventListener('click', function () { logoBaru = ''; f.querySelector('.pratinjau-logo').src = 'logo.png'; });
    document.getElementById('simpan-tampilan').addEventListener('click', function (ev) {
      var menu = bacaDaftarUrut(document.getElementById('urut-menu'));
      if (!menu.length) { toast('Pilih minimal satu tombol catatan.'); return; }
      var data = {namaUsaha: f.namaUsaha.value.trim(), namaAplikasi: f.namaAplikasi.value.trim(), warna: warna.toLowerCase() === BAWAAN.warna.toLowerCase() ? '' : warna,
        menuBeranda: menu, kartuBeranda: bacaDaftarUrut(document.getElementById('urut-beranda')),
        kartuRingkasan: bacaDaftarUrut(document.getElementById('urut-ringkasan'))};
      if (logoBaru !== null) data.logo = logoBaru;
      aksiAtur('tampilanSimpan', {tampilan: data}, ev.target, function () {
        if (logoBaru !== null) { if (logoBaru) simpan('logo', logoBaru); else buang('logo'); }
        toast('Tampilan disimpan. HP lain ikut berubah saat aplikasinya dibuka.', 5000);
        location.hash = '#/akun';
      }).then(function (r) { if (!r) terapkanTampilan(); });
    });
  }

  // Logo diperkecil supaya muat di satu sel Google Sheet.
  function kecilkanLogo(file) {
    return new Promise(function (ok, gagal) {
      var baca = new FileReader();
      baca.onerror = function () { gagal(new Error('Gambar tidak bisa dibaca.')); };
      baca.onload = function () {
        var img = new Image();
        img.onerror = function () { gagal(new Error('File itu bukan gambar.')); };
        img.onload = function () {
          var coba = [[256, 'image/png'], [256, 'image/webp', 0.85], [192, 'image/webp', 0.8], [192, 'image/jpeg', 0.8], [128, 'image/jpeg', 0.75]];
          for (var i = 0; i < coba.length; i++) {
            var s = coba[i][0], skala = Math.min(1, s / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * skala)); c.height = Math.max(1, Math.round(img.height * skala));
            var g = c.getContext('2d');
            if (coba[i][1] === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
            g.drawImage(img, 0, 0, c.width, c.height);
            var data = c.toDataURL(coba[i][1], coba[i][2]);
            if (data.indexOf('data:' + coba[i][1]) === 0 && data.length <= 44000) { ok(data); return; }
          }
          gagal(new Error('Gambar terlalu besar. Pakai gambar logo yang lebih sederhana.'));
        };
        img.src = baca.result;
      };
      baca.readAsDataURL(file);
    });
  }

  // ------------------------------------------------------------ layar: pertanyaan formulir (pemilik)
  var JENIS_LABEL = {teks: 'Teks pendek', paragraf: 'Teks panjang', angka: 'Angka bulat', rupiah: 'Rupiah', desimal: 'Angka desimal',
    pilih: 'Pilih satu', centang: 'Pilih beberapa', tanggal: 'Tanggal', daftar: 'Pilih dari daftar', kisi: 'Daftar karyawan'};

  function layarFormulir(kunci) {
    if (perluPemilik()) return;
    var tab = tabDariKunci(kunci);
    if (!tab || TAB_DIATUR.indexOf(tab) < 0) {
      kerangka('Pertanyaan formulir', 'Pilih formulir', '<div class="kartu menu-atur">' + TAB_DIATUR.map(function (t) {
        var n = bidangFormulir(t).filter(function (b) { return b.asal === 'Tambahan'; }).length;
        return '<button class="baris-menu" data-ke="#/formulir/' + FORM[t].kunci + '"><span><b>' + esc(t) + '</b><small>' +
          FORM[t].bidang.length + ' pertanyaan bawaan' + (n ? ', ' + n + ' tambahan' : '') + '</small></span>' + IKON.lanjut + '</button>';
      }).join('') + '</div><p class="catatan-kecil">Absensi tidak diatur di sini karena mengikuti daftar karyawan (menu Karyawan).</p>',
      {kembali: '#/akun', tanpaNav: true});
      return;
    }
    var daftar = bidangFormulir(tab).map(function (b) {
      return {kolom: b.h, label: b.label || b.h, labelAsli: b.labelAsli || b.h, bantuan: b.bantuan || '', jenis: b.j, wajib: b.wajib !== false,
        pilihan: b.opsi || [], tampil: !b.sembunyi, asal: b.asal, terkunci: b.asal === 'Bawaan' && b.wajib !== false, baru: false};
    });
    var tulis = function () {
      var el = document.getElementById('daftar-pertanyaan');
      el.innerHTML = daftar.map(function (b, i) {
        var tambahan = b.asal === 'Tambahan';
        return '<div class="kartu pertanyaan' + (b.tampil ? '' : ' nonaktif') + '" data-i="' + i + '">' +
          '<div class="baris-judul"><h2>' + esc(b.label) + '</h2><span class="urut-tombol">' +
          '<button type="button" class="tombol-kecil" data-naik="' + i + '" aria-label="Naikkan">' + IKON.naik + '</button>' +
          '<button type="button" class="tombol-kecil" data-turun="' + i + '" aria-label="Turunkan">' + IKON.turun + '</button></span></div>' +
          '<p class="sub">' + esc(JENIS_LABEL[b.jenis] || b.jenis) + ' · ' + (tambahan ? 'tambahan' : 'bawaan') + (b.wajib ? ' · wajib' : '') +
          (b.tampil ? '' : ' · <b>disembunyikan</b>') + (b.label !== b.kolom ? ' · kolom "' + esc(b.kolom) + '"' : '') + '</p>' +
          '<div class="aksi-entri"><button type="button" class="tombol kedua" data-ubah="' + i + '">Ubah</button>' +
          (b.terkunci ? '<span class="terkunci">Dipakai rekap, tidak bisa disembunyikan</span>'
            : '<button type="button" class="tombol kedua" data-tampil="' + i + '">' + (b.tampil ? 'Sembunyikan' : 'Tampilkan') + '</button>') + '</div></div>';
      }).join('');
    };
    kerangka('Pertanyaan ' + tab, 'Perubahan berlaku untuk semua HP', '<div id="daftar-pertanyaan"></div>' +
      '<button class="tombol kedua penuh" id="tambah-pertanyaan" style="margin-top:14px">' + IKON.tambah + 'Tambah pertanyaan</button>' +
      '<p class="catatan-kecil">Pertanyaan tambahan dibuatkan kolom baru di tab ' + esc(tab) + ' pada Google Sheet. Pertanyaan yang disembunyikan tidak dihapus dari Sheet, jadi datanya tetap aman.</p>',
      {kembali: '#/formulir', tanpaNav: true});
    app.insertAdjacentHTML('beforeend', '<div class="aksi-bawah"><button class="tombol kedua" data-ke="#/formulir">Batal</button><button class="tombol utama" id="simpan-formulir">Simpan</button></div>');
    tulis();
    var isi = document.getElementById('daftar-pertanyaan');
    isi.addEventListener('click', function (ev) {
      var n = ev.target.closest('[data-naik]'), t = ev.target.closest('[data-turun]'), u = ev.target.closest('[data-ubah]'), s = ev.target.closest('[data-tampil]');
      if (n) { var a = Number(n.dataset.naik); if (a > 0) { daftar.splice(a - 1, 0, daftar.splice(a, 1)[0]); tulis(); } }
      if (t) { var b = Number(t.dataset.turun); if (b < daftar.length - 1) { daftar.splice(b + 1, 0, daftar.splice(b, 1)[0]); tulis(); } }
      if (s) { var c = daftar[Number(s.dataset.tampil)]; c.tampil = !c.tampil; tulis(); }
      if (u) formPertanyaan(daftar[Number(u.dataset.ubah)], daftar, tulis);
    });
    document.getElementById('tambah-pertanyaan').addEventListener('click', function () { formPertanyaan(null, daftar, tulis); });
    document.getElementById('simpan-formulir').addEventListener('click', function (ev) {
      var kirim = daftar.map(function (b, i) {
        var x = {kolom: b.kolom, label: b.label === b.labelAsli ? '' : b.label, bantuan: b.asal === 'Bawaan' && b.bantuan === (b.bantuanAsli || '') ? '' : b.bantuan,
          tampil: b.tampil, urutan: (i + 1) * 10, asal: b.asal};
        if (b.asal === 'Tambahan') { x.label = b.label; x.jenis = b.jenis; x.wajib = b.wajib; x.pilihan = b.pilihan; x.bantuan = b.bantuan; }
        return x;
      });
      aksiAtur('formulirSimpan', {tab: tab, bidang: kirim}, ev.target, function (r) {
        buang('draf.' + kunci);
        toast(r.kolomBaru && r.kolomBaru.length ? 'Disimpan. Kolom baru dibuat di Sheet: ' + r.kolomBaru.join(', ') + '.' : 'Pertanyaan disimpan.', 5000);
        location.hash = '#/formulir';
      });
    });
    daftar.forEach(function (b) {
      var asli = FORM[tab].bidang.filter(function (x) { return x.h === b.kolom; })[0];
      b.bantuanAsli = asli ? (asli.bantuan || '') : '';
    });
  }

  function formPertanyaan(b, daftar, setelah) {
    var baru = !b;
    b = b || {kolom: '', label: '', bantuan: '', jenis: 'teks', wajib: false, pilihan: [], tampil: true, asal: 'Tambahan', baru: true};
    var tambahan = b.asal === 'Tambahan';
    var jenis = ['teks', 'paragraf', 'angka', 'rupiah', 'desimal', 'pilih', 'centang', 'tanggal'].map(function (j) { return [j, JENIS_LABEL[j]]; });
    lembar('<h2>' + (baru ? 'Pertanyaan baru' : 'Ubah pertanyaan') + '</h2><form id="form-tanya" class="form-atur" novalidate>' +
      '<label class="bidang"><span class="label">Pertanyaan</span>' + (tambahan && !baru ? '' : '') +
      '<input class="masukan" name="label" maxlength="60" value="' + esc(b.label) + '" autocomplete="off">' +
      (!baru ? '<div class="bantuan">Kolom di Sheet tetap "' + esc(b.kolom) + '".</div>' : '<div class="bantuan">Juga menjadi judul kolom baru di Google Sheet.</div>') + '</label>' +
      '<label class="bidang"><span class="label">Petunjuk <span class="opsional">(boleh kosong)</span></span><input class="masukan" name="bantuan" maxlength="200" value="' + esc(b.bantuan) + '"></label>' +
      (tambahan ? '<div class="bidang"><span class="label">Jenis isian</span>' + pilihanChip('jenis', jenis, b.jenis) + '</div>' +
        '<label class="bidang" id="b-pilihan"><span class="label">Pilihan jawaban</span><div class="bantuan">Satu pilihan per baris.</div><textarea class="masukan" name="pilihan">' + esc((b.pilihan || []).join('\n')) + '</textarea></label>' +
        '<div class="bidang"><span class="label">Wajib diisi?</span>' + pilihanChip('wajib', [['Ya', 'Wajib'], ['Tidak', 'Boleh kosong']], b.wajib ? 'Ya' : 'Tidak') + '</div>' : '') +
      '</form><div class="baris-tombol"><button class="tombol kedua" data-aksi="tutup">Batal</button><button class="tombol utama" id="ok-tanya">Selesai</button></div>',
    function (div, tutup) {
      var f = div.querySelector('#form-tanya');
      var segar = function () {
        var bp = div.querySelector('#b-pilihan');
        if (bp) { var j = nilaiChip(f, 'jenis')[0]; bp.hidden = j !== 'pilih' && j !== 'centang'; }
      };
      f.addEventListener('change', segar); segar();
      div.querySelector('#ok-tanya').addEventListener('click', function () {
        var label = f.label.value.trim();
        if (!label) { toast('Tulis pertanyaannya.'); return; }
        if (baru) {
          if (/[\[\]]/.test(label)) { toast('Pertanyaan tidak boleh berisi kurung siku.'); return; }
          var sama = daftar.some(function (x) { return x.kolom.toLowerCase() === label.toLowerCase(); }) ||
            ((konfig.kepala && konfig.kepala[tabDariKunci(location.hash.split('/')[2])]) || []).some(function (h) { return h.toLowerCase() === label.toLowerCase(); });
          if (sama || /^(tanggal|timestamp|hari)$/i.test(label)) { toast('Nama pertanyaan itu sudah dipakai.'); return; }
        }
        b.label = label;
        b.bantuan = f.bantuan.value.trim();
        if (tambahan) {
          b.jenis = nilaiChip(f, 'jenis')[0] || 'teks';
          b.wajib = nilaiChip(f, 'wajib')[0] === 'Ya';
          b.pilihan = (b.jenis === 'pilih' || b.jenis === 'centang') ? f.pilihan.value.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x; }) : [];
          if ((b.jenis === 'pilih' || b.jenis === 'centang') && b.pilihan.length < 2) { toast('Tulis minimal 2 pilihan jawaban.'); return; }
          if (b.pilihan.some(function (x) { return x.indexOf(';') >= 0; })) { toast('Pilihan jawaban tidak boleh berisi titik koma.'); return; }
        }
        if (baru) { b.kolom = label; daftar.push(b); }
        tutup(); setelah();
      });
    });
  }

  // ------------------------------------------------------------ layar: kelola PIN (API lama, tanpa tab Pengguna)
  function layarPin() {
    if (!bisaKelola()) { location.hash = '#/akun'; return; }
    if (v6()) { location.hash = '#/pengguna'; return; }
    kerangka('Kelola PIN', 'Hanya pemilik yang bisa melihat halaman ini', '<div id="daftar-pin"><div class="memuat">Memuat…</div></div>', {kembali: '#/akun', tanpaNav: true});
    var tulis = function (daftar) {
      var el = document.getElementById('daftar-pin');
      if (!el) return;
      el.innerHTML = daftar.map(function (d) {
        return '<div class="kartu" data-baris="' + d.baris + '"><h2>' + esc(d.peran) + (d.saya ? ' (Anda)' : '') + '</h2>' +
          '<p class="sub">Boleh mengisi: ' + esc(d.boleh || '–') + (d.pin ? '' : ' · <b>tidak aktif</b>') + '</p>' +
          '<input class="masukan pin-baru" type="text" inputmode="numeric" maxlength="8" value="' + esc(d.pin) + '" placeholder="4–8 angka" aria-label="PIN ' + esc(d.peran) + '">' +
          '<div class="aksi-entri"><button class="tombol utama" data-simpan-pin="1">Simpan PIN</button>' +
          (d.saya ? '' : '<button class="tombol bahaya" data-matikan-pin="1"' + (d.pin ? '' : ' disabled') + '>Matikan</button>') + '</div></div>';
      }).join('');
    };
    var muat = function () {
      panggil('pinDaftar').then(function (r) {
        if (!r.ok) throw new Error(r.galat || 'Gagal memuat PIN.');
        tulis(r.daftar);
      }).catch(function (e) {
        var el = document.getElementById('daftar-pin');
        if (el) el.innerHTML = '<div class="galat-kartu">' + esc(e.message) + '</div>';
      });
    };
    document.getElementById('daftar-pin').addEventListener('click', function (ev) {
      var tombol = ev.target.closest('[data-simpan-pin],[data-matikan-pin]');
      if (!tombol) return;
      var kartu = tombol.closest('[data-baris]');
      var baris = Number(kartu.dataset.baris);
      var matikan = tombol.hasAttribute('data-matikan-pin');
      var pinBaru = matikan ? '' : kartu.querySelector('.pin-baru').value.trim();
      if (!matikan && !/^\d{4,8}$/.test(pinBaru)) { toast('PIN harus 4 sampai 8 angka.'); return; }
      if (matikan && !confirm('Matikan PIN ini? Orang yang memakainya tidak bisa masuk lagi sampai diberi PIN baru.')) return;
      tombol.disabled = true;
      panggil('pinUbah', {baris: baris, pinBaru: pinBaru}).then(function (r) {
        if (r && r.ok) {
          if (kartu.querySelector('h2').textContent.indexOf('(Anda)') >= 0 && pinBaru) { sesi.pin = pinBaru; simpan('sesi', sesi); }
          toast(matikan ? 'PIN dimatikan.' : 'PIN sudah diganti.');
          muat();
        } else {
          tombol.disabled = false; toast((r && r.galat) || 'Gagal menyimpan PIN.', 5000);
        }
      }, function (e) { tombol.disabled = false; toast(e.jaringan ? 'Perlu sinyal untuk mengganti PIN.' : e.message, 5000); });
    });
    muat();
  }

  // ------------------------------------------------------------ router
  function tampilkan() {
    var tirai = document.querySelector('.tirai'); if (tirai) tirai.remove();
    if (!sesi) { layarMasuk(); return; }
    var h = location.hash || '#/';
    var bagian = h.replace(/^#\/?/, '').split('/');
    if (bagian[0] === 'isi') layarIsi(bagian[1]);
    else if (bagian[0] === 'ubah') { if (sedangDiubah && bisaKelola()) layarIsi(bagian[1], sedangDiubah); else location.hash = '#/terbaru/' + (bagian[1] || ''); }
    else if (bagian[0] === 'pin') layarPin();
    else if (bagian[0] === 'pengguna') layarPengguna();
    else if (bagian[0] === 'karyawan') layarKaryawan();
    else if (bagian[0] === 'alat') layarAlat();
    else if (bagian[0] === 'tampilan') layarTampilan();
    else if (bagian[0] === 'formulir') layarFormulir(bagian[1]);
    else if (bagian[0] === 'terbaru') layarTerbaru(bagian[1]);
    else if (bagian[0] === 'ringkasan') layarRingkasan();
    else if (bagian[0] === 'antrian') layarAntrian();
    else if (bagian[0] === 'akun') layarAkun();
    else layarBeranda();
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-ke]');
    if (el) { ev.preventDefault(); location.hash = el.dataset.ke; }
  });
  window.addEventListener('hashchange', function () {
    if (location.hash.indexOf('#/tampilan') !== 0) terapkanTampilan();     // batalkan pratinjau warna
    tampilkan();
  });
  window.addEventListener('online', function () { perbaruiStatus(); kirimAntrian(); });
  window.addEventListener('offline', perbaruiStatus);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kirimAntrian(); });
  setInterval(function () { if (antrian.length) kirimAntrian(); }, 30000);
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); promptPasang = e; });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* tetap jalan tanpa offline */ });
  }

  terapkanTampilan();
  tampilkan();
  if (sesi) {
    muatKonfig().then(function () {
      var h = location.hash;
      if (!h || h === '#/' || h.indexOf('#/isi/') === 0 && !document.getElementById('formulir')) tampilkan();
    }, function () { /* pakai daftar tersimpan */ });
    kirimAntrian();
  }

  // Untuk pengujian otomatis.
  window.__sembada = {bidangLengkap: bidangLengkap, angkaDesimal: angkaDesimal, angkaBulat: angkaBulat, paletWarna: paletWarna};
})();
