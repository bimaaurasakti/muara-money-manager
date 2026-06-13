# IMPLEMENTATION PLANNING: Sinkronisasi Data Setiap Transaksi

Dokumen ini merinci rencana teknis untuk mengimplementasikan sinkronisasi otomatis ke Google Drive setiap kali terjadi perubahan data transaksi (Create, Update, Delete).

---

## Bagian 1 - Standarisasi Struktur & Kode

Setiap penulisan kode dalam tahap eksekusi wajib mematuhi aturan berikut:

1.  **Strict TDD:** Setiap logika bisnis baru (terutama di `merge.ts` atau middleware baru) wajib didahului oleh pembuatan test case di `vitest`.
2.  **Functional Programming:** Gunakan pure functions untuk manipulasi data. Dilarang menggunakan *side-effects* di dalam fungsi logika utama.
3.  **Explicit Typing:** Dilarang menggunakan `any`. Gunakan interface yang sudah ada di `src/types/transaction.ts`.
4.  **Safe Access Check:** DILARANG menggunakan pola *Unsafe Key Access* atau *Blind Coalescing* (contoh pseudocode: `value = data_object[UNVERIFIED_KEY] ?? null`). Seluruh kode wajib menggunakan metode *Safe Access Check* atau *Safe Get* yang aman (misalnya: `optional chaining`, `in` operator, atau type guards).
5.  **Error Handling:** Gunakan blok `try...catch` yang memberikan feedback spesifik kepada user melalui komponen `sonner` (toast).
6.  **Single Responsibility:** Pisahkan antara logika *trigger* (di store/hook), logika *merge* (di feature/sync), dan logika *storage* (di lib/google-drive).

---

## Bagian 2 - Rencana Eksekusi

Langkah-langkah teknis dibagi menjadi 5 tahap untuk mengakomodasi fitur background sync, offline queue, dan debouncing.

### Tahap 1: Penguatan Logic Merge (TDD)
- [x] Menambahkan test case di `tests/features/sync/merge.test.ts` untuk skenario:
    - Konflik pada transaksi yang sama dengan timestamp berbeda.
    - Sinkronisasi transaksi yang sudah di-soft-delete (`deleted: true`).
    - Penggabungan array kosong dari remote (first sync).
- [x] Memastikan `mergeTransactions` di `src/features/sync/merge.ts` lulus semua test tersebut.

### Tahap 2: Implementasi Sync Queue & Offline Store
- [x] Menambahkan `syncQueue` pada `transactionStore.ts` untuk melacak perubahan lokal yang belum berhasil diupload.
- [x] Membuat utilitas `offlineManager.ts` untuk:
    - Mendeteksi status koneksi (`navigator.onLine`).
    - Menyimpan antrian ke `localStorage` agar persisten meskipun aplikasi ditutup.
    - Mencoba ulang (retry) sinkronisasi secara otomatis saat koneksi kembali online.

### Tahap 3: Pembuatan Sync Coordinator dengan Debounce
- [x] Memperbarui `useGoogleDriveSync.ts` untuk menyertakan fungsi `syncWithDebounce()`:
    - Menggunakan `setTimeout` atau utilitas debounce (3-5 detik) sebelum memicu `syncNow`.
    - Mengintegrasikan logika **Silent Sync**: menampilkan toast "Sinkronisasi..." hanya jika proses memakan waktu > 1 detik, dan toast "Berhasil" yang menghilang otomatis.
- [x] Menambahkan pengecekan auth otomatis: Jika `isSignedInToGoogle()` false saat trigger sync, arahkan ke proses login/re-auth secara otomatis (jika memungkinkan via silent refresh) atau beri notifikasi login.

### Tahap 4: Integrasi Trigger pada Store Actions
- [x] Menambahkan pemanggilan `syncWithDebounce()` pada action store: `addTransaction`, `updateTransaction`, dan `deleteTransaction`.
- [x] Memastikan trigger hanya dijalankan jika user telah mengaktifkan fitur sinkronisasi Google Drive.

### Tahap 5: Feedback UI (Toast System)
- [x] Standarisasi notifikasi `sonner`:
    - **Loading:** Toast loading yang tidak mengganggu interaksi.
    - **Success:** Toast sukses singkat (background sync).
    - **Offline/Error:** Toast "Offline: Perubahan disimpan secara lokal dan akan disinkronkan nanti".
- [x] Uji coba skenario offline-to-online untuk memastikan antrian terproses dengan benar.

---

**Status:** Selesai. Seluruh tahapan sinkronisasi otomatis telah diimplementasikan dan diverifikasi dengan TDD.
