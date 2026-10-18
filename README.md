# Chordfylan Spotify Playlist Widget

Sinkronisasi harian **playlist Spotify milik sendiri** -> cocokkan 50 posisi pertama dengan seluruh artikel Blogger Chordfylan -> tampilkan maksimal 10 artikel di widget.

> Urutan ini adalah urutan playlist, BUKAN tangga lagu Spotify resmi. Development Mode Spotify ditujukan untuk eksperimen nonkomersial; penggunaan pada situs komersial perlu meninjau izin dan ketentuan Spotify.

## Persyaratan
- Node.js 22 atau 24, GitHub, Spotify Premium (persyaratan Development Mode), dan playlist Spotify yang Anda miliki atau kolaborasikan.
- Spotify Developer App: https://developer.spotify.com/dashboard
- Redirect URI yang didaftarkan persis `http://127.0.0.1:8888/callback` (jangan gunakan `localhost`).

## 1. Buat Spotify App dan OAuth di Windows PowerShell
1. Buat app di Spotify Developer Dashboard. Tambahkan redirect URI `http://127.0.0.1:8888/callback`.
2. Ekstrak ZIP ke folder kerja dan buka di VS Code.
3. Pada terminal PowerShell **hanya di komputer sendiri**, jalankan:

```powershell
$env:SPOTIFY_CLIENT_ID="CLIENT_ID_ANDA"
$env:SPOTIFY_CLIENT_SECRET="CLIENT_SECRET_ANDA"
npm run auth
```

4. Buka tautan login yang tercetak di terminal, berikan izin, lalu salin **refresh token** yang muncul di terminal. Simpan aman. Jangan unggah token ke repository atau chat.
5. Playlist ID adalah segmen setelah `/playlist/` pada URL Spotify. Pastikan playlist benar-benar milik Anda/Anda kolaborator dan urutannya sesuai yang ingin ditampilkan.

## 2. Buat repository GitHub
1. Buat repository baru, misalnya `chordfylan-spotify-widget`.
2. Upload seluruh isi folder proyek termasuk `.github/workflows/sync.yml` (jangan upload `.env`).
3. Di **Settings > Secrets and variables > Actions > Secrets**, tambahkan:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`
4. Di **Settings > Secrets and variables > Actions > Variables**, tambahkan `SPOTIFY_PLAYLIST_ID`.
5. Di **Settings > Actions > General > Workflow permissions**, pilih **Read and write permissions** bila kebijakan repo mengizinkan. Jika organisasi melarang, gunakan token terbatas dengan izin Contents write sesuai kebijakan.
6. Jalankan **Actions > Sync Spotify Chordfylan > Run workflow**. Periksa log dan file `docs/chart.json` serta `docs/match-report.json`.
7. Aktifkan **Settings > Pages > Deploy from a branch > main > /docs**. Gunakan repository public bila ingin GitHub Pages publik gratis sesuai ketersediaan akun.
8. URL JSON umumnya `https://NAMA_AKUN.github.io/chordfylan-spotify-widget/chart.json`. Pastikan URL bisa dibuka di browser dan CORS tersedia.

## 3. Pasang Blogger
1. Buka `widget.html` dan ganti `GANTI_DENGAN_URL_GITHUB_PAGES/chart.json` dengan URL JSON Pages tadi.
2. Blogger > Tata Letak > Tambahkan Gadget > HTML/JavaScript.
3. Tempel seluruh isi `widget.html`, simpan, dan buka halaman blog.

## 4. Pembaruan
GitHub Actions dijadwalkan **06:15 WIB setiap hari** (`23:15 UTC` hari sebelumnya). Jadwal GitHub Actions bersifat best-effort dan bisa terlambat. Anda juga bisa menjalankan `workflow_dispatch` secara manual.

Jika Spotify mengembalikan refresh token baru, perbarui secret `SPOTIFY_REFRESH_TOKEN`. Jika OAuth dicabut, jalankan `npm run auth` ulang.

## 5. Pencocokan
- Feed Blogger diambil bertahap (150 artikel per halaman), tidak berhenti di 150 artikel.
- Cocokkan judul + artis, tidak cukup judul saja. Format artikel terbaik: `Artis - Judul Lagu`.
- Match ambigu ditolak, sehingga hasil bisa kurang dari 10.
- Posisi yang ditampilkan adalah posisi asli di playlist, bukan nomor urut hasil yang cocok.
- `docs/match-report.json` mencatat lagu yang tidak cocok atau ambigu untuk perbaikan.

## 6. Keamanan dan keterbatasan
- Jangan memasukkan Client Secret/Refresh Token ke `widget.html`, `docs/`, atau repository publik.
- `docs/chart.json` adalah data publik berisi metadata terbatas dan tautan, bukan file audio.
- Spotify dapat mengubah API/ketentuan. Endpoint `/v1/playlists/{id}/items` dapat menolak playlist bukan milik Anda dengan HTTP 403.
- Jika feed Blogger ditolak, workflow gagal dan JSON terakhir tetap tersedia. Tidak ada jaminan layanan tanpa pengujian langsung pada akun.
- Matching belum menangani seluruh variasi penulisan judul (misalnya judul artis kolaborasi yang tidak mengikuti pola).
- Jika repo berada pada default branch selain `main`, sesuaikan pengaturan GitHub Pages.

## Pengujian lokal
```powershell
$env:SPOTIFY_CLIENT_ID="..."
$env:SPOTIFY_CLIENT_SECRET="..."
$env:SPOTIFY_REFRESH_TOKEN="..."
$env:SPOTIFY_PLAYLIST_ID="..."
npm test
npm run sync
```

Periksa `docs/chart.json`. Jangan pernah commit token rahasia.
