import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error('Set SPOTIFY_CLIENT_ID dan SPOTIFY_CLIENT_SECRET di terminal terlebih dahulu.');
const redirectUri = 'http://127.0.0.1:8888/callback';
const state = crypto.randomBytes(24).toString('hex');
const authorize = new URL('https://accounts.spotify.com/authorize');
authorize.searchParams.set('client_id', clientId);
authorize.searchParams.set('response_type', 'code');
authorize.searchParams.set('redirect_uri', redirectUri);
authorize.searchParams.set('scope', 'playlist-read-private playlist-read-collaborative');
authorize.searchParams.set('state', state);
authorize.searchParams.set('show_dialog', 'true');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', redirectUri);
  if (url.pathname !== '/callback') { res.writeHead(404).end('Not found'); return; }
  if (url.searchParams.get('state') !== state) { res.writeHead(400).end('State OAuth tidak cocok.'); return; }
  if (url.searchParams.get('error')) { res.writeHead(400).end('Spotify menolak izin.'); server.close(); return; }
  const code = url.searchParams.get('code');
  if (!code) { res.writeHead(400).end('Kode OAuth tidak ada.'); return; }
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: {
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }, body: new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri}), signal:AbortSignal.timeout(20000)
    });
    const data = await response.json();
    if (!response.ok || !data.refresh_token) throw new Error(`Token exchange gagal (${response.status}): ${JSON.stringify(data)}`);
    res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'}).end('Login Spotify berhasil. Kembali ke terminal.');
    console.log('\nSIMPAN REFRESH TOKEN INI DI GITHUB SECRET SPOTIFY_REFRESH_TOKEN:\n' + data.refresh_token + '\n');
  } catch (err) {
    res.writeHead(500).end('OAuth gagal. Periksa terminal.');
    console.error(err.message);
  } finally { server.close(); }
});
server.listen(8888, '127.0.0.1', () => {
  console.log('1. Pastikan redirect URI Spotify app sama persis:', redirectUri);
  console.log('2. Buka URL ini di browser lokal:\n' + authorize.toString());
  console.log('3. Setelah izin diberikan, refresh token tampil di terminal. JANGAN commit token.');
});
