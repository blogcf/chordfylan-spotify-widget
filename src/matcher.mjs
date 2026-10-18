export function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const junk = /\b(?:chord|chords|kunci gitar|kunci lagu|lirik|lyrics|official|music video|lyric video|audio|visualizer)\b/gi;
const clean = s => String(s ?? '').replace(junk, ' ').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').trim();
const comparable = s => normalize(clean(s));
function variants(title) {
  const raw = String(title ?? '').replace(junk, ' ').trim();
  const result = [];
  for (const separator of [/\s+[-–—]\s+/, /\s+\|\s+/]) {
    const parts = raw.split(separator);
    if (parts.length === 2) {
      result.push({ song: parts[0], artist: parts[1] });
      result.push({ song: parts[1], artist: parts[0] });
    }
  }
  return result;
}
function similarity(a, b) {
  const x = comparable(a), y = comparable(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const xs = new Set(x.split(' ')), ys = new Set(y.split(' '));
  const common = [...xs].filter(w => ys.has(w)).length;
  return 2 * common / (xs.size + ys.size);
}
export function scoreMatch(track, post) {
  const artists = track.artists ?? [];
  let best = 0;
  for (const v of variants(post.title)) {
    const song = similarity(track.title, v.song);
    const artist = Math.max(0, ...artists.map(a => similarity(a, v.artist)));
    if (song >= 0.9 && artist >= 0.85) best = Math.max(best, song * 0.78 + artist * 0.22);
  }
  return best;
}
export function matchTracks(tracks, posts, max = 10) {
  const matches = [], ambiguous = [], used = new Set();
  for (const track of tracks) {
    const options = posts.filter(p => !used.has(p.url)).map(post => ({post, score: scoreMatch(track, post)}))
      .filter(o => o.score >= 0.92).sort((a,b) => b.score - a.score);
    if (options.length > 1 && options[0].score - options[1].score < 0.025) {
      ambiguous.push({rank: track.rank, title: track.title, options: options.slice(0,3).map(x => x.post.title)});
      continue;
    }
    if (!options.length) continue;
    const {post, score} = options[0];
    used.add(post.url);
    matches.push({rank: track.rank, title: track.title, artist: track.artists.join(', '),
      articleTitle: post.title, url: post.url, sourceUrl: track.sourceUrl,
      matchScore: Number(score.toFixed(3)), artistVerification: track.artistVerification});
    if (matches.length >= max) break;
  }
  return {matches, ambiguous};
}
