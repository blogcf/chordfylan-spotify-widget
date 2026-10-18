import test from 'node:test';
import assert from 'node:assert/strict';
import {matchTracks, scoreMatch, normalize} from '../src/matcher.mjs';
test('Indonesian artist English song title matches', () => {
  const tracks = [{rank:1,title:'Anything You Want',artists:['Reality Club'],sourceUrl:''}];
  const posts = [{title:'Chord Anything You Want - Reality Club',url:'https://www.chordfylan.com/test'}];
  assert.equal(matchTracks(tracks,posts).matches.length,1);
});
test('Different artist rejected', () => {
  assert.equal(scoreMatch({title:'Creep',artists:['Radiohead']},{title:'Creep - Tulus'}),0);
});
test('Title reversal works', () => {
  assert.ok(scoreMatch({title:'Teh Hijau',artists:['Tulus']},{title:'Tulus - Teh Hijau'}) >= 0.92);
});
test('normalize removes punctuation',()=>assert.equal(normalize('Everything U Are!'),'everything u are'));
