const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({
  margin: 50,
  size: 'A4',
  bufferPages: true
});

const outputPath = path.join(__dirname, 'Recommendation_System_Architecture_Guide.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// --- Theme Colors ---
const PRIMARY = '#1DB954';      // Spotify Green accent
const DARK_BG = '#121212';      // Dark theme accent
const TEXT_DARK = '#191414';    // Primary dark text
const TEXT_MUTED = '#535353';   // Subtitle / muted text
const BOX_BG = '#F4F6F8';       // Code / callout box background
const ACCENT_BLUE = '#0066CC';  // Blue highlight
const ACCENT_RED = '#D32F2F';   // Warning / Fallback accent

// --- Helper Functions ---
function addHeader(title, subtitle) {
  doc.fillColor(DARK_BG).rect(0, 0, doc.page.width, 100).fill();
  
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(22)
     .text(title, 50, 30, { align: 'left' });
     
  doc.fillColor(PRIMARY)
     .font('Helvetica')
     .fontSize(12)
     .text(subtitle, 50, 62, { align: 'left' });

  doc.y = 120;
}

function addSectionTitle(title) {
  if (doc.y > 660) doc.addPage();
  
  doc.moveDown(0.8);
  const startY = doc.y;
  
  doc.fillColor(PRIMARY).rect(50, startY, 4, 20).fill();
  
  doc.fillColor(TEXT_DARK)
     .font('Helvetica-Bold')
     .fontSize(15)
     .text(title, 62, startY + 1);
     
  doc.moveDown(0.8);
}

function addSubSectionTitle(title) {
  if (doc.y > 690) doc.addPage();
  
  doc.moveDown(0.5);
  doc.fillColor(TEXT_DARK)
     .font('Helvetica-Bold')
     .fontSize(12)
     .text(title, 50, doc.y);
  doc.moveDown(0.3);
}

function addParagraph(text) {
  if (doc.y > 710) doc.addPage();
  doc.fillColor(TEXT_DARK)
     .font('Helvetica')
     .fontSize(10)
     .lineGap(3)
     .text(text, 50, doc.y, { align: 'justify', width: doc.page.width - 100 });
  doc.moveDown(0.5);
}

function addBulletPoint(label, text) {
  if (doc.y > 710) doc.addPage();
  const y = doc.y;
  doc.fillColor(PRIMARY).circle(55, y + 5, 3).fill();
  
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(10).text(`${label}: `, 65, y, { continued: true });
  doc.font('Helvetica').fillColor(TEXT_DARK).text(text, { width: doc.page.width - 115, align: 'justify' });
  doc.moveDown(0.4);
}

function addCalloutBox(title, text, type = 'info') {
  if (doc.y > 660) doc.addPage();
  const startY = doc.y;
  const width = doc.page.width - 100;
  
  doc.font('Helvetica').fontSize(9.5);
  const textHeight = doc.heightOfString(text, { width: width - 30 });
  const boxHeight = textHeight + 32;

  const borderColor = type === 'warning' ? ACCENT_RED : PRIMARY;
  const bgColor = type === 'warning' ? '#FDF2F2' : '#F4F9F5';

  doc.fillColor(bgColor).rect(50, startY, width, boxHeight).fill();
  doc.fillColor(borderColor).rect(50, startY, 4, boxHeight).fill();

  doc.fillColor(borderColor).font('Helvetica-Bold').fontSize(10.5).text(title, 65, startY + 8);
  doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9.5).text(text, 65, startY + 24, { width: width - 30 });

  doc.y = startY + boxHeight + 10;
}

