import fs from 'node:fs/promises';
import { matchTracks } from './matcher.mjs';
const {SPOTIFY_CLIENT_ID:clientId,SPOTIFY_CLIENT_SECRET:clientSecret,SPOTIFY_REFRESH_TOKEN:refreshToken,SPOTIFY_PLAYLIST_ID:playlistId} = process.env;
const blogUrl = (process.env.BLOG_URL || 'https://www.chordfylan.com').replace(/\/$/,'');
for(const [name,value] of Object.entries({SPOTIFY_CLIENT_ID:clientId,SPOTIFY_CLIENT_SECRET:clientSecret,SPOTIFY_REFRESH_TOKEN:refreshToken,SPOTIFY_PLAYLIST_ID:playlistId})) if(!value) throw new Error(`Environment variable ${name} belum diisi.`);
if(!/^[A-Za-z0-9]{10,}$/.test(playlistId)) throw new Error('Playlist ID tidak valid. Gunakan ID, bukan URL penuh.');
async function request(url, options={}, retries=4) {
  for(let i=0;i<=retries;i++) {
    let response;
    try {response=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});} catch(e) {
      if(i===retries) throw e;
      await new Promise(r=>setTimeout(r,1000*2**i)); continue;
    }
    if((response.status===429 || response.status>=500) && i<retries) {
      const after=Number(response.headers.get('retry-after'));
      const delay=Number.isFinite(after)&&after>0?Math.min(after*1000,120000):1000*2**i;
      await new Promise(r=>setTimeout(r,delay)); continue;
    }
    if(!response.ok) throw new Error(`HTTP ${response.status} ${url}: ${(await response.text()).slice(0,350)}`);
    return response;
  }
}
async function accessToken() {
  const response=await request('https://accounts.spotify.com/api/token',{
    method:'POST', headers:{Authorization:'Basic '+Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'refresh_token',refresh_token:refreshToken})
  });
  const data=await response.json();
  if(data.refresh_token && data.refresh_token!==refreshToken) console.warn('Spotify mengembalikan refresh token baru. Perbarui GitHub Secret SPOTIFY_REFRESH_TOKEN untuk mencegah sinkronisasi berikutnya gagal.');
  return data.access_token;
}
async function spotifyTracks(token) {
  const headers={Authorization:`Bearer ${token}`};
  const url=`https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50&offset=0`;
  const data=await (await request(url,{headers})).json();
  if(!Array.isArray(data.items)) throw new Error('Response Spotify tidak memiliki items. Pastikan playlist milik sendiri atau kolaborator.');
  const tracks=[];
  data.items.forEach((entry,i)=>{
    const t=entry.item || entry.track;
    if(!t || t.type!=='track' || !t.name || !Array.isArray(t.artists)) return;
    tracks.push({rank:i+1,title:t.name,artists:t.artists.map(a=>a.name).filter(Boolean),spotifyUrl:t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`});
  });
  if(!tracks.length) throw new Error('Tidak ada lagu yang dapat dibaca dari 50 posisi playlist pertama.');
  return tracks;
}
async function bloggerPosts() {
  const posts=[],seen=new Set(),size=150;
  for(let page=0;page<1000;page++) {
    const start=page*size+1;
    const url=`${blogUrl}/feeds/posts/summary?alt=json&max-results=${size}&start-index=${start}`;
    const data=await (await request(url)).json();
    const entries=data.feed?.entry || [];
    for(const entry of entries) {
      const link=(entry.link||[]).find(x=>x.rel==='alternate'&&x.type==='text/html');
      const title=entry.title?.$t;
      if(title && link?.href && !seen.has(link.href)) {posts.push({title,url:link.href});seen.add(link.href);}
    }
    const total=Number(data.feed?.['openSearch$totalResults']?.$t);
    console.log(`Blogger: ${posts.length} artikel terbaca`);
    if(entries.length<size || (Number.isFinite(total)&&total>0&&start+entries.length-1>=total)) return posts;
  }
  throw new Error('Indeks Blogger melewati 150.000 artikel; proses dihentikan agar tidak mempublikasikan data parsial.');
}
const token=await accessToken();
const tracks=await spotifyTracks(token);
const posts=await bloggerPosts();
if(!posts.length) throw new Error('Indeks Blogger kosong, JSON lama tidak akan ditimpa.');
const {matches,ambiguous}=matchTracks(tracks,posts,10);
const result={schemaVersion:1,updatedAt:new Date().toISOString(),source:'Spotify playlist milik sendiri (bukan chart resmi)',playlistUrl:`https://open.spotify.com/playlist/${playlistId}`,candidates:tracks.length,indexedPosts:posts.length,matchCount:matches.length,matches};
await fs.mkdir('docs',{recursive:true});
await fs.writeFile('docs/chart.json',JSON.stringify(result,null,2)+'\n','utf8');
await fs.writeFile('docs/match-report.json',JSON.stringify({updatedAt:result.updatedAt,ambiguous,unmatched:tracks.filter(t=>!matches.some(m=>m.rank===t.rank)).map(t=>({rank:t.rank,title:t.title,artists:t.artists}))},null,2)+'\n','utf8');
console.log(`Selesai: ${tracks.length} kandidat, ${posts.length} artikel, ${matches.length} cocok, ${ambiguous.length} ambigu.`);
