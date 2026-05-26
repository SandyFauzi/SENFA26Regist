# SENFA 2026 - Registration Portal & Backend

Repositori ini berisi sistem pendaftaran terintegrasi untuk **Seminar Nasional Fisika dan Aplikasinya (SENFA) 2026** beserta Lomba Karya Tulis Ilmiah Nasional (LKTII). Sistem ini terdiri dari *frontend* berbasis Next.js dan *backend* menggunakan Google Apps Script.

## Struktur Direktori Utama

### 1. Frontend (Next.js)
Frontend menangani antarmuka pengguna (UI), validasi form sisi klien, dan konversi file (PDF/Gambar) ke format Base64 sebelum dikirim ke backend.

- **`app/daftar/page.jsx`**
  Halaman pendaftaran utama yang memuat dua tab: **Seminar** dan **LKTII**.
  - **Seminar**: Mengumpulkan data personal, tipe peserta (Pemakalah/Non-Pemakalah), kehadiran (Online/Offline), serta kategori harga. Jika Pemakalah, muncul opsi detail makalah dan pilihan tipe upload ("Hanya Abstrak" atau "Abstrak & Full Paper"). *Catatan: Bukti pembayaran TIDAK diunggah di form ini, melainkan dibayarkan setelah peserta menerima email invoice.*
  - **LKTII**: Mengumpulkan data tim, judul karya, dan file PDF LKTII.
  - *Fitur Utama*: Drag & drop file upload, Base64 conversion, dynamic form rendering berdasarkan radio button.

- **`app/submit-paper/page.jsx`**
  Halaman khusus bagi pemakalah yang pada saat pendaftaran awal memilih **"Hanya Abstrak"**.
  - Peserta memasukkan `Registration ID` dan mengunggah file `Full Paper`.
  - Berkomunikasi dengan *endpoint* `submit_paper` di Google Apps Script.

### 2. Backend (Google Apps Script)
Backend bertugas sebagai API endpoint, pengelola file Google Drive, manipulasi Google Sheets, dan pengirim email otomatis.

- **`App.gs`**
  File script tunggal yang di-deploy sebagai *Web App* di Google Apps Script.
  - **`doPost(e)`**: Entry point yang menerima JSON payload dari frontend. Melakukan *routing* ke handler spesifik berdasarkan field `type` (`seminar`, `lktii`, `submit_paper`).
  - **`handleSeminar(data)` & `handleLKTII(data)`**: 
    1. Memvalidasi input (email, whatsapp).
    2. Meng-generate Registration ID (`SEM-2026-XXXX`).
    3. Mendekode Base64 menjadi file Blob dan menyimpannya di Google Drive dalam folder spesifik per peserta (`Reg ID - Nama`).
    4. Mengisi baris baru di Google Sheets.
    5. Mengirimkan **Email Invoice** otomatis berisi instruksi QRIS dan link chat konfirmasi ke Bendahara. Jika peserta seminar memilih "Hanya Abstrak", email ini juga akan memuat link ke `/submit-paper`.
  - **`handleSubmitPaper(data)`**: Endpoint susulan untuk menangani unggahan *Full Paper*. Mencari baris berdasarkan Reg ID, lalu memperbarui link file di Spreadsheet.
  - **`getOrCreateSheet(ss, name)`**: Pembuat sheet otomatis beserta *header* (kolom) jika sheet tujuan belum ada.
  - **`setupTrigger()` & `onEditTrigger(e)` / `checkAndSendPaidEmails()`**: Fungsi trigger untuk mendeteksi kapan admin mengubah status pembayaran menjadi "Paid" di Google Sheets, lalu secara otomatis mengirimkan email Konfirmasi Lunas ke peserta.

## Alur Pendaftaran (Workflow Terbaru)
1. **Pendaftaran**: Peserta mengisi form di `/daftar` dan mengunggah dokumen makalah/abstrak (jika ada).
2. **Tagihan (Invoice)**: Backend menerima data, membuat folder Drive, menyimpan di Sheet, dan mengirim email Invoice (berisi total bayar, QRIS, & link WA Bendahara).
3. **Pembayaran**: Peserta membayar dan chat bendahara. Admin/Bendahara mengubah `Status Bayar` menjadi `Paid` di Google Sheets.
4. **Lunas**: Trigger Apps Script mendeteksi perubahan, status daftar menjadi `Verified`, dan sistem mengirim email "Pembayaran Lunas".
5. **Full Paper**: Jika peserta sebelumnya hanya setor abstrak, ia bisa ke `/submit-paper` menggunakan Reg ID untuk mengunggah full paper kapan saja sebelum batas waktu.

## Catatan untuk Development/Update
- Environment URL backend disimpan di `.env.local` sebagai `NEXT_PUBLIC_APPS_SCRIPT_URL`.
- Modifikasi kolom untuk sheet Seminar ada di dalam blok fungsi `getOrCreateSheet` di `App.gs`. Apabila mengubah kolom, Sheet lama harus dihapus agar kolom baru dapat di-generate ulang.
