import React from 'react';
import { pagesData } from '../constants/pagesData.js';

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
