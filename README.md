# Catatan Sembada

Aplikasi pencatatan harian Sembada Karya Wangi: ambil bahan, produksi suling, saring minyak, absensi, penjualan, dan kas.
Semua catatan masuk ke Google Sheet "Catatan Usaha Sembada Karya Wangi", jadi Dashboard, Rekap, dan HPP tetap jalan seperti biasa.

Sejak versi 3 (API 7) tampilan dan fiturnya sama dengan Catatan Sembada Kepuh, tetapi tetap memakai Google Sheet Sembada yang lama.
Catatan lama tidak diubah.

## Yang bisa dilakukan

- **Masuk dengan nama pengguna dan sandi** masing-masing (tab tersembunyi "Akun Aplikasi", sandi terenkripsi).
  Saat pertama dipakai, akun dibuat otomatis dari tab "Pengguna": PIN lama menjadi sandi awal.
- **Produksi Suling** diisi sekali sehari untuk semua alat (jumlah sulingan, operator, kondisi alat) ke tab "Produksi Suling".
  Upahnya dihitung dari Tarif Upah jenis Penyulingan (1x, 2x, 3x suling; lebih dari itu = tarif tertinggi + tarif 1x per sulingan tambahan).
- **Absensi** diisi sekali sehari untuk semua karyawan (satu baris per orang di tab "Absensi Harian"), dengan tombol isi cepat per tim
  dan isian kerja lain. Tim suling cukup memilih "Nyuling (upah dari produksi)".
- **Kelola** (pemilik dan pengguna yang boleh mengatur): alat suling, karyawan, tarif upah, daftar pilihan, produk, dan kategori kas.
  Semuanya tersimpan di tab yang sudah ada (Karyawan, Alat Suling, Tarif Upah, Daftar). Ganti nama ikut mengganti catatan lama supaya rekap utuh.
- **Pengguna & sandi**, **Tampilan & tata letak** (nama, logo, warna, ukuran huruf, susunan beranda, urutan/nama menu, isian formulir).
- **Ringkasan**: angka minggu dan bulan dibaca langsung dari tab Rekap Mingguan dan Rekap Bulanan (sama dengan Dashboard);
  upah per orang dan per alat dihitung dari catatan. Setiap kotak angka minggu dan bulan bisa diketuk untuk melihat cara hitung,
  komponennya (bisa dibuka satu per satu), dan catatan aslinya (trip, saring, penjualan, operasional, kas, hari per hari).
  Upah per orang bisa dibuka per hari untuk gajian.
- **Batas peringatan** (Kelola › Batas peringatan, atau dari kartu Peringatan di Ringkasan): batas disimpan di sel yang sama
  dengan Dashboard (tab Pengaturan kolom B dan Dashboard kolom D). Laba usaha di peringatan bisa dihitung 1–4 minggu terakhir.
- **Semua upah dari Absensi**: tim suling memilih 1x, 2x, atau 3x suling (jumlah sulingan dan upahnya ikut tercatat),
  atau "Kerja lain…" untuk pekerjaan dengan upah khusus. Formulir Produksi Suling tidak ditampilkan lagi supaya tidak tercatat dua kali.
- **Laporan Suling** (3.12) diisi tim suling setiap hari setelah nyuling, ke tab baru "Laporan Suling" (dibuat otomatis saat laporan pertama):
  tanggal (hari ikut otomatis), anggota tim (terisi dari regu tim suling, misalnya "Eko & Pak Gatot" menjadi Eko dan Pak Gatot),
  jumlah suling, kondisi bahan, jam mulai & selesai (lama nyuling dihitung otomatis, termasuk yang lewat tengah malam),
  kondisi alat, dan keterangan lapangan. Pengisinya tercatat di kolom "Diisi oleh". Jam disimpan sebagai teks "07:30".
  Laporan **tidak** menambah sulingan atau upah di Rekap (tetap dari Absensi); kalau jumlahnya beda dengan Absensi di tanggal
  yang sama, muncul sebagai keterangan "Jumlah suling beda" di Ringkasan. Akun yang dulu boleh mengisi Produksi Suling
  otomatis boleh mengisi Laporan Suling; akun lain diberi akses lewat Kelola › Pengguna › Boleh mengisi.
- **Catatan bon** (Beranda › Catatan bon, untuk pemilik dan yang boleh mengatur): bon dua arah, yaitu "orang ngebon ke kita"
  (kasbon karyawan: nama dipilih dari daftar Karyawan aktif, atau Lainnya…) dan "kita ngebon ke orang" (utang ke toko/pemasok). Setiap orang
  punya catatan bon sendiri (semua bonnya, sisa, riwayat cicilan) dengan tombol Cicil (isi jumlah) dan Bayar lunas; cicilan dibagi ke bon
  yang paling lama dulu. Cara bayar: tunai, transfer, potong upah, barang; disaring belum/sudah lunas, dikelompokkan per nama, tanda lewat jatuh tempo. Disimpan di tab
  "Bon" dan "Bayar Bon" (dibuat otomatis). Penjualan dengan status bayar belum lunas ikut tampil dan bisa ditandai lunas.
  Bon langsung tercatat di tab Kas dan ikut berubah/terhapus bersama bonnya: kasbon = "Bon pekerja (dipinjamkan)" (keluar),
  pembayarannya = "Pelunasan bon pekerja" (masuk, termasuk potong upah); pinjam uang = "Pinjaman masuk", dibayar = "Bayar hutang";
  ambil barang dulu = belum ada uang keluar, saat dibayar tercatat dengan kategori pilihan. Dibayar dengan barang tidak masuk Kas.
  Bon lama yang sudah pernah dicatat manual di Kas bisa disimpan tanpa Kas. Baris Kas dari bon ditandai "[bon:...]" di Keterangan
  dan hanya bisa diubah lewat Catatan bon.
