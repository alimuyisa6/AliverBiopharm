// features/home/BlogGrid.jsx
import React from 'react';

export function BlogGrid({ posts }) {
  return (
    <section id="blog" className="section alt-bg reveal">
      <span className="sec-label">Insights</span>
      <h2 className="section-title">From the World of Science & Pharmacy</h2>
      <p className="section-subtitle">
        The latest developments in Biology, Pharmacy, and Life Sciences from our expert contributors.
      </p>
      <div className="grid-3">
        {(posts || []).filter(Boolean).map(post => (
          <article key={post.title} className="card">
            {post.image_url && <img src={post.image_url} alt={post.title} />}
            <div className="blog-meta">
              <span><i className="fa-regular fa-calendar"></i> {post.date}</span>
              <span><i className="fa-regular fa-user"></i> {post.author}</span>
            </div>
            <h3 className="blog-title">{post.title}</h3>
            <p className="blog-excerpt">{post.excerpt}</p>
            <a href="#" className="card-link-arrow">Read Article <i className="fa-solid fa-arrow-right"></i></a>
          </article>
        ))}
      </div>
    </section>
  );
}