function addFormulaBox(title, formulaStr, explanation) {
  if (doc.y > 660) doc.addPage();
  const startY = doc.y;
  const width = doc.page.width - 100;

  doc.fillColor('#1E1E1E').rect(50, startY, width, 75).fill();
  doc.fillColor(PRIMARY).rect(50, startY, 4, 75).fill();

  doc.fillColor('#A9DC76').font('Helvetica-Bold').fontSize(10).text(title, 65, startY + 8);
  doc.fillColor('#FCFCFA').font('Courier-Bold').fontSize(11).text(formulaStr, 65, startY + 26);
  doc.fillColor('#C1C1C1').font('Helvetica-Oblique').fontSize(9).text(explanation, 65, startY + 48, { width: width - 30 });

  doc.y = startY + 85;
}

// --- Document Generation ---

// Title Page / Header
addHeader("LooP Music - Recommendation Engine Specification", "Architecture, Infinite Playlist Generation, Scoring Algorithms & Resilient Fallback Protocols");

// 1. Introduction & Overview
addSectionTitle("1. System Overview & Core Objectives");
addParagraph(
  "The LooP recommendation engine is a hybrid, client-server music recommendation system engineered to deliver context-aware, zero-latency continuous playback. By combining backend multi-provider candidate retrieval with real-time client-side scoring, deduplication, infinite playlist extension, and pre-buffering, LooP guarantees uninterrupted audio listening tailored to user tastes and listening history."
);

addBulletPoint("Continuous & Infinite Playback", "Dynamically extends queues when playlists complete, ensuring non-stop audio stream continuity.");
addBulletPoint("Multi-Tier Candidate Sourcing", "Leverages YouTube Music Up-Next resolution alongside JioSaavn direct API endpoints.");
addBulletPoint("Client-Side Heuristic Scoring", "Applies dynamic scoring weights (+15 liked bonus, +10 artist match, -100 anti-repetition penalty, +0-25 jitter).");
addBulletPoint("Sub-Second Pre-buffering", "Pre-loads high-ranking candidate audio streams before track conclusion to eliminate audible buffering pauses.");

// 2. End-to-End Architectural Pipeline
addSectionTitle("2. End-to-End Architectural Pipeline");
addParagraph(
  "The recommendation lifecycle flows seamlessly across five major layers: Candidate Retrieval, 24-Hour Backend Caching, Client Candidate Scoring, Infinite Playlist Queue Extension, and Audio Pre-buffering."
);

addCalloutBox(
  "Architecture Flow Pipeline",
  "1. Active Track Seed -> 2. Server Cache Check (24h TTL) -> 3. Multi-Tier Backend Retrieval (YTMusic / JioSaavn) -> 4. Dynamic Candidate Scoring & Filtering -> 5. Infinite Playlist & Radio Queue Transition -> 6. Zero-Latency Pre-Buffer"
);

// 3. Backend Retrieval Pipeline (server.js)
addSectionTitle("3. Backend Multi-Tier Retrieval Pipeline (`server.js`)");
addParagraph(
  "The Express server acts as the primary candidate generator via the `/api/recommendations` endpoint. It employs a 3-tiered fallback resolution hierarchy with persistent 24-hour in-memory caching to optimize API response times and protect external rate limits."
);

addSubSectionTitle("3.1 24-Hour TTL Server Cache (`recoCache`)");
addBulletPoint("Cache Keying", "Mapped strictly by `videoId` or normalized `artist_title` strings.");
addBulletPoint("TTL Expiration", "Entries expire automatically after 86,400,000 ms (24 hours). Valid cache hits bypass all external API fetches instantly.");

addSubSectionTitle("3.2 Tier 1: YouTube Music Up-Next Resolution");
addParagraph(
  "When a YouTube Music `videoId` is present, the server executes `ytmusic.getUpNext(videoId)`. Candidate tracks are cross-resolved to streamable JioSaavn entities via fuzzy title and artist string matching."
);

addSubSectionTitle("3.3 Tier 2: JioSaavn Direct PID Recommendations (`reco.getreco`)");
addParagraph(
  "If Tier 1 fails, returns fewer than 3 candidates, or if no `videoId` exists, the server queries JioSaavn's `reco.getreco?pid=<trackId>` endpoint. This returns algorithmically paired tracks native to the Saavn database."
);

