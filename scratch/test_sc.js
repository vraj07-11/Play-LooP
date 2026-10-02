const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

async function testSC() {
  try {
    const htmlRes = await fetch('https://soundcloud.com', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const html = await htmlRes.text();
    
    const matches = [...html.matchAll(/<script [^>]*src="([^"]+)"/g)].map(m => m[1]);

    let clientId = null;
    for (const url of matches) {
      if (!url.startsWith('http')) continue;
      const jsText = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
      const match = jsText.match(/client_id["']?[:=]["']?([a-zA-Z0-9]{32})/);
      if (match) {
        clientId = match[1];
        break;
      }
    }
    console.log("Found Active Client ID:", clientId);

    if (clientId) {
      const searchRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=arijit&client_id=${clientId}&limit=5`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const searchData = await searchRes.json();
      console.log("Search HTTP status:", searchRes.status);
      console.log("Found tracks count:", searchData.collection ? searchData.collection.length : 0);
      
      if (searchData.collection && searchData.collection.length > 0) {
        const formattedSongs = searchData.collection.map(track => ({
          videoId: `sc:${track.id}`,
          title: track.title,
          artist: track.user?.username || "SoundCloud Artist",
          thumbnail: track.artwork_url || track.user?.avatar_url || "/logo.svg",
          duration: Math.round((track.duration || 0) / 1000),
          source: "soundcloud",
          provider: "SoundCloud",
          tag: "SoundCloud"
        }));
        console.log("Formatted SoundCloud Songs:", formattedSongs);
      }
    }
  } catch (err) {
    console.error("Test SC Error:", err);
  }
}

testSC();
