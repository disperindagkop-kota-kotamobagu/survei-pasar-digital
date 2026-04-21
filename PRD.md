Tentu, ini adalah draf **Product Requirements Document (PRD.md)** yang disusun khusus untuk aplikasi survei pasar hybrid Anda. File ini bisa Anda simpan di root folder proyek Anda di VS Code sebagai panduan pengembangan.

---

# Product Requirements Document (PRD): Sistem Survei Kontribusi Pasar

**Versi:** 1.0  
**Status:** Draft / Pengembangan  
**Target Platform:** Progressive Web App (PWA)  
**Tech Stack:** Next.js, Supabase, Dexie.js, Tesseract.js

---

## 1. Ringkasan Produk
Aplikasi survei lapangan yang dirancang untuk mengumpulkan data kontribusi dari pasar-pasar secara akurat dan transparan. Aplikasi bekerja secara **hybrid** (offline-first) untuk mengatasi kendala sinyal di lokasi, serta dilengkapi fitur keamanan berbasis lokasi (Geofencing) dan verifikasi data (OCR & Checker).

## 2. Profil Pengguna (Roles)
* **Surveyor:** Petugas lapangan yang menginput data, mengambil foto, dan memvalidasi nominal lewat OCR.
* **Checker:** Operator data yang bertugas menyetujui atau menolak data yang masuk berdasarkan bukti foto.
* **Admin:** Pengelola sistem yang memantau pergerakan tim, melihat statistik total, dan mengekspor data ke Excel.

---

## 3. Fitur Utama

### 3.1. Geofencing & Validasi Lokasi
* Aplikasi hanya mengizinkan input data jika Surveyor berada dalam radius **1 km** dari koordinat pusat pasar.
* Menggunakan Rumus Haversine di sisi klien untuk perhitungan jarak.

### 3.2. Penyimpanan Hybrid (Offline-First)
* Menggunakan **Dexie.js (IndexedDB)** untuk menyimpan data sementara di memori smartphone.
* Sistem sinkronisasi otomatis yang mendeteksi status internet (`navigator.onLine`).
* Data foto dikompresi sebelum disimpan/dikirim untuk menghemat bandwidth.

### 3.3. Optical Character Recognition (OCR)
* Integrasi **Tesseract.js** untuk membaca nominal angka dari foto bukti bayar secara otomatis.
* Fitur *Auto-fill* pada kolom nominal kontribusi berdasarkan hasil pembacaan gambar.

### 3.4. Manajemen Data Mingguan
* Sistem melakukan **backup otomatis** setiap Minggu pukul 23.59.
* Tabel transaksi utama di-reset setiap minggu untuk memulai siklus baru.
* Data historis dipindahkan ke tabel arsip.

---

## 4. Alur Kerja (Workflow)

1.  **Auth:** User login -> Sistem mengarahkan ke Dashboard sesuai Role.
2.  **Survey (Surveyor):**
    * Pilih Pasar -> Cek Radius -> Ambil Foto -> OCR Process -> Input Data -> Simpan ke Local DB.
    * Background Sync mengirim data ke Supabase saat sinyal tersedia.
3.  **Verifikasi (Checker):**
    * Lihat daftar "Pending" -> Bandingkan Foto & Angka -> Klik Approve/Reject.
4.  **Monitoring (Admin):**
    * Melihat Log Aktivitas (siapa, di mana, kapan).
    * Tarik data ke Excel via Power Query.

---

## 5. Skema Database (Supabase / PostgreSQL)

### Tabel: `profiles`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key (Link ke Auth) |
| `role` | Text | 'surveyor', 'checker', 'admin' |

### Tabel: `markets`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `name` | Text | Nama Pasar |
| `lat` | Float | Koordinat Lintang |
| `long` | Float | Koordinat Bujur |

### Tabel: `submissions` (Reset Mingguan)
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `surveyor_id` | UUID | Relasi ke Profiles |
| `market_id` | UUID | Relasi ke Markets |
| `amount` | Decimal | Nominal Kontribusi |
| `photo_url` | Text | Path di Supabase Storage |
| `status` | Text | 'pending', 'approved', 'rejected' |
| `location` | Point | Koordinat saat input |

---

## 6. Persyaratan Non-Fungsional
* **Performance:** Kompresi gambar harus di bawah 500KB sebelum upload.
* **Security:** Implementasi Row Level Security (RLS) di Supabase agar Surveyor tidak bisa melihat data Surveyor lain.
* **Reliability:** Data di IndexedDB tidak boleh dihapus sebelum mendapat konfirmasi sukses (`200 OK`) dari API Supabase.

---

## 7. Roadmap Pengembangan
1.  **Phase 1:** Setup Supabase & Auth (Roles).
2.  **Phase 2:** Pengembangan Form Surveyor & Logika Dexie.js (Offline).
3.  **Phase 3:** Implementasi OCR & Geofencing.
4.  **Phase 4:** Dashboard Checker & Admin.
5.  **Phase 5:** Sistem Otomatisasi Mingguan (Edge Functions).

---

PRD ini berfungsi sebagai panduan utama. Jika ada perubahan alur, pastikan untuk memperbarui dokumen ini di VS Code agar tim tetap sinkron.