addSubSectionTitle("3.4 Tier 3: JioSaavn Primary Artist & Title Search Fallback");
addParagraph(
  "If Tier 2 yields zero results or encounters API errors, the system triggers `search.getResults` using the primary artist's name and track title keywords. This guarantees candidate discovery even for niche or unindexed tracks."
);

// 4. Client-Side Scoring & Dynamic Ranking (recommendationEngine.js)
addSectionTitle("4. Client-Side Scoring & Ranking Engine (`recommendationEngine.js`)");
addParagraph(
  "Once candidate tracks are delivered to the client, `src/services/recommendationEngine.js` normalizes metadata, removes duplicates, and computes exact relevance scores for candidate selection."
);

addSubSectionTitle("4.1 String Normalization (`cleanString`)");
addParagraph(
  "To eliminate duplicates and false non-matches, titles and artist strings are normalized: text within parentheses/brackets (e.g., '(Official Video)', '[Remix]') is stripped, special characters are removed, and strings are converted to lowercase."
);

addSubSectionTitle("4.2 Algorithmic Scoring Weight Formula");
addFormulaBox(
  "Client Scoring Function",
  "Score = S_artist (+10) + S_liked (+15) - P_repetition (-100) + J_jitter (0..25)",
  "S_artist: Artist match | S_liked: User liked song | P_repetition: Played/queued penalty | J_jitter: Random exploration variance"
);

addBulletPoint("Artist Similarity Bonus (+10)", "Awarded if any candidate artist matches the current track's primary or secondary artists.");
addBulletPoint("User Taste Match (+15)", "Awarded if the candidate track already exists in the user's `likedSongs` local/cloud library.");
addBulletPoint("Anti-Repetition Penalty (-100)", "Heavy penalty enforced if the candidate exists in `playedHistory` or active queue to prevent loop redundancy.");
addBulletPoint("Dynamic Exploration Jitter (0 to +25)", "Random variance injected into every candidate score to introduce fresh discovery and prevent deterministic queue loops.");

addSubSectionTitle("4.3 Strict Filtering vs. Fallback Thresholds");
addParagraph(
  "Candidates are filtered using a strict score threshold (`Score > -50`). If aggressive penalties cause all candidates to fall below -50, the engine gracefully falls back to relaxing the threshold, sorting all non-duplicate candidates by raw score and returning the top picks."
);

// 5. Infinite Playlist & Continuous Radio Recommendations
addSectionTitle("5. Infinite Playlist & Continuous Radio Engine (`PlayerContext.jsx`)");
addParagraph(
  "LooP features a continuous audio stream model. Whether a user starts listening to a single song or an explicit playlist (album/custom playlist), the playback queue never halts when the initial queue ends."
);

addSubSectionTitle("5.1 Dynamic Seed Propagation");
addParagraph(
  "Every time a track begins playback in `selectAndPlayTrack`, a asynchronous task fires (`fetchApi('/api/recommendations')`). The active track serves as the seed, continuously fetching and scoring a 10-track recommendation buffer for `recommendationQueue`."
);

addSubSectionTitle("5.2 Seamless Playlist-to-Recommendation Hand-off");
addParagraph(
  "When playing an explicit playlist (`trackQueue`), `playNextTrack` navigates deterministically through the playlist array. However, when the playlist reaches its final track, `PlayerContext.jsx` seamlessly transitions to `recommendationQueueRef.current` rather than stopping audio playback."
);

addSubSectionTitle("5.3 Anti-Looping Infinite Reseeding");
addParagraph(
  "To prevent infinite recommendation loops when listening continuously for hours, the engine filters out tracks present in `trackHistory` (using normalized `cleanTitle` comparison). The newly selected recommendation then becomes the seed for the next round of background retrieval, continuously evolving the playlist flavor organically."
);

