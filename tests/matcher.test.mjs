import test from 'node:test';
import assert from 'node:assert/strict';
import {matchTracks} from '../src/matcher.mjs';
const tracks=[{rank:1,title:'Hati-Hati di Jalan',artists:['Tulus'],spotifyUrl:'https://open.spotify.com/track/example'},{rank:2,title:'Monokrom',artists:['Tulus'],spotifyUrl:'https://open.spotify.com/track/example2'}];
const posts=[{title:'Tulus - Hati Hati Di Jalan Chord',url:'https://www.chordfylan.com/a'},{title:'Artis Lain - Monokrom',url:'https://www.chordfylan.com/b'}];
test('hanya artis dan lagu cocok, ranking asli terjaga',()=>{
 const r=matchTracks(tracks,posts);assert.equal(r.matches.length,1);assert.equal(r.matches[0].rank,1);
});
