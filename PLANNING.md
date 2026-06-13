# Sinkronisasi Data Setiap Transaksi

**Goal:**
Sinkronisasi data antara lokal dengan Google Drive setiap kali terjadi transaksi data.

---

## Logika & Aturan Sinkronisasi

### 1. Resolusi Duplikasi Data (Conflict Resolution)
Untuk mencegah adanya data ganda dan memastikan data tetap akurat, proses sinkronisasi harus mengikuti aturan berikut:

* **Validasi ID Unique:** Sistem akan memindai data berdasarkan `id` transaksi.
* **Logika Pembaruan (Upsert/Replace):** Jika ditemukan 2 data atau lebih dengan `id` yang sama, sistem akan membandingkan tanggal input (*timestamp*). Data lama akan **digantikan (*replace*)** oleh data dengan **tanggal input yang paling terbaru**.