// 6. Multi-Tiered Fallback Matrix & Error Handling
addSectionTitle("6. Multi-Tiered Fallback Matrix & Error Handling");
addParagraph(
  "The system is designed with zero-single-point-of-failure resilience. The matrix below outlines how failures at every level are mitigated without interrupting audio playback:"
);

// Fallback Table
const tableTop = doc.y + 5;
const colWidths = [120, 180, 195];

doc.fillColor(DARK_BG).rect(50, tableTop, 495, 20).fill();
doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
doc.text("Failure Scenario", 55, tableTop + 5);
doc.text("Root Cause / Trigger", 180, tableTop + 5);
doc.text("Automated Recovery / Fallback Protocol", 360, tableTop + 5);

const rows = [
  [
    "YTMusic API Rate-Limit / Down",
    "YTMusic Up-Next endpoint 429 / 5xx response",
    "Instant failover to Tier 2: JioSaavn `reco.getreco` PID lookup."
  ],
  [
    "Missing / Unindexed Track ID",
    "`reco.getreco` returns empty array or null",
    "Instant failover to Tier 3: JioSaavn artist/title primary search."
  ],
  [
    "Playlist Queue Exhaustion",
    "Last track of explicit playlist finishes playing",
    "Seamless transition to `recommendationQueue` generated from seed."
  ],
  [
    "Network Disconnection / Offline",
    "Fetch API network timeout or client offline",
    "Fallback to local `likedSongs` & previously played context tracks."
  ],
  [
    "Over-Penalized Candidates",
    "All candidates scored < -50 due to recent repeats",
    "Relax score threshold; select highest raw score candidate non-duplicate."
  ],
  [
    "Audio Pre-buffer Stream Error",
    "Candidate audio URL expired or 403 Forbidden",
    "Player Context catches media error and instantly jumps to next candidate."
  ]
];

let currentY = tableTop + 20;
rows.forEach((row, i) => {
  const bg = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
  
  doc.font('Helvetica').fontSize(8.5);
  const h0 = doc.heightOfString(row[0], { width: colWidths[0] - 10 });
  const h1 = doc.heightOfString(row[1], { width: colWidths[1] - 10 });
  const h2 = doc.heightOfString(row[2], { width: colWidths[2] - 10 });
  const rowHeight = Math.max(h0, h1, h2) + 12;

  if (currentY + rowHeight > 730) {
    doc.addPage();
    currentY = 50;
  }

  doc.fillColor(bg).rect(50, currentY, 495, rowHeight).fill();
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').text(row[0], 55, currentY + 6, { width: colWidths[0] - 10 });
  doc.font('Helvetica').text(row[1], 180, currentY + 6, { width: colWidths[1] - 10 });
  doc.text(row[2], 360, currentY + 6, { width: colWidths[2] - 10 });

  doc.fillColor('#E5E7EB').rect(50, currentY + rowHeight - 1, 495, 1).fill();
  currentY += rowHeight;
});

doc.y = currentY + 15;

// 7. Zero-Latency Pre-Buffering Strategy
addSectionTitle("7. Zero-Latency Buffer Management (`PlayerContext.jsx`)");
addParagraph(
  "To provide an uninterrupted listening experience, `PlayerContext.jsx` maintains a secondary hidden HTML5 Audio instance (`upcomingAudioPlayer`). When the active track reaches 85% completion or 15 seconds remaining, the top-ranked recommendation is fetched, resolved, and pre-buffered into memory. Upon track completion, audio source swapping occurs instantaneously in 0ms."
);

// Footer Page Numbers
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.fillColor(TEXT_MUTED)
     .font('Helvetica')
     .fontSize(8)
     .text(
       `LooP Recommendation System Technical Architecture Guide | Page ${i + 1} of ${pages.count}`,
       50,
       doc.page.height - 35,
       { align: 'center', width: doc.page.width - 100 }
     );
}

doc.end();

stream.on('finish', () => {
  console.log(`PDF successfully updated at: ${outputPath}`);
});
