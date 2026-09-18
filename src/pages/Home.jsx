import React, { useState, useEffect } from 'react';

export default function Home() {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) setGreeting("Good morning");
    else if (currentHour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const cards = ["Made for you", "Recently played", "Popular playlists"];

  return (
    <>
      <div className="page-header">
        <h2>{greeting}</h2>
        <p>Pick something to start listening.</p>
      </div>
      <div className="page-grid">
        {cards.map((card, index) => (
          <article key={index} className="page-card">
            <h3>{card}</h3>
            <p>Coming soon</p>
          </article>
        ))}
      </div>
    </>
  );
}
