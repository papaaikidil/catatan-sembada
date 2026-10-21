/* Catatan Sembada - aplikasi pencatatan Sembada Karya Wangi.
 * Semua isian dikirim ke Google Sheet lewat API Apps Script.
 * Isian disimpan dulu di HP (antrian), lalu dikirim begitu ada sinyal. */
(function () {
  'use strict';

  var KONF = window.SEMBADA_CONFIG || {};
  var API = KONF.API_URL || '';
  var VERSI = KONF.VERSI || '1.0.0';
  var DI_APK = /CatatanSembadaApp/.test(navigator.userAgent);
  var app = document.getElementById('app');

  // ------------------------------------------------------------ penyimpanan
  function simpan(k, v) { try { localStorage.setItem('sembada.' + k, JSON.stringify(v)); } catch (e) { /* abaikan */ } }
  function ambil(k, d) {
    try { var v = localStorage.getItem('sembada.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function buang(k) { try { localStorage.removeItem('sembada.' + k); } catch (e) { /* abaikan */ } }

  var sesi = ambil('sesi', null);          // {pin, peran, tab, semua}
  var konfig = ambil('konfig', null);      // daftar pilihan, tarif, judul kolom
  var antrian = ambil('antrian', []);      // isian yang belum terkirim
  var mengirim = false;
  var promptPasang = null;

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
    awan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H8a5 5 0 1 1 1-9.9A6 6 0 0 1 20.6 11 4 4 0 0 1 17.5 19Z"/><path d="M12 12v4M12 18.5v.01"/></svg>'
  };

  // ------------------------------------------------------------ API
  function panggil(aksi, data, batasMs) {
    if (!API) return Promise.reject(new Error('Aplikasi belum tersambung ke Google Sheet. Hubungi Mas Wildan.'));
    var isi = {aksi: aksi, pin: sesi ? sesi.pin : ''};
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
        if (r && r.kode === 'PIN' && aksi !== 'masuk') { keluar('PIN sudah diganti. Masukkan PIN yang baru.'); }
        return r;
      })
      .finally(function () { clearTimeout(t); });
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
        {j: 'desimal', h: 'Berat bahan (kg)', bantuan: 'Hasil timbang, contoh 1075.'},
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
        var total = 0, ada = false;
        bidang.forEach(function (b) {
          if (b.j === 'kisiBaris' && n[b.h]) { ada = true; total += upahTarif(n[b.h]); }
          if (b.j === 'rupiah' && /^Upah kerja lain/.test(b.h) && n[b.h] > 0 && n['Ada kerja lain dengan upah khusus hari ini?'] === 'Ya') total += n[b.h];
        });
        return ada ? ['Perkiraan upah hari ini: ' + rp(total)] : null;
      },
      cek: function (n, bidang) {
        var s = [];
        var adaKerjaLain = bidang.some(function (b) { return b.j === 'kisiBaris' && n[b.h] === 'Kerja lain'; });
        if (adaKerjaLain && n['Ada kerja lain dengan upah khusus hari ini?'] === 'Tidak') {
          s.push(['Ada kerja lain dengan upah khusus hari ini?', 'Ada yang dipilih Kerja lain. Pilih Ya, lalu isi upahnya.']);
        }
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
  function tabDariKunci(k) { return URUTAN_TAB.filter(function (t) { return FORM[t].kunci === k; })[0]; }

  function upahTarif(pilihan) {
    var t = (konfig && konfig.tarif || []).filter(function (x) { return x.pilihan === pilihan; })[0];
    return t ? t.upah : 0;
  }

  // Bidang lengkap sebuah tab. Baris absensi dan upah kerja lain mengikuti judul kolom di Sheet.
  function bidangLengkap(tab) {
    var kepala = (konfig && konfig.kepala && konfig.kepala[tab]) || [];
    var out = [];
    FORM[tab].bidang.forEach(function (b) {
      if (b.j === 'kisi') {
        kepala.forEach(function (h) {
          var m = /^(.+) \[(.+)\]$/.exec(h);
          if (m) out.push({j: 'kisiBaris', h: h, kelompok: m[1], label: m[2]});
        });
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

  function opsiBidang(b) {
    if (b.opsi) return b.opsi;
    if (b.j === 'kisiBaris') {
      return (konfig && konfig.tarif || []).filter(function (t) { return t.untuk === b.kelompok || t.untuk === 'Semua'; })
        .map(function (t) { return t.pilihan; });
    }
    return (konfig && konfig.daftar && konfig.daftar[b.daftar]) || [];
  }

  function terlihat(b, n) {
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
    app.innerHTML = '<div class="layar-masuk">' +
      '<img class="logo" src="logo.png" alt="Logo PT. Sembada Karya Wangi">' +
      '<h1>Catatan Sembada</h1>' +
      '<p>Masukkan PIN dari Mas Wildan.</p>' +
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
      var sementara = {pin: pin};
      sesi = sementara;
      panggil('masuk', {pin: pin}).then(function (r) {
        if (!r.ok) { sesi = null; layarMasuk(r.galat || 'PIN salah.'); return; }
        sesi = {pin: pin, peran: r.peran, tab: r.tab, semua: r.semua};
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
        if (sesi) { sesi.tab = r.tab; sesi.semua = r.semua; sesi.peran = r.peran; simpan('sesi', sesi); }
      }
      return r;
    });
  }

  // ------------------------------------------------------------ layar: beranda
  function layarBeranda() {
    var tab = (sesi.tab || []).filter(function (t) { return FORM[t]; });
    var tombol = tab.map(function (t) {
      var f = FORM[t];
      return '<a class="tombol-catatan" href="#/isi/' + f.kunci + '"><span class="lingkar">' + IKON[f.ikon] + '</span><b>' + esc(t) + '</b><small>' + esc(f.ket) + '</small></a>';
    }).join('');
    var isi = '<div id="kotak-status">' + htmlStatus() + '</div>';
    if (sesi.semua) isi += '<div id="kotak-ringkas">' + htmlRingkasMini(ambil('ringkasan', null)) + '</div>';
    isi += '<div class="judul-bagian">Isi catatan</div>' +
      (tab.length ? '<div class="grid-catatan' + (tab.length <= 2 ? ' satu' : '') + '">' + tombol + '</div>' : '<div class="kosong">PIN ini belum diberi akses ke catatan mana pun.</div>');
    kerangka('Catatan Sembada', 'Masuk sebagai ' + (sesi.peran || ''), isi, {aktif: 'beranda'});
    if (sesi.semua) muatRingkasan().then(function (r) {
      var el = document.getElementById('kotak-ringkas');
      if (el && r) el.innerHTML = htmlRingkasMini(r);
    }, function () { /* tetap pakai data tersimpan */ });
  }

  function htmlRingkasMini(r) {
    if (!r || !r.mingguBerjalan) return '';
    var m = r.mingguBerjalan;
    var perlu = (r.peringatan || []).filter(function (p) { return /PERHATIAN|TAGIH|PERBAIKI|BACA/.test(p.status); }).length;
    return '<div class="kartu"><h2>Minggu ini</h2><p class="sub">' + esc(m.mulai) + ' – ' + esc(m.sampai) + ' · data sampai ' + esc(r.dataSampai) + '</p>' +
      '<div class="angka-grid">' +
      kotakAngka('Penjualan', rp(m.penjualan)) + kotakAngka('Laba usaha', rp(m.laba), m.laba < 0) +
      kotakAngka('Minyak dihasilkan', ang(m.minyak) + ' kg') + kotakAngka('Hal perlu ditangani', String(perlu), perlu > 0) +
      '</div><button class="tautan" data-ke="#/ringkasan">Lihat ringkasan lengkap ›</button></div>';
  }
  function kotakAngka(label, nilai, merah) {
    return '<div class="angka"><span>' + esc(label) + '</span><b' + (merah ? ' class="minus"' : '') + '>' + esc(nilai) + '</b></div>';
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
    var muat = function () {
      muatRingkasan().then(function (r) {
        if (location.hash !== '#/ringkasan') return;
        document.querySelector('.isi').innerHTML = htmlRingkasan(r);
      }, function (e) {
        if (location.hash !== '#/ringkasan') return;
        if (!tersimpan) document.querySelector('.isi').innerHTML = '<div class="galat-kartu">' + esc(e.message) + '</div>';
        else toast(e.message);
      });
    };
    document.getElementById('tombol-muat').addEventListener('click', function () { toast('Memuat ulang…', 1500); muat(); });
    muat();
  }

  function htmlMinggu(judul, m) {
    if (!m) return '';
    var upah = (m.upahPengumpul || 0) + (m.upahPenyuling || 0) + (m.upahHarian || 0);
    return '<div class="kartu"><h2>' + esc(judul) + '</h2><p class="sub">' + esc(m.mulai) + ' – ' + esc(m.sampai) + '</p><div class="angka-grid">' +
      kotakAngka('Penjualan', rp(m.penjualan)) + kotakAngka('Laba usaha', rp(m.laba), m.laba < 0) +
      kotakAngka('Minyak dihasilkan', ang(m.minyak) + ' kg') + kotakAngka('Minyak terjual', ang(m.terjual) + ' kg') +
      kotakAngka('Bahan masuk', ang(m.bahanKg, 0) + ' kg') + kotakAngka('Harga bahan/kg', rp(m.hargaBahan)) +
      kotakAngka('Biaya per kg minyak', rp(m.biayaPerKg)) + kotakAngka('Total upah', rp(upah)) +
      kotakAngka('Sulingan', ang(m.sulingan, 0) + ' kali') + kotakAngka('Hari ketel kosong', ang(m.ketelKosong, 0) + ' hari', m.ketelKosong >= 2) +
      '</div></div>';
  }

  function htmlRingkasan(r) {
    var p = (r.peringatan || []).map(function (x) {
      var kelas = /PERHATIAN|TAGIH|PERBAIKI|BACA/.test(x.status) ? 'perlu' : (x.status === 'Aman' ? 'aman' : 'netral');
      return '<div class="peringatan"><span class="chip-status ' + kelas + '">' + esc(x.status || '–') + '</span><div><p>' + esc(x.hal) +
        (x.nilai ? ': <b>' + esc(x.nilai) + '</b>' : '') + '</p>' + (x.saran ? '<p class="saran">' + esc(x.saran) + '</p>' : '') + '</div></div>';
    }).join('');
    var b = r.bulanIni;
    var bulan = b ? '<div class="kartu"><h2>Bulan ini</h2><p class="sub">' + esc(b.bulan) + '</p><div class="angka-grid">' +
      kotakAngka('Penjualan', rp(b.penjualan)) + kotakAngka('Laba usaha', rp(b.laba), b.laba < 0) +
      kotakAngka('Cicilan kendaraan', rp(b.cicilan)) + kotakAngka('Keluarga & pribadi', rp(b.keluarga)) +
      kotakAngka('Proyek + upah harian', rp((b.proyekBahan || 0) + (b.upahHarian || 0))) + kotakAngka('Perubahan kas', rp(b.perubahanKas), b.perubahanKas < 0) +
      '</div></div>' : '';
    return '<p class="sub" style="margin:0 0 12px;color:var(--teks-2)">Data sampai ' + esc(r.dataSampai) + '</p>' +
      htmlMinggu('Minggu berjalan', r.mingguBerjalan) + htmlMinggu('Minggu penuh terakhir', r.mingguPenuh) + bulan +
      '<div class="judul-bagian">Peringatan</div><div class="kartu">' + (p || '<div class="kosong">Tidak ada peringatan.</div>') + '</div>';
  }

  // ------------------------------------------------------------ layar: isi formulir
  function layarIsi(kunci) {
    var tab = tabDariKunci(kunci);
    if (!tab || (sesi.tab || []).indexOf(tab) < 0) { location.hash = '#/'; return; }
    if (!konfig || !konfig.kepala || !konfig.kepala[tab]) {
      kerangka(tab, '', '<div class="galat-kartu">Daftar pilihan belum termuat. Sambungkan ke internet sekali, lalu buka lagi.</div>' +
        '<div style="margin-top:12px"><button class="tombol utama penuh" id="coba-muat">Muat daftar pilihan</button></div>', {kembali: '#/', tanpaNav: true});
      document.getElementById('coba-muat').addEventListener('click', function () {
        muatKonfig().then(function () { tampilkan(); }, function (e) { toast(e.message); });
      });
      return;
    }
    var bidang = bidangLengkap(tab);
    var draf = ambil('draf.' + kunci, {});
    var html = bidang.map(function (b, i) { return htmlBidang(b, i, draf); }).join('') +
      '<div class="bidang" data-h="_upah" hidden><div class="pesan-salah"></div></div>' +
      '<div class="pratinjau" id="pratinjau" hidden></div>';
    kerangka(tab, FORM[tab].ket, '<form id="formulir" novalidate>' + html + '</form>', {kembali: '#/', tanpaNav: true});
    app.insertAdjacentHTML('beforeend', '<div class="aksi-bawah"><button class="tombol kedua" id="tombol-kosong" type="button">Kosongkan</button>' +
      '<button class="tombol utama" id="tombol-simpan" type="button">Simpan</button></div>');

    var form = document.getElementById('formulir');
    var segarkan = function () {
      var n = bacaIsian(bidang, true).nilai;
      bidang.forEach(function (b, i) {
        var el = document.getElementById('b' + i);
        if (el) el.hidden = !terlihat(b, n);
      });
      var p = FORM[tab].pratinjau ? FORM[tab].pratinjau(n, bidang) : null;
      var kotak = document.getElementById('pratinjau');
      kotak.hidden = !p; kotak.innerHTML = p ? p.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') : '';
      bidang.forEach(function (b, i) {
        if (b.j !== 'rupiah') return;
        var pet = document.getElementById('pet' + i);
        if (pet) pet.textContent = n[b.h] > 0 ? rp(n[b.h]) : '';
      });
      simpan('draf.' + kunci, bacaMentah(bidang));
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
      if (!confirm('Kosongkan semua isian di formulir ini?')) return;
      buang('draf.' + kunci); layarIsi(kunci);
    });
    document.getElementById('tombol-simpan').addEventListener('click', function () {
      var hasil = bacaIsian(bidang, false);
      var salah = hasil.salah.concat(FORM[tab].cek ? FORM[tab].cek(hasil.nilai, bidang) : []);
      tandaiSalah(salah);
      if (salah.length) { toast('Ada isian yang perlu diperbaiki.'); return; }
      var kepala = konfig.kepala[tab] || [];
      var asing = Object.keys(hasil.nilai).filter(function (h) { return kepala.indexOf(h) < 0; });
      if (asing.length) { toast('Aplikasi perlu diperbarui (kolom ' + asing.join(', ') + ' tidak ada). Buka Akun > Perbarui pilihan.', 6000); return; }
      var tombolSimpan = document.getElementById('tombol-simpan');
      var lanjut = function () {
        konfirmasi(tab, bidang, hasil.nilai, function () {
          antrian.push({id: idBaru(), tab: tab, nilai: hasil.nilai, waktu: Date.now(), status: 'menunggu'});
          simpanAntrian();
          buang('draf.' + kunci);
          location.hash = '#/';
          toast(navigator.onLine ? 'Tersimpan. Sedang dikirim…' : 'Tersimpan di HP. Akan dikirim saat ada sinyal.');
          kirimAntrian();
        });
      };
      if (tab !== 'Absensi') { lanjut(); return; }
      tombolSimpan.disabled = true;
      cekAbsensiDobel(hasil.nilai['Tanggal']).then(function (boleh) {
        tombolSimpan.disabled = false;
        if (boleh) lanjut();
      });
    });
  }

  // Absensi cukup sekali sehari. Kalau tanggalnya sudah ada, upah akan terhitung dua kali.
  function cekAbsensiDobel(iso) {
    var tgl = tglIndo(iso);
    var pesan = function (asal) {
      return 'Absensi tanggal ' + tgl + ' sudah ' + asal + '.\n\nKalau disimpan lagi, upah hari itu terhitung dua kali. Tetap simpan?';
    };
    var diHp = antrian.some(function (a) { return a.tab === 'Absensi' && a.nilai['Tanggal'] === iso; });
    if (diHp) return Promise.resolve(confirm(pesan('tersimpan di HP ini dan menunggu dikirim')));
    if (!navigator.onLine) return Promise.resolve(true);
    toast('Memeriksa absensi tanggal ' + tgl + '…', 2500);
    return panggil('terbaru', {tab: 'Absensi', n: 15}, 12000).then(function (r) {
      if (!r || !r.ok) return true;
      var iT = r.kepala.indexOf('Tanggal'), iW = r.kepala.indexOf('Timestamp');
      var sama = r.baris.filter(function (row) { return row[iT] === tgl; })[0];
      if (!sama) return true;
      return confirm(pesan('diisi (dikirim ' + sama[iW] + ')'));
    }, function () { return true; });
  }

  function htmlBidang(b, i, draf) {
    var id = 'b' + i;
    var wajib = b.wajib !== false;
    var label = b.label || b.h;
    var kepala = '<span class="label">' + esc(label) + (wajib ? '' : ' <span class="opsional">(boleh kosong)</span>') + '</span>' +
      (b.bantuan ? '<div class="bantuan">' + esc(b.bantuan) + '</div>' : '');
    var d = draf[b.h];
    var isi = '';
    if (b.j === 'tanggal') {
      isi = '<input class="masukan" type="date" name="' + id + '" value="' + esc(d || hariIni()) + '" max="' + hariIni() + '">';
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
    if (b.j === 'kisiBaris') {
      return '<div class="bidang baris-kisi" id="' + id + '" data-h="' + esc(b.h) + '"><div class="nama">' + esc(b.kelompok) + ': ' + esc(b.label) + '</div>' + isi + '<div class="pesan-salah" hidden></div></div>';
    }
    return '<div class="bidang" id="' + id + '" data-h="' + esc(b.h) + '">' + kepala + isi + '<div class="pesan-salah" hidden></div></div>';
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
  function angkaDesimal(s) {
    var t = String(s || '').trim().replace(/\s/g, '');
    if (!t) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');   // 1.075,5
    else t = t.replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
  }

  // Membaca isian menjadi nilai siap kirim. diam = true: tanpa pesan salah (untuk pratinjau).
  function bacaIsian(bidang, diam) {
    var mentah = bacaMentah(bidang);
    var nilai = {}, salah = [];
    var nSementara = {};
    bidang.forEach(function (b) { nSementara[b.h] = mentah[b.h]; });
    bidang.forEach(function (b) {
      if (!b.h) return;
      if (!terlihat(b, nSementara)) return;
      var v = mentah[b.h];
      var wajib = b.wajib !== false;
      var kosong = v === undefined || v === '' || (Array.isArray(v) && !v.length);
      if (kosong) { if (wajib) salah.push([b.h, b.j === 'kisiBaris' ? 'Pilih salah satu.' : 'Wajib diisi.']); return; }
      if (b.j === 'rupiah' || b.j === 'angka') {
        var x = angkaBulat(v);
        if (isNaN(x)) { salah.push([b.h, 'Tulis angka saja.']); return; }
        nilai[b.h] = x;
      } else if (b.j === 'desimal') {
        var y = angkaDesimal(v);
        if (isNaN(y)) { salah.push([b.h, 'Tulis angka, contoh 3,28.']); return; }
        nilai[b.h] = y;
      } else if (b.j === 'tanggal') {
        if (v > hariIni()) { salah.push([b.h, 'Tanggal tidak boleh setelah hari ini.']); return; }
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

  function konfirmasi(tab, bidang, nilai, lanjut) {
    var baris = bidang.filter(function (b) { return b.h && nilai[b.h] !== undefined && nilai[b.h] !== ''; }).map(function (b) {
      var label = b.j === 'kisiBaris' ? b.label : (b.label || b.h);
      return '<li><span>' + esc(label) + '</span><b>' + esc(tampilNilai(b, nilai[b.h])) + '</b></li>';
    }).join('');
    var p = FORM[tab].pratinjau ? FORM[tab].pratinjau(nilai, bidang) : null;
    var div = document.createElement('div');
    div.className = 'tirai';
    div.innerHTML = '<div class="lembar" role="dialog" aria-modal="true"><h2>Periksa lagi</h2><p class="sub">' + esc(tab) + '</p>' +
      '<ul class="ringkas">' + baris + '</ul>' +
      (p ? '<div class="pratinjau">' + p.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') + '</div>' : '') +
      '<div class="baris-tombol"><button class="tombol kedua" data-aksi="ubah">Ubah</button><button class="tombol utama" data-aksi="kirim">Benar, simpan</button></div></div>';
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
    if (!tab) { kerangka('Riwayat', '', '<div class="kosong">Tidak ada catatan.</div>', {aktif: 'terbaru'}); return; }
    var pilih = '<div class="pilih-tab">' + tabBoleh.map(function (t) {
      return '<button data-ke="#/terbaru/' + FORM[t].kunci + '" class="' + (t === tab ? 'aktif' : '') + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
    var tunggu = antrian.filter(function (a) { return a.tab === tab; });
    var htmlTunggu = tunggu.length ? '<div class="pratinjau awas">' + tunggu.length + ' catatan ' + esc(tab) + ' masih di HP, belum masuk Sheet.</div>' : '';
    var cache = ambil('terbaru.' + FORM[tab].kunci, null);
    kerangka('Riwayat', '10 catatan terakhir di Google Sheet', pilih + htmlTunggu + '<div id="daftar-entri">' +
      (cache ? htmlEntri(tab, cache) : '<div class="memuat">Memuat…</div>') + '</div>', {aktif: 'terbaru', muat: true});
    var muat = function () {
      panggil('terbaru', {tab: tab, n: 10}).then(function (r) {
        if (!r.ok) throw new Error(r.galat || 'Gagal memuat.');
        simpan('terbaru.' + FORM[tab].kunci, r);
        var el = document.getElementById('daftar-entri');
        if (el && location.hash.indexOf('#/terbaru') === 0) el.innerHTML = htmlEntri(tab, r);
      }).catch(function (e) {
        var el = document.getElementById('daftar-entri');
        if (!el) return;
        if (cache) toast(e.message + ' Menampilkan data terakhir yang tersimpan.');
        else el.innerHTML = '<div class="galat-kartu">' + esc(e.message) + '</div>';
      });
    };
    document.getElementById('tombol-muat').addEventListener('click', function () { toast('Memuat ulang…', 1500); muat(); });
    muat();
  }

  function htmlEntri(tab, r) {
    if (!r.baris || !r.baris.length) return '<div class="kosong">Belum ada catatan.</div>';
    var k = r.kepala;
    return r.baris.map(function (row) {
      var g = function (h) { var i = k.indexOf(h); return i >= 0 ? row[i] : ''; };
      var judul = '', baris = [], ket = g('Keterangan');
      if (tab === 'Ambil Bahan') {
        judul = g('Tanggal') + ' · ' + g('Pengumpul');
        baris.push(g('Berat bahan (kg)') + ' kg · ' + g('Kondisi bahan'));
        baris.push('Beli bahan ' + g('Uang beli bahan (Rp)') + ' · ' + g('Harga bahan per kg (Rp)') + '/kg');
        baris.push('<span class="redup">' + esc(g('Daerah')) + '</span>');
      } else if (tab === 'Saring Minyak') {
        judul = g('Tanggal saring');
        baris.push(g('Minyak (kg)') + ' kg dari ' + g('Jumlah sulingan yang disaring') + ' sulingan (' + g('Minyak per sulingan (kg)') + ' kg/sulingan)');
        baris.push('Alat: ' + g('Kondisi alat') + ' · Bahan: ' + g('Kondisi bahan'));
      } else if (tab === 'Absensi') {
        judul = g('Tanggal');
        k.forEach(function (h, i) { var m = /^(.+) \[(.+)\]$/.exec(h); if (m && row[i]) baris.push(m[2] + ': ' + row[i]); });
        var upah = ['Upah pengumpulan', 'Upah penyulingan', 'Upah kerja harian & lain'].map(g);
        baris.push('<span class="redup">Upah: pengumpulan ' + esc(upah[0]) + ' · suling ' + esc(upah[1]) + ' · harian & lain ' + esc(upah[2]) + '</span>');
        if (g('Pekerjaan lain')) baris.push('Kerja lain: ' + g('Pekerjaan lain'));
      } else if (tab === 'Penjualan') {
        judul = g('Tanggal') + ' · ' + g('Pembeli');
        baris.push(g('Jumlah') + ' ' + g('Satuan') + ' ' + g('Produk'));
        baris.push(g('Harga satuan (Rp)') + ' × ' + g('Jumlah') + ' = <b>' + esc(g('Total (Rp)')) + '</b> · ' + g('Status bayar'));
      } else if (tab === 'Kas') {
        judul = g('Tanggal') + ' · ' + g('Kategori');
        baris.push((g('Arah') === 'Masuk' ? 'Masuk ' : 'Keluar ') + '<b>' + esc(g('Jumlah (Rp)')) + '</b>');
        if (ket) { baris.push(esc(ket)); ket = ''; }
      }
      var waktu = g('Timestamp');
      return '<div class="kartu entri"><h3><span>' + esc(judul) + '</span><small>' + esc(String(waktu).slice(-5)) + '</small></h3>' +
        baris.map(function (x) { return '<p>' + (/[<]/.test(x) ? x : esc(x)) + '</p>'; }).join('') +
        (ket ? '<div class="ket">' + esc(ket) + '</div>' : '') + '</div>';
    }).join('');
  }

  // ------------------------------------------------------------ layar: antrian
  function layarAntrian() {
    var isi = antrian.length ? antrian.map(function (a) {
      var tgl = a.nilai['Tanggal'] || a.nilai['Tanggal saring'] || '';
      var info = Object.keys(a.nilai).filter(function (h) { return !/^Tanggal/.test(h); }).slice(0, 3).map(function (h) {
        var v = a.nilai[h]; return Array.isArray(v) ? v.join(', ') : v;
      }).join(' · ');
      return '<div class="kartu entri"><h3><span>' + esc(a.tab) + ' · ' + esc(tglIndo(tgl)) + '</span><small>' + (a.status === 'galat' ? 'Gagal' : 'Menunggu') + '</small></h3>' +
        '<p class="redup">' + esc(info) + '</p>' +
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
    var isi = '<div class="kartu">' +
      '<div class="info-baris"><span>Masuk sebagai</span><b>' + esc(sesi.peran) + '</b></div>' +
      '<div class="info-baris"><span>Boleh mengisi</span><b>' + esc((sesi.tab || []).join(', ')) + '</b></div>' +
      '<div class="info-baris"><span>Belum terkirim</span><b>' + antrian.length + ' catatan</b></div>' +
      '<div class="info-baris"><span>Versi aplikasi</span><b>' + esc(VERSI) + (DI_APK ? ' (APK)' : '') + '</b></div>' +
      '</div><div class="tumpuk" style="margin-top:16px">' +
      '<button class="tombol kedua penuh" id="perbarui">Perbarui pilihan (nama, daerah, kategori)</button>' +
      (promptPasang && !DI_APK ? '<button class="tombol utama penuh" id="pasang">Pasang aplikasi di HP ini</button>' : '') +
      '<button class="tombol bahaya penuh" id="keluar">Keluar / ganti PIN</button></div>';
    kerangka('Akun', '', isi, {aktif: 'akun'});
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

  // ------------------------------------------------------------ router
  function tampilkan() {
    var tirai = document.querySelector('.tirai'); if (tirai) tirai.remove();
    if (!sesi) { layarMasuk(); return; }
    var h = location.hash || '#/';
    var bagian = h.replace(/^#\/?/, '').split('/');
    if (bagian[0] === 'isi') layarIsi(bagian[1]);
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
  window.addEventListener('hashchange', tampilkan);
  window.addEventListener('online', function () { perbaruiStatus(); kirimAntrian(); });
  window.addEventListener('offline', perbaruiStatus);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kirimAntrian(); });
  setInterval(function () { if (antrian.length) kirimAntrian(); }, 30000);
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); promptPasang = e; });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* tetap jalan tanpa offline */ });
  }

  tampilkan();
  if (sesi) {
    muatKonfig().then(function () {
      var h = location.hash;
      if (!h || h === '#/' || h.indexOf('#/isi/') === 0 && !document.getElementById('formulir')) tampilkan();
    }, function () { /* pakai daftar tersimpan */ });
    kirimAntrian();
  }

  // Untuk pengujian otomatis.
  window.__sembada = {bidangLengkap: bidangLengkap, angkaDesimal: angkaDesimal, angkaBulat: angkaBulat};
})();
