
const stripped = /\b(chord|chords|kunci gitar|kunci lagu|lirik|lyrics|official|music video|lyric video|audio|visualizer)\b/gi;

export function norm(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(feat\.?|ft\.?|featuring)\b/gi, ' ')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(stripped, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function titleVariants(title) {
  const clean = String(title || '').replace(stripped, ' ').trim();
  const candidates = [{ artist: '', song: clean }];

  for (const sep of [/\s+[-–—]\s+/, /\s+\|\s+/]) {
    const parts = clean.split(sep);

    if (parts.length === 2) {
      candidates.push({ artist: parts[0], song: parts[1] });
      candidates.push({ artist: parts[1], song: parts[0] });
    }
  }

  return candidates;
}

function wordSimilarity(a, b) {
  const x = new Set(norm(a).split(' ').filter(Boolean));
  const y = new Set(norm(b).split(' ').filter(Boolean));

  if (!x.size || !y.size) return 0;
  if (norm(a) === norm(b)) return 1;

  const overlap = [...x].filter(t => y.has(t)).length;
  return 2 * overlap / (x.size + y.size);
}

function artistSimilarity(artists, articleArtist) {
  const target = norm(articleArtist);
  if (!target) return 0;

  const names = artists
    .flatMap(a => String(a).split(
      /\s+(?:feat\.?|ft\.?|featuring|&|and|x)\s+|\s*,\s*/i
    ))
    .map(norm)
    .filter(Boolean);

  return Math.max(
    0,
    ...names.map(name =>
      name === target ? 1 : wordSimilarity(name, target)
    )
  );
}

export function scoreMatch(track, post) {
  let best = 0;

  for (const variant of titleVariants(post.title)) {
    if (!variant.artist) continue;

    const song = wordSimilarity(track.title, variant.song);
    const artist = artistSimilarity(track.artists, variant.artist);

    if (song < 0.90 || artist < 0.80) continue;

    best = Math.max(best, 0.78 * song + 0.22 * artist);
  }

  return best;
}

export function matchTracks(tracks, posts, max = 10) {
  const used = new Set();
  const matches = [];
  const ambiguous = [];

  for (const track of tracks) {
    const candidates = [];

    for (const post of posts) {
      if (used.has(post.url)) continue;

      const score = scoreMatch(track, post);

      if (score >= 0.92) {
        candidates.push({ post, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    if (
      candidates.length > 1 &&
      candidates[0].score - candidates[1].score < 0.025
    ) {
      ambiguous.push({
        rank: track.rank,
        track: track.title,
        candidates: candidates.slice(0, 3)
          .map(c => c.post.title)
      });
      continue;
    }

    if (!candidates.length) continue;

    const { post, score } = candidates[0];

    used.add(post.url);

    matches.push({
      rank: track.rank,
      title: track.title,
      artist: track.artists.join(', '),
      articleTitle: post.title,
      url: post.url,
      sourceUrl: track.sourceUrl || '',
      matchScore: Number(score.toFixed(3))
    });

    if (matches.length >= max) break;
  }

  return { matches, ambiguous };
}
