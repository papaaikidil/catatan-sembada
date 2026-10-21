# Catatan Sembada

Aplikasi pencatatan harian Sembada Karya Wangi: ambil bahan, saring minyak, absensi, penjualan, dan kas.
Semua catatan masuk ke Google Sheet "Catatan Usaha Sembada Karya Wangi", jadi Dashboard dan rekap tetap jalan seperti biasa.

## Isi repo

| Folder | Isi |
|---|---|
| `docs/` | Aplikasi web (dibuka di HP, bisa dipasang). Diterbitkan lewat GitHub Pages. |
| `apps-script/api.gs` | API yang ditempel di project Apps Script "Sembada Sheet". Menulis catatan ke Sheet. |
| `android/` | Pembungkus APK Android. Isinya hanya membuka aplikasi web, jadi perbaikan aplikasi tidak perlu pasang ulang APK. |
| `tes/` | Uji otomatis (logika API dan tampilan aplikasi). |

## Cara kerja singkat

- Setiap pengguna masuk dengan PIN. PIN dan hak isi diatur di tab **Pengaturan** (baris 20–29) di Google Sheet.
- Catatan disimpan dulu di HP, lalu dikirim ke Sheet. Kalau tidak ada sinyal, catatan menunggu dan terkirim otomatis.
- Pilihan (nama pekerja, daerah, kategori kas, tarif) diambil dari tab **Daftar** dan **Tarif Upah**.

## Memperbarui

- Ubah file di `docs/`, simpan ke cabang `main`. GitHub Pages memperbarui aplikasi dalam 1–2 menit; HP ikut terbarui saat aplikasi dibuka dengan sinyal.
- APK hanya perlu dirakit ulang kalau isi `android/` berubah (otomatis lewat GitHub Actions, hasilnya di Releases).

Catatan: kunci tanda tangan APK disimpan di repo supaya rakitan otomatis bisa memperbarui APK lama. APK ini tidak menyimpan data; semua data ada di Google Sheet dan dilindungi PIN.
