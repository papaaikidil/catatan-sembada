package id.titikbotanika.catatan

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Jembatan ke printer thermal Bluetooth (ESC/POS lewat Bluetooth klasik / SPP).
 * Dipakai aplikasi web sebagai window.SembadaPrinter:
 *   status()  -> {"ada":bool,"nyala":bool,"izin":bool}
 *   daftar()  -> [{"nama":"...","alamat":"AA:BB:..","printer":bool}]  (perangkat yang sudah dipasangkan/pair)
 *   mintaIzin()  -> meminta izin Bluetooth; hasilnya ke window.__izinBluetooth(boleh)
 *   cetak(alamat, dataBase64, id)  -> hasilnya ke window.__hasilCetak(id, ok, pesan)
 * Hanya melayani halaman aplikasi sendiri (papaaikidil.github.io).
 */
class JembatanPrinter(private val aktivitas: MainActivity, private val web: WebView, private val hostAplikasi: String) {

    @Volatile var hostSekarang: String = ""

    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private val kunciCetak = Any()

    private fun adapter(): BluetoothAdapter? =
        (aktivitas.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private fun bolehHalaman(): Boolean = hostSekarang == hostAplikasi

    fun punyaIzin(): Boolean =
        Build.VERSION.SDK_INT < 31 ||
            aktivitas.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    @JavascriptInterface
    fun status(): String {
        val a = adapter()
        val o = JSONObject()
        o.put("ada", a != null)
        o.put("izin", punyaIzin())
        o.put("nyala", try { a != null && a.isEnabled } catch (e: SecurityException) { false })
        return o.toString()
    }

    @JavascriptInterface
    fun mintaIzin() {
        if (!bolehHalaman()) return
        if (Build.VERSION.SDK_INT >= 31 && !punyaIzin()) {
            aktivitas.runOnUiThread { aktivitas.requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), MainActivity.KODE_IZIN_BLUETOOTH) }
        } else {
            kabariIzin(true)
        }
    }

    fun kabariIzin(boleh: Boolean) {
        web.post { web.evaluateJavascript("window.__izinBluetooth && window.__izinBluetooth($boleh)", null) }
    }

    @SuppressLint("MissingPermission")
    @JavascriptInterface
    fun daftar(): String {
        val hasil = JSONArray()
        if (!bolehHalaman() || !punyaIzin()) return hasil.toString()
        val a = adapter() ?: return hasil.toString()
        try {
            val semua = a.bondedDevices?.toList() ?: emptyList()
            // Printer (kelas Imaging) di atas, lalu urut nama.
            semua.sortedWith(compareBy<BluetoothDevice>({ if (adalahPrinter(it)) 0 else 1 }, { it.name ?: "" })).forEach { d ->
                val o = JSONObject()
                o.put("nama", d.name ?: d.address)
                o.put("alamat", d.address)
                o.put("printer", adalahPrinter(d))
                hasil.put(o)
            }
        } catch (e: SecurityException) {
            // izin dicabut
        }
        return hasil.toString()
    }

    @SuppressLint("MissingPermission")
    private fun adalahPrinter(d: BluetoothDevice): Boolean {
        val k = (try { d.bluetoothClass } catch (e: SecurityException) { null }) ?: return false
        val nama = (try { d.name } catch (e: SecurityException) { null } ?: "").lowercase()
        return k.majorDeviceClass == BluetoothClass.Device.Major.IMAGING ||
            listOf("print", "pos", "mtp", "rpp", "thermal", "58", "80").any { nama.contains(it) }
    }

    @JavascriptInterface
    fun cetak(alamat: String, dataBase64: String, id: String) {
        if (!bolehHalaman()) return
        Thread {
            val pesan = try {
                synchronized(kunciCetak) { kirim(alamat, Base64.decode(dataBase64, Base64.DEFAULT)) }
                ""
            } catch (e: SecurityException) {
                "Aplikasi belum diberi izin Bluetooth."
            } catch (e: Exception) {
                "Printer tidak tersambung. Pastikan printer menyala, dekat dengan HP, dan tidak sedang dipakai aplikasi lain. (" + (e.message ?: e.javaClass.simpleName) + ")"
            }
            val ok = pesan.isEmpty()
            web.post {
                web.evaluateJavascript("window.__hasilCetak && window.__hasilCetak(${JSONObject.quote(id)}, $ok, ${JSONObject.quote(pesan)})", null)
            }
        }.start()
    }

    @SuppressLint("MissingPermission")
    private fun kirim(alamat: String, data: ByteArray) {
        val a = adapter() ?: throw IllegalStateException("HP tidak punya Bluetooth")
        if (!a.isEnabled) throw IllegalStateException("Bluetooth mati")
        val perangkat = a.getRemoteDevice(alamat)
        val cara: List<() -> BluetoothSocket> = listOf(
            { perangkat.createRfcommSocketToServiceRecord(sppUuid) },
            { perangkat.createInsecureRfcommSocketToServiceRecord(sppUuid) },
            { perangkat.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType).invoke(perangkat, 1) as BluetoothSocket }
        )
        var soket: BluetoothSocket? = null
        var galat: Exception? = null
        for (buat in cara) {
            var s: BluetoothSocket? = null
            try {
                s = buat()
                s.connect()
                soket = s
                break
            } catch (e: Exception) {
                galat = e
                try { s?.close() } catch (e2: Exception) { }
            }
        }
        val sambung = soket ?: throw (galat ?: IllegalStateException("tidak tersambung"))
        try {
            val keluar = sambung.outputStream
            // Dikirim sedikit-sedikit supaya penampung printer murah tidak meluap.
            var i = 0
            while (i < data.size) {
                val n = minOf(256, data.size - i)
                keluar.write(data, i, n)
                keluar.flush()
                i += n
                Thread.sleep(25)
            }
            // Beri waktu printer menerima semua data sebelum sambungan ditutup.
            Thread.sleep(600L + data.size / 20L)
        } finally {
            try { sambung.close() } catch (e2: Exception) { }
        }
    }
}
