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
  function tabDariKunci(k) { return URUTAN_TAB.filter(function (t) { return FORM[t].kunci === k; })[0]; }

  function upahTarif(pilihan) {
    var t = (konfig && konfig.tarif || []).filter(function (x) { return x.pilihan === pilihan; })[0];
    return t ? t.upah : 0;
  }

  // Kelompok absensi untuk PIN ini (Pengumpul / Tim suling). Kosong = boleh mengabsen semua.
  function kelompokSaya() { return (sesi && sesi.kelompokAbsensi) || ''; }
  var JOBDESK = {'Pengumpul': 'Pengumpulan', 'Tim suling': 'Penyulingan'};

  // Bidang lengkap sebuah tab. Baris absensi dan upah kerja lain mengikuti judul kolom di Sheet.
  function bidangLengkap(tab) {
    var kepala = (konfig && konfig.kepala && konfig.kepala[tab]) || [];
    var kelompok = tab === 'Absensi' ? kelompokSaya() : '';
    var out = [];
    FORM[tab].bidang.forEach(function (b) {
      if (b.j === 'kisi') {
        kepala.forEach(function (h) {
          var m = /^(.+) \[(.+)\]$/.exec(h);
          // Mandor/pemilik: baris orang boleh kosong, karena jobdesk sudah diabsen timnya sendiri.
          if (m && (!kelompok || m[1] === kelompok)) out.push({j: 'kisiBaris', h: h, kelompok: m[1], label: m[2], wajib: !!kelompok});
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
        sesi = {pin: pin, peran: r.peran, tab: r.tab, semua: r.semua, kelompokAbsensi: r.kelompokAbsensi || ''};
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
        if (sesi) { sesi.tab = r.tab; sesi.semua = r.semua; sesi.peran = r.peran; sesi.kelompokAbsensi = r.kelompokAbsensi || ''; simpan('sesi', sesi); }
      }
      return r;
    });
  }

  // ------------------------------------------------------------ layar: beranda
  function layarBeranda() {
    var tab = (sesi.tab || []).filter(function (t) { return FORM[t]; });
    var tombol = tab.map(function (t) {
      var f = FORM[t];
      var ket = (t === 'Absensi' && kelompokSaya()) ? 'Absensi ' + kelompokSaya().toLowerCase() + ' saja.' : f.ket;
      return '<a class="tombol-catatan" href="#/isi/' + f.kunci + '"><span class="lingkar">' + IKON[f.ikon] + '</span><b>' + esc(t) + '</b><small>' + esc(ket) + '</small></a>';
    }).join('');
    var isi = '<div id="kotak-status">' + htmlStatus() + '</div>';
    if (sesi.semua) isi += '<div id="kotak-ringkas">' + htmlRingkasMini(ambil('ringkasan', null)) + '</div>';
    isi += '<div class="judul-bagian">Isi catatan</div>' +
      (tab.length ? '<div class="grid-catatan' + (tab.length <= 2 ? ' satu' : '') + '">' + tombol + '</div>' : '<div class="kosong">PIN ini belum diberi akses ke catatan mana pun.</div>');
    kerangka('Catatan Sembada', 'Masuk sebagai ' + (sesi.peran || ''), isi, {aktif: 'beranda'});
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
      return '<div class="gaji"><div class="gaji-judul">Upah per orang</div><p class="catatan">Rincian upah per orang muncul setelah API di Apps Script diperbarui ke versi 4.</p></div>';
    }
    var total = 0;
    var baris = m.upahOrang.map(function (o) {
      total += o.upah || 0;
      return '<div class="gaji-baris"><span>' + esc(o.nama) + '</span><b>' + esc(rp(o.upah)) + '</b></div>';
    }).join('');
    return '<div class="gaji"><div class="gaji-judul">Upah per orang (untuk gajian)' + (berjalan ? ' · sampai hari ini' : '') + '</div>' + baris +
      '<div class="gaji-baris gaji-total"><span>Total</span><b>' + esc(rp(total)) + '</b></div>' +
      '<p class="catatan">Dari absensi. Bonus atau tambahan yang dicatat di Kas belum termasuk.</p></div>';
  }

  function htmlRingkasMini(r) {
    if (!r) return '';
    var daftar = daftarMinggu(r);
    if (!daftar.length) return '';
    var idx = indeksPilihan(daftar, 'mingguDipilih', function (m) { return m.mulai; });
    var m = daftar[idx], sebelum = daftar[idx + 1];
    var perlu = (r.peringatan || []).filter(function (p) { return /PERHATIAN|TAGIH|PERBAIKI|BACA/.test(p.status); }).length;
    return '<div class="kartu"><h2>Ringkasan minggu</h2>' + selectMinggu(daftar, idx) +
      '<p class="sub">' + (idx === 0 ? 'Data sampai ' + esc(r.dataSampai) : 'Minggu yang sudah lewat') + '</p>' +
      '<div class="angka-grid">' +
      kotakAngka('Penjualan', rp(m.penjualan), false, sebelum ? banding(m.penjualan, sebelum.penjualan) : '') +
      kotakAngka('Laba usaha', rp(m.laba), m.laba < 0, sebelum ? banding(m.laba, sebelum.laba) : '') +
      kotakAngka('Minyak dihasilkan', ang(m.minyak) + ' kg') + kotakAngka('Total upah', rp(totalUpah(m))) +
      '</div>' + htmlGaji(m, idx === 0) +
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
    var p = (r.peringatan || []).map(function (x) {
      var kelas = /PERHATIAN|TAGIH|PERBAIKI|BACA/.test(x.status) ? 'perlu' : (x.status === 'Aman' ? 'aman' : 'netral');
      return '<div class="peringatan"><span class="chip-status ' + kelas + '">' + esc(x.status || '–') + '</span><div><p>' + esc(x.hal) +
        (x.nilai ? ': <b>' + esc(x.nilai) + '</b>' : '') + '</p>' + (x.saran ? '<p class="saran">' + esc(x.saran) + '</p>' : '') + '</div></div>';
    }).join('');

    var dm = daftarMinggu(r);
    var im = indeksPilihan(dm, 'mingguDipilih', function (m) { return m.mulai; });
    var m = dm[im], ms = dm[im + 1];
    var minggu = m ? '<div class="kartu"><h2>Minggu</h2>' + selectMinggu(dm, im) +
      (ms ? '<p class="sub">Panah membandingkan dengan minggu sebelumnya (' + esc(labelMinggu(ms)) + ').</p>' : '<p class="sub"></p>') +
      '<div class="angka-grid">' +
      kotakAngka('Penjualan', rp(m.penjualan), false, ms ? banding(m.penjualan, ms.penjualan) : '') +
      kotakAngka('Laba usaha', rp(m.laba), m.laba < 0, ms ? banding(m.laba, ms.laba) : '') +
      kotakAngka('Minyak dihasilkan', ang(m.minyak) + ' kg', false, ms ? banding(m.minyak, ms.minyak) : '') +
      kotakAngka('Minyak terjual', ang(m.terjual) + ' kg') +
      kotakAngka('Bahan masuk', ang(m.bahanKg, 0) + ' kg') + kotakAngka('Harga bahan/kg', rp(m.hargaBahan)) +
      kotakAngka('Biaya per kg minyak', rp(m.biayaPerKg)) + kotakAngka('Total upah', rp(totalUpah(m))) +
      kotakAngka('Sulingan', ang(m.sulingan, 0) + ' kali') + kotakAngka('Hari ketel kosong', ang(m.ketelKosong, 0) + ' hari', m.ketelKosong >= 2) +
      '</div>' + htmlGaji(m, im === 0) + '</div>' : '';

    var db = daftarBulan(r);
    var ib = indeksPilihan(db, 'bulanDipilih', function (x) { return x.bulan; });
    var b = db[ib];
    var bulan = b ? '<div class="kartu"><h2>Bulan</h2><select class="masukan pilih-periode" id="pilih-bulan" aria-label="Pilih bulan">' +
      db.map(function (x, i) { return '<option value="' + esc(x.bulan) + '"' + (i === ib ? ' selected' : '') + '>' + esc(labelBulan(x)) + (i === 0 ? ' (bulan ini)' : '') + '</option>'; }).join('') +
      '</select><div class="angka-grid">' +
      kotakAngka('Penjualan', rp(b.penjualan)) + kotakAngka('Laba usaha', rp(b.laba), b.laba < 0) +
      kotakAngka('Cicilan kendaraan', rp(b.cicilan)) + kotakAngka('Keluarga & pribadi', rp(b.keluarga)) +
      kotakAngka('Proyek + upah harian', rp((b.proyekBahan || 0) + (b.upahHarian || 0))) + kotakAngka('Perubahan kas', rp(b.perubahanKas), b.perubahanKas < 0) +
      '</div></div>' : '';

    return '<p class="sub" style="margin:0 0 12px;color:var(--teks-2)">Data sampai ' + esc(r.dataSampai) + '</p>' + minggu + bulan +
      '<div class="judul-bagian">Peringatan (kondisi terbaru)</div><div class="kartu">' + (p || '<div class="kosong">Tidak ada peringatan.</div>') + '</div>';
  }

  // ------------------------------------------------------------ layar: isi formulir
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
    var bidang = bidangLengkap(tab);
    var draf = ubah ? mentahDariNilai(bidang, ubah.nilai) : ambil('draf.' + kunci, {});
    var catatanAtas = ubah ? '<div class="pratinjau awas">Mengubah catatan yang sudah masuk Google Sheet. Perubahan dicatat di tab Log Aplikasi.</div>'
      : (tab === 'Absensi' && !kelompokSaya()) ? '<div class="pratinjau">Pekerja yang sudah absen sendiri lewat HP-nya (pengumpul: trip, tim suling: sulingan) biarkan <b>Tidak diisi</b>. Isi hanya yang kerja harian atau kerja lain.</div>' : '';
    var html = catatanAtas +
      bidang.map(function (b, i) { return htmlBidang(b, i, draf); }).join('') +
      '<div class="bidang" data-h="_upah" hidden><div class="pesan-salah"></div></div>' +
      '<div class="pratinjau" id="pratinjau" hidden></div>';
    var tglLama = ubah ? (ubah.nilai['Tanggal'] || ubah.nilai['Tanggal saring'] || '') : '';
    var judulForm = (tab === 'Absensi' && kelompokSaya() && !ubah) ? 'Absensi ' + kelompokSaya() : tab;
    var subjudul = ubah ? 'Catatan tanggal ' + tglIndo(tglLama)
      : judulForm !== tab ? 'Hanya pekerjaan ' + kelompokSaya().toLowerCase() + '. Kerja lain diisi mandor.'
      : tab === 'Absensi' ? 'Untuk kerja harian dan kerja lain.'
      : FORM[tab].ket;
    kerangka(ubah ? 'Ubah ' + tab : judulForm, subjudul,
      '<form id="formulir" novalidate>' + html + '</form>', {kembali: kembali, tanpaNav: true});
    app.insertAdjacentHTML('beforeend', '<div class="aksi-bawah"><button class="tombol kedua" id="tombol-kosong" type="button">' + (ubah ? 'Batal' : 'Kosongkan') + '</button>' +
      '<button class="tombol utama" id="tombol-simpan" type="button">' + (ubah ? 'Simpan perubahan' : 'Simpan') + '</button></div>');

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
      if (!ubah) simpan('draf.' + kunci, bacaMentah(bidang));
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
      var kepala = konfig.kepala[tab] || [];
      var asing = Object.keys(hasil.nilai).filter(function (h) { return kepala.indexOf(h) < 0; });
      if (asing.length) { toast('Aplikasi perlu diperbarui (kolom ' + asing.join(', ') + ' tidak ada). Buka Akun > Perbarui pilihan.', 6000); return; }
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
      cekAbsensiDobel(hasil.nilai).then(function (boleh) {
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

  // Satu tanggal = satu baris absensi. Isian kelompok lain digabung, tapi orang yang sama
  // tidak boleh diabsen dua kali dengan isi berbeda (upah bisa dobel).
  function cekAbsensiDobel(nilai) {
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
        var y = angkaDesimal(v, b.ribuan);
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

  function konfirmasi(tab, bidang, nilai, lanjut, labelKirim) {
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
      '<div class="baris-tombol"><button class="tombol kedua" data-aksi="ubah">Ubah</button><button class="tombol utama" data-aksi="kirim">' + esc(labelKirim || 'Benar, simpan') + '</button></div></div>';
    document.body.appendChild(div);
    div.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-aksi]');
      if (ev.target === div || (a && a.dataset.aksi === 'ubah')) { div.remove(); return; }
      if (a && a.dataset.aksi === 'kirim') { div.remove(); lanjut(); }
    });
  }

  // ------------------------------------------------------------ layar: riwayat (entri terakhir)
  function bisaKelola() { return !!(sesi && sesi.semua && konfig && konfig.versiApi >= 2); }

  function layarTerbaru(kunci) {
    var tabBoleh = (sesi.tab || []).filter(function (t) { return FORM[t]; });
    var tab = tabDariKunci(kunci) || tabBoleh[0];
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
      tanyaHapus(tab, kartu ? kartu.querySelector('h3 span').textContent : '', function () {
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

  function tanyaHapus(tab, judul, lanjut) {
    var div = document.createElement('div');
    div.className = 'tirai';
    div.innerHTML = '<div class="lembar" role="dialog" aria-modal="true"><h2>Hapus catatan ini?</h2>' +
      '<p class="sub">' + esc(tab) + ' · ' + esc(judul) + '</p>' +
      '<p style="margin:0 0 16px;font-size:14px">Catatan akan hilang dari Google Sheet dan semua rekap ikut berubah. Isinya tetap tersimpan di tab Log Aplikasi kalau perlu dikembalikan.</p>' +
      '<div class="baris-tombol"><button class="tombol kedua" data-aksi="batal">Batal</button><button class="tombol bahaya" data-aksi="hapus">Ya, hapus</button></div></div>';
    document.body.appendChild(div);
    div.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-aksi]');
      if (ev.target === div || (a && a.dataset.aksi === 'batal')) { div.remove(); return; }
      if (a && a.dataset.aksi === 'hapus') { div.remove(); lanjut(); }
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
      (sesi.semua ? (bisaKelola() ? '<button class="tombol utama penuh" data-ke="#/pin">Kelola PIN pekerja</button>'
        : '<div class="pratinjau awas">Fitur kelola PIN dan ubah catatan butuh API versi baru di Apps Script.</div>') : '') +
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

  // ------------------------------------------------------------ layar: kelola PIN (pemilik)
  function layarPin() {
    if (!bisaKelola()) { location.hash = '#/akun'; return; }
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
      }).join('') +
      '<p class="sub" style="color:var(--teks-2);margin-top:14px;font-size:13px">PIN baru langsung berlaku. Pekerja yang sedang masuk dengan PIN lama akan diminta memasukkan PIN baru. Hak isi (kolom "Boleh mengisi") diubah di tab Pengaturan.</p>';
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
