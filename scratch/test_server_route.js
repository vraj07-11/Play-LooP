const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

async function testRoute() {
  try {
    const res = await fetch('http://localhost:3000/api/search?q=arijit&multi=true');
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Returned songs count:", data.songs ? data.songs.length : 0);
    const scSongs = (data.songs || []).filter(s => s.tag === 'SoundCloud' || s.source === 'soundcloud');
    console.log("SoundCloud songs in search result:", scSongs.length);
    if (scSongs.length > 0) {
      console.log("First SoundCloud song:", scSongs[0]);
    }
  } catch (e) {
    console.error("Test route error:", e.message);
  }
}

testRoute();