- **Slip upah mingguan** (Ringkasan › Upah per orang › "Slip upah & cetak"): per orang atau semua sekaligus, rincian per hari,
  tambahan (bonus) dan potongan (kasbon) yang hanya tertulis di slip, kertas 58 mm atau 80 mm. Bisa dicetak langsung ke
  printer thermal Bluetooth dari APK (ESC/POS lewat Bluetooth klasik; printer dipasangkan dulu di Pengaturan Bluetooth HP),
  lewat aplikasi RawBT di Chrome Android, sebagai gambar selebar kertas lewat menu Bagikan ke aplikasi printer (iPhone), atau dikirim ke nomor HP karyawan lewat WhatsApp biasa atau WA Bisnis (dipilih).
- **Minyak dari sisa saringan** (endapan, kain saring, wadah): dicatat di Saring Minyak dengan jumlah sulingan 0.
  Kondisi bahan & alat boleh kosong, keterangan wajib. Ikut menambah stok dan minyak dihasilkan, tidak menambah sulingan.
- **Stok minyak**: hasil timbang jadi patokan; saring dan penjualan yang dicatat sesudah timbangan (termasuk di hari yang sama)
  ikut menambah atau mengurangi stok. Hasil timbang di Ringkasan bisa diketuk untuk diubah atau dihapus (tercatat di Log Aplikasi).
- **Tanggal masa depan**: semua isian boleh diisi untuk besok atau beberapa hari ke depan (paling jauh 30 hari),
  dengan peringatan di layar "Periksa lagi".
- **Cepat dibuka**: aplikasi dibuka dari salinan di HP (tidak menunggu sinyal); versi baru diambil di belakang dan
  ditawarkan lewat "Versi baru aplikasi sudah siap". Ringkasan disimpan sebentar di server (cache 10 menit) dan
  dihitung ulang setiap ada catatan baru lewat aplikasi; tombol muat ulang di Ringkasan selalu menghitung ulang.
- **Tablet dan layar landscape**: menu pindah ke samping kiri, beranda dan ringkasan dibagi dua kolom
  (ringkasan minggu di kiri; stok, peringatan, dan tombol catatan di kanan), riwayat dan menu Kelola berjajar,
  formulir dua kolom di dalam panel, dan rincian tampil sebagai kotak di tengah. Di HP tegak tampilannya tetap sama.

## Isi repo

| Folder | Isi |
|---|---|
| `docs/` | Aplikasi web (dibuka di HP, bisa dipasang). Diterbitkan lewat GitHub Pages. |
| `apps-script/api.gs` | API versi 7. Ditempel di file "api" pada project Apps Script "Sembada Sheet". |
| `apps-script/Kode.gs`, `urut_otomatis.gs`, `ubah_kondisi_bahan.gs` | Cadangan file Apps Script lain di project yang sama (form, pengurutan otomatis). |
| `android/` | Pembungkus APK Android. Isinya hanya membuka aplikasi web, jadi perbaikan aplikasi tidak perlu pasang ulang APK. |
| `tes/` | Uji otomatis: `node tes/api7_test.js` (logika API) dan `node tes/ui7_test.js` (alur aplikasi di browser), `node tes/lebar_test.js` (tata letak tablet, landscape, dan HP), `node tes/sw_test.js` (buka cepat & versi baru), `node tes/slip_test.js` (slip upah & cetak), dan `node tes/bon_test.js` (catatan bon). |

## Memperbarui

- Ubah file di `docs/`, simpan ke cabang `main`. GitHub Pages memperbarui aplikasi dalam 1–2 menit; HP ikut terbarui saat aplikasi dibuka dengan sinyal.
- Kalau `api.gs` berubah: tempel ulang seluruh isinya di file **api** (bukan Kode.gs), simpan, lalu
  **Terapkan > Kelola deployment > pensil > Versi baru > Terapkan**. Alamat `/exec` tetap sama.
- APK hanya perlu dirakit ulang kalau isi `android/` berubah (otomatis lewat GitHub Actions, hasilnya di Releases).

## Perubahan di Google Sheet untuk versi 3

- Tab baru **Produksi Suling** (setelah Ambil Bahan).
- Rumus Rekap Mingguan & Bulanan kolom Sulingan, Hari ketel kosong, Upah penyuling, dan upah per orang kini menjumlahkan
  Absensi Harian + Produksi Suling. Dashboard (Data sampai, keterangan) ikut membaca Produksi Suling.
  Semua angka minggu dan bulan lama sudah dicek sama persis sebelum dan sesudah perubahan.
- Kolom tambahan: Karyawan (No HP, Tanggal keluar), Tarif Upah (Aktif, kolom I), Daftar (Harga biasa (Rp), kolom P),
  dan satu tarif baru "Nyuling (upah dari produksi)".

Catatan: kunci tanda tangan APK disimpan di repo supaya rakitan otomatis bisa memperbarui APK lama. APK ini tidak menyimpan data;
semua data ada di Google Sheet dan dilindungi nama pengguna + sandi.
