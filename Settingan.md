# Dokumen Pengaturan Aplikasi Survei Pasar KTG

Dokumen ini berisi rangkuman seluruh pengaturan dan kredensial yang dibutuhkan agar aplikasi berjalan dengan lancar, baik di komputer lokal maupun saat online (Vercel).

## 1. Pengaturan Database (Supabase)
Digunakan untuk menyimpan data surveyor, pasar, dan hasil survei secara real-time.

- **Supabase URL**: `https://vnmkkhkznzrdaucrznbo.supabase.co`
- **Anon Key**: `eyJhbGci...[Sudah Terpasang]`

## 2. Pengaturan Google Integration (Rekap Otomatis)
Digunakan untuk mencatat data ke Google Sheets dan mengunggah foto ke Google Drive saat data disetujui oleh Checker.

- **Service Account Email**: `recap-bot@survey-ktg-recap.iam.gserviceaccount.com`
- **Google Sheet ID**: `1-Z-yIsNOcuO3vo3-nzmrPPvxsQHOAQnEuvNfht5eDPA`
- **Google Sheet Link**: [Buka Google Sheet](https://docs.google.com/spreadsheets/d/1-Z-yIsNOcuO3vo3-nzmrPPvxsQHOAQnEuvNfht5eDPA)
- **Google Drive Folder ID**: `1SvTgry30Jy9o0ej_W_T2kk0Sj0tfwF6M`
- **Google Drive Link**: [Buka Folder Drive](https://drive.google.com/drive/u/0/folders/1SvTgry30Jy9o0ej_W_T2kk0Sj0tfwF6M)

> [!IMPORTANT]
> **Izin Akses**: Pastikan Sheet dan Folder Drive sudah di-Share ke email `recap-bot@survey-ktg-recap.iam.gserviceaccount.com` sebagai **Editor**.

## 3. Akun Pengguna (Demo Mode)
Gunakan akun berikut untuk login ke aplikasi:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@demo.com` | `demo123` |
| **Surveyor** | `surveyor@demo.com` | `demo123` |
| **Checker** | `checker@demo.com` | `demo123` |

## 4. Panduan Deployment (Vercel)
Saat melakukan deploy ke Vercel agar bisa digunakan di HP, masukkan variabel berikut di **Project Settings > Environment Variables**:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `GOOGLE_SERVICE_ACCOUNT_EMAIL`
4. `GOOGLE_PRIVATE_KEY` (Isi seluruh kode dari file JSON)
5. `GOOGLE_SHEET_ID`
6. `GOOGLE_DRIVE_FOLDER_ID`

## 5. Fitur Baru: Otomasi & Validasi
Aplikasi sekarang dilengkapi dengan fitur validasi otomatis:
- **Geofence Validation**: Menyimpan status apakah surveyor berada di lokasi pasar saat input.
- **OCR Amount Detection**: Membaca nominal dari foto secara otomatis untuk dibandingkan dengan input surveyor.
- **Auto-Approval**: Checker dapat menyetujui data secara massal jika GPS Valid dan OCR Cocok.

> [!IMPORTANT]
> **Update Database**: Jika Anda sudah memiliki tabel `submissions`, pastikan Anda telah menjalankan perintah `ALTER TABLE` atau menjalankan ulang file `supabase_setup.sql` untuk menambahkan kolom `is_geofence_valid` dan `ocr_amount_detect`.

---
*Dokumen ini diperbarui pada 21 April 2026 dengan fitur Otomasi & Validasi.*
