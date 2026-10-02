const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

async function testRelevance() {
  const query = "Khamoshiyan slowed reverb";
  const res = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(query)}&multi=true`);
  const data = await res.json();
  
  console.log("Query:", query);
  console.log("Top Result:", data.topResult ? {
    title: data.topResult.title,
    artist: data.topResult.artist,
    tag: data.topResult.tag || "JioSaavn"
  } : null);

  console.log("\nTop 5 Songs:");
  (data.songs || []).slice(0, 5).forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.tag || 'JioSaavn'}] ${s.title} (${s.artist})`);
  });
}

testRelevance();
