package id.titikbotanika.catatan

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.ContactsContract
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * Memilih satu nomor dari aplikasi Kontak HP untuk mengisi data pembeli/supplier.
 * Dipakai aplikasi web sebagai window.SembadaKontak:
 *   ada()        -> true
 *   pilih(id)    -> membuka pemilih kontak; hasilnya ke window.__hasilKontak(id, {"nama":"..","hp":".."} atau null, pesan)
 * Memakai pemilih kontak bawaan Android (ACTION_PICK), jadi aplikasi TIDAK meminta izin membaca semua kontak:
 * hanya kontak yang dipilih yang bisa dibaca, dan hanya nama + nomornya.
 * Hanya melayani halaman aplikasi sendiri (papaaikidil.github.io).
 */
class JembatanKontak(private val aktivitas: Activity, private val web: WebView, private val hostAplikasi: String) {

    companion object {
        const val KODE_PILIH_KONTAK = 72
    }

    @Volatile var hostSekarang: String = ""
    @Volatile private var idTunggu: String? = null

    @JavascriptInterface
    fun ada(): Boolean = true

    @JavascriptInterface
    fun pilih(id: String) {
        if (hostSekarang != hostAplikasi) return
        idTunggu = id
        aktivitas.runOnUiThread {
            try {
                @Suppress("DEPRECATION")
                aktivitas.startActivityForResult(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI), KODE_PILIH_KONTAK)
            } catch (e: ActivityNotFoundException) {
                idTunggu = null
                kabari(id, null, "Aplikasi Kontak tidak ditemukan di HP ini.")
            }
        }
    }

    /** Dipanggil MainActivity.onActivityResult. */
    fun hasil(kodeHasil: Int, data: Intent?) {
        val id = idTunggu ?: return
        idTunggu = null
        val uri = data?.data
        if (kodeHasil != Activity.RESULT_OK || uri == null) {
            kabari(id, null, "")   // dibatalkan
            return
        }
        try {
            val kolom = arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER)
            aktivitas.contentResolver.query(uri, kolom, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val o = JSONObject()
                    o.put("nama", c.getString(0) ?: "")
                    o.put("hp", c.getString(1) ?: "")
                    kabari(id, o, "")
                    return
                }
            }
            kabari(id, null, "Kontak tidak terbaca. Coba pilih lagi.")
        } catch (e: SecurityException) {
            kabari(id, null, "HP tidak mengizinkan membaca kontak ini.")
        } catch (e: Exception) {
            kabari(id, null, "Kontak tidak terbaca. Coba pilih lagi.")
        }
    }

    private fun kabari(id: String, o: JSONObject?, pesan: String) {
        web.post {
            web.evaluateJavascript("window.__hasilKontak && window.__hasilKontak(" + JSONObject.quote(id) + ", " +
                (o?.toString() ?: "null") + ", " + JSONObject.quote(pesan) + ")", null)
        }
    }
}
