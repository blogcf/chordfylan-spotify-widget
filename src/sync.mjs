
import fs from 'node:fs/promises';
import { matchTracks } from './matcher.mjs';

const apiKey = process.env.LASTFM_API_KEY?.trim();
const blogUrl = (process.env.BLOG_URL || 'https://www.chordfylan.com').replace(/\/$/, '');

if (!apiKey) {
  throw new Error('LASTFM_API_KEY belum diisi.');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(25000),
        headers: { 'User-Agent': 'ChordfylanChart/1.0' }
      });
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < retries
    ) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 120000)
        : 1000 * 2 ** attempt;

      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${body.slice(0, 300)}`
      );
    }

    return response;
  }

  throw new Error('Permintaan gagal setelah beberapa percobaan.');
}

async function lastfmTracks() {
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'geo.gettoptracks');
  url.searchParams.set('country', 'Indonesia');
  url.searchParams.set('limit', '50');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');

  const response = await request(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Last.fm error ${data.error}: ${data.message || 'Unknown error'}`
    );
  }

  const entries = data.tracks?.track;

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Last.fm tidak mengembalikan daftar lagu.');
  }

  const tracks = entries.flatMap((track, index) => {
    const title = track.name?.trim();
    const artist = typeof track.artist === 'string'
      ? track.artist
      : track.artist?.name;

    if (!title || !artist) return [];

    return [{
      rank: index + 1,
      title,
      artists: [artist.trim()],
      sourceUrl: /^https:\/\/www\.last\.fm\//.test(track.url || '')
        ? track.url
        : ''
    }];
  });

  if (!tracks.length) {
    throw new Error('Tidak ada lagu valid dari Last.fm.');
  }

  console.log(`Last.fm: ${tracks.length} lagu berhasil dibaca`);
  return tracks;
}

async function bloggerPosts() {
  const posts = [];
  const seen = new Set();
  const size = 150;

  for (let page = 0; page < 1000; page++) {
    const start = page * size + 1;

    const url = new URL(`${blogUrl}/feeds/posts/summary`);
    url.searchParams.set('alt', 'json');
    url.searchParams.set('max-results', String(size));
    url.searchParams.set('start-index', String(start));

    const response = await request(url);
    const data = await response.json();

    const entries = data.feed?.entry || [];

    for (const entry of entries) {
      const link = (entry.link || []).find(
        item => item.rel === 'alternate' &&
          item.type === 'text/html'
      );

      const title = entry.title?.$t;

      if (title && link?.href && !seen.has(link.href)) {
        posts.push({ title, url: link.href });
        seen.add(link.href);
      }
    }

    const total = Number(
      data.feed?.['openSearch$totalResults']?.$t
    );

    console.log(`Blogger: ${posts.length} artikel terbaca`);

    if (
      entries.length < size ||
      (Number.isFinite(total) &&
        total > 0 &&
        start + entries.length - 1 >= total)
    ) {
      return posts;
    }
  }

  throw new Error(
    'Indeks Blogger melewati batas 150.000 artikel.'
  );
}

const tracks = await lastfmTracks();
const posts = await bloggerPosts();

if (!posts.length) {
  throw new Error('Indeks Blogger kosong. JSON lama dipertahankan.');
}

const { matches, ambiguous } = matchTracks(tracks, posts, 10);

const updatedAt = new Date().toISOString();

const result = {
  schemaVersion: 1,
  updatedAt,
  source: 'Last.fm Top Tracks - Indonesia',
  sourceUrl: 'https://www.last.fm',
  country: 'Indonesia',
  candidates: tracks.length,
  indexedPosts: posts.length,
  matchCount: matches.length,
  matches
};

const report = {
  updatedAt,
  source: result.source,
  ambiguous,
  unmatched: tracks
    .filter(track => !matches.some(m => m.rank === track.rank))
    .map(track => ({
      rank: track.rank,
      title: track.title,
      artists: track.artists
    }))
};

await fs.mkdir('docs', { recursive: true });

await fs.writeFile(
  'docs/chart.json',
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);

await fs.writeFile(
  'docs/match-report.json',
  JSON.stringify(report, null, 2) + '\n',
  'utf8'
);

console.log(
  `Selesai: ${tracks.length} lagu, ` +
  `${posts.length} artikel, ` +
  `${matches.length} cocok, ` +
  `${ambiguous.length} ambigu.`
);
