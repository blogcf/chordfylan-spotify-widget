import fs from 'node:fs/promises';
import { matchTracks, normalize } from './matcher.mjs';

const apiKey = process.env.LASTFM_API_KEY?.trim();
if (!apiKey) throw Error('LASTFM_API_KEY belum tersedia di GitHub Secrets atau environment.');
const blogUrl = (process.env.BLOG_URL || 'https://www.chordfylan.com').replace(/\/$/, '');
const agent = process.env.MUSICBRAINZ_USER_AGENT?.trim();
if (!agent || !/\S+@\S+/.test(agent)) throw Error('MUSICBRAINZ_USER_AGENT wajib berisi nama aplikasi dan email kontak valid.');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cachePath = 'data/artist-country-cache.json';

async function request(url, headers = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let response;
    try {
      response = await fetch(url, {headers, signal: AbortSignal.timeout(25000)});
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1500 * 2 ** attempt); continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 60000) : 1500 * 2 ** attempt);
      continue;
    }
    if (!response.ok) throw Error(`HTTP ${response.status} ${new URL(url).origin}: ${(await response.text()).slice(0, 250)}`);
    return response.json();
  }
  throw Error('HTTP request retries exhausted');
}

async function lastfmTracks() {
  const tracks = [], seen = new Set();
  for (let page = 1; page <= 10; page++) {
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    for (const [k,v] of Object.entries({method:'geo.gettoptracks', country:'Indonesia', limit:'50', page:String(page), api_key:apiKey, format:'json'})) url.searchParams.set(k,v);
    const data = await request(url);
    if (data.error) throw Error(`Last.fm ${data.error}: ${data.message}`);
    const entries = data.tracks?.track ?? [];
    if (!Array.isArray(entries) || !entries.length) break;
    for (const entry of entries) {
      const title = entry.name?.trim();
      const artist = (typeof entry.artist === 'string' ? entry.artist : entry.artist?.name)?.trim();
      if (!title || !artist) continue;
      const key = `${normalize(title)}|${normalize(artist)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push({rank: (page - 1) * 50 + entries.indexOf(entry) + 1, title, artists:[artist],
        sourceUrl: /^https:\/\/www\.last\.fm\//.test(entry.url ?? '') ? entry.url : ''});
    }
    if (entries.length < 50) break;
    await sleep(250);
  }
  if (!tracks.length) throw Error('Last.fm tidak mengembalikan kandidat lagu.');
  return tracks;
}

async function bloggerPosts() {
  const posts = [], seen = new Set();
  for (let start = 1; start <= 150001; start += 150) {
    const url = new URL(`${blogUrl}/feeds/posts/summary`);
    for (const [k,v] of Object.entries({alt:'json', 'max-results':'150', 'start-index':String(start)})) url.searchParams.set(k,v);
    const data = await request(url);
    const entries = data.feed?.entry ?? [];
    for (const entry of entries) {
      const link = entry.link?.find(x => x.rel === 'alternate' && x.type === 'text/html')?.href;
      if (entry.title?.$t && link && !seen.has(link)) {posts.push({title:entry.title.$t, url:link});seen.add(link);}
    }
    const total = Number(data.feed?.['openSearch$totalResults']?.$t);
    if (entries.length < 150 || (Number.isFinite(total) && total > 0 && start + entries.length - 1 >= total)) return posts;
  }
  throw Error('Jumlah artikel melebihi batas pagination.');
}

let lastMbRequest = 0;
async function musicbrainzSearch(artist) {
  // One request per >=1.2 seconds, including requests that fail.
  const wait = Math.max(0, 1250 - (Date.now() - lastMbRequest));
  await sleep(wait);
  lastMbRequest = Date.now();
  const url = new URL('https://musicbrainz.org/ws/2/artist/');
  url.searchParams.set('query', `artist:"${artist.replaceAll('"','')}"`);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', '10');
  const data = await request(url, {'User-Agent':agent, 'Accept':'application/json'});
  const exact = (data.artists ?? []).filter(x => normalize(x.name) === normalize(artist));
  // Fail closed if the name maps to multiple different MusicBrainz artist IDs.
  if (exact.length !== 1) return {status:'unverified', reason: exact.length ? 'ambiguous_name' : 'artist_not_found'};
  const a = exact[0];
  // Country is more meaningful than current residence (area). Prefer begin-area for origin.
  // If begin-area and country conflict, do not classify automatically.
  const beginCountry = a['begin-area']?.['iso-3166-1-codes']?.[0];
  const country = a.country || a.area?.['iso-3166-1-codes']?.[0];
  if (beginCountry && country && beginCountry !== country) return {status:'unverified', reason:'conflicting_origin', mbid:a.id};
  if (!country) return {status:'unverified', reason:'country_missing', mbid:a.id};
  return {status: country === 'ID' ? 'indonesian' : 'foreign', country, mbid:a.id,
    verificationUrl:`https://musicbrainz.org/artist/${a.id}`};
}

async function loadCache() {
  try {return JSON.parse(await fs.readFile(cachePath, 'utf8'));}
  catch (e) {if (e.code === 'ENOENT') return {}; throw e;}
}

const tracks = await lastfmTracks();
console.log(`Last.fm: ${tracks.length} kandidat`);
const posts = await bloggerPosts();
if (!posts.length) throw Error('Artikel Blogger kosong, tidak akan menimpa chart sebelumnya.');
console.log(`Blogger: ${posts.length} artikel`);

const cache = await loadCache();
const now = Date.now();
const maxAge = 30 * 86400000;
const artistNames = [...new Set(tracks.map(t => t.artists[0]))];
const checks = {};
for (const [index, artist] of artistNames.entries()) {
  const key = normalize(artist);
  const saved = cache[key];
  if (saved && saved.name === artist && now - Date.parse(saved.checkedAt) < maxAge) {
    checks[key] = saved.result;
    continue;
  }
  try {
    const result = await musicbrainzSearch(artist);
    checks[key] = result;
    cache[key] = {name:artist, checkedAt:new Date().toISOString(), result};
  } catch (e) {
    // Fail closed: do not use expired country information after a lookup failure.
    checks[key] = {status:'unverified', reason:`lookup_failed: ${e.message}`};
    console.warn(`MusicBrainz gagal untuk ${artist}: ${e.message}`);
  }
  if ((index + 1) % 25 === 0) console.log(`Verifikasi artis: ${index + 1}/${artistNames.length}`);
}
const verified = tracks.flatMap(t => {
  const result = checks[normalize(t.artists[0])];
  return result?.status === 'indonesian' ? [{...t, artistVerification:{provider:'MusicBrainz', mbid:result.mbid, url:result.verificationUrl}}] : [];
});
const {matches, ambiguous} = matchTracks(verified, posts, 10);
const report = {
  updatedAt:new Date().toISOString(), candidates:tracks.length, verifiedIndonesianTracks:verified.length,
  artistChecks:artistNames.map(name => ({name, ...checks[normalize(name)]})), ambiguous,
  unmatchedIndonesianTracks:verified.filter(t => !matches.some(m => m.rank === t.rank)).map(t => ({rank:t.rank, title:t.title, artist:t.artists[0]}))
};
const chart = {schemaVersion:2, updatedAt:report.updatedAt, source:'Last.fm Indonesia + MusicBrainz artist origin',
  sourceUrl:'https://www.last.fm', country:'Indonesia', candidates:tracks.length, indexedPosts:posts.length,
  verifiedIndonesianTracks:verified.length, matchCount:matches.length, matches};
await fs.mkdir('docs', {recursive:true});
await fs.mkdir('data', {recursive:true});
await fs.writeFile('docs/chart.json', JSON.stringify(chart,null,2)+'\n');
await fs.writeFile('docs/match-report.json', JSON.stringify(report,null,2)+'\n');
await fs.writeFile(cachePath, JSON.stringify(cache,null,2)+'\n');
console.log(`Selesai: ${verified.length} lagu artis Indonesia, ${matches.length} chord cocok.`);
