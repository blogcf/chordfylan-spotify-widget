# Chordfylan Top 10 Artis Indonesia

Mengambil hingga 500 kandidat dari `geo.getTopTracks` Last.fm Indonesia, memeriksa artis menggunakan MusicBrainz, lalu mencocokkan dengan feed Blogger dan menghasilkan `docs/chart.json`.

## Pengaturan GitHub

1. Repository Secret `LASTFM_API_KEY`: API key Last.fm.
2. Repository Variable `MUSICBRAINZ_USER_AGENT`: contoh `ChordfylanChart/2.0 (contact: alamat-email-anda@example.com)`. **Ganti dengan alamat email kontak asli.** Jangan menggunakan contoh apa adanya.
3. GitHub Actions > `Sync Indonesian Artist Chord Chart` > Run workflow.
4. GitHub Pages: deploy branch `main`, folder `/docs`.
5. Tempel isi `widget.html` di gadget HTML/JavaScript Blogger.

## Penggantian file

Ekstrak ZIP lalu salin isinya ke root repository lokal yang sudah ada. Pilih overwrite untuk file yang namanya sama. File `src/auth.mjs` Spotify lama boleh dibiarkan tetapi tidak digunakan lagi. Hapus workflow Spotify lama jika masih ada workflow lain yang memanggil Spotify. Paket ini mengganti `.github/workflows/sync.yml`.

## Pengujian

```powershell
npm test
$env:LASTFM_API_KEY="API_KEY_ASLI"
$env:MUSICBRAINZ_USER_AGENT="ChordfylanChart/2.0 (contact: email-asli@example.com)"
npm run sync
```

Untuk GitHub Actions cukup isi Secret dan Variable; tidak perlu menjalankan sinkronisasi di Windows.

## Catatan verifikasi

MusicBrainz tidak menyediakan atribut kewarganegaraan yang sempurna untuk semua artis. Filter memakai kode negara `ID` pada metadata artis. Jika nama identik memiliki lebih dari satu ID, negara tidak tersedia, atau lookup gagal, artis dikecualikan (fail-closed). `data/artist-country-cache.json` disimpan selama 30 hari untuk mengurangi permintaan. MusicBrainz membatasi request, sehingga skrip membatasi sekitar satu permintaan setiap 1,25 detik. `docs/match-report.json` memuat alasan pengecualian untuk audit. Lagu berbahasa Inggris oleh artis Indonesia tetap diperbolehkan.

Nomor 1–10 di widget adalah urutan **lagu yang cocok**; `rank` di JSON adalah posisi asli Last.fm. Ini bukan chart resmi 10 lagu Indonesia terpopuler di seluruh platform.
