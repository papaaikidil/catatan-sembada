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
  upah per orang dan per alat dihitung dari catatan. Setiap kotak angka minggu bisa diketuk untuk melihat cara hitung,
  komponennya, dan catatan aslinya (trip, saring, penjualan, operasional, hari per hari).

## Isi repo

| Folder | Isi |
|---|---|
| `docs/` | Aplikasi web (dibuka di HP, bisa dipasang). Diterbitkan lewat GitHub Pages. |
| `apps-script/api.gs` | API versi 7. Ditempel di file "api" pada project Apps Script "Sembada Sheet". |
| `apps-script/Kode.gs`, `urut_otomatis.gs`, `ubah_kondisi_bahan.gs` | Cadangan file Apps Script lain di project yang sama (form, pengurutan otomatis). |
| `android/` | Pembungkus APK Android. Isinya hanya membuka aplikasi web, jadi perbaikan aplikasi tidak perlu pasang ulang APK. |
| `tes/` | Uji otomatis: `node tes/api7_test.js` (logika API) dan `node tes/ui7_test.js` (alur aplikasi di browser). |

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
