import React from 'react';

const pagesData = {
  library: {
    title: "Your Library",
    description: "Your saved music will appear here.",
    cards: ["Playlists", "Albums", "Artists"]
  },
  Download: {
    title: "Download App",
    description: "Take Play LooP with you wherever you go.",
    cards: ["Mobile app", "Desktop app", "Offline listening"]
  },
  "create-playlist": {
    title: "Create Playlist",
    description: "Build a playlist for every mood.",
    cards: ["New playlist", "Add songs", "Share playlist"]
  },
  "liked-songs": {
    title: "Liked Songs",
    description: "Songs you have saved in one place.",
    cards: ["Your favorites"]
  },
  logout: {
    title: "Logout",
    description: "You are still signed in to this demo.",
    cards: ["Come back soon"]
  },
  settings: {
    title: "Settings",
    description: "Manage your Play LooP preferences.",
    cards: ["Account", "Playback", "Appearance"]
  },
  profile: {
    title: "Profile",
    description: "Your Play LooP profile.",
    cards: ["Profile details", "Listening activity", "Preferences"]
  }
};

export default function PlaceholderPage({ view }) {
  const normalizedKey = Object.keys(pagesData).find(
    (k) => k.toLowerCase() === (view || '').toLowerCase()
  );
  const pageData = pagesData[normalizedKey] || pagesData[view];

  if (!pageData) return null;

  return (
    <>
      <div className="page-header">
        <h2>{pageData.title}</h2>
        <p>{pageData.description}</p>
      </div>
      <div className="page-grid">
        {pageData.cards.map((cardTitle, index) => (
          <article key={index} className="page-card">
            <h3>{cardTitle}</h3>
            <p>Coming soon...</p>
          </article>
        ))}
      </div>
    </>
  );
}
