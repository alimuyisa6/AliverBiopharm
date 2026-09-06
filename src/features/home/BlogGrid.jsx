/* features/home/BlogGrid.jsx */
import React from 'react';

export function BlogGrid({ posts }) {
  if (!posts || !Array.isArray(posts)) return null;

  return (
    <section id="blog" className="section alt-bg reveal">
      <span className="sec-label">Worth a read</span>
      <h2 className="section-title">
        What Our Writers Have<br />Been Digging Into
      </h2>
      <p className="section-subtitle">
        Short reads on biology, pharmacy, and the occasional science story that caught our attention.
      </p>

      <div className="grid-3">
        {posts.filter(Boolean).map((post) => (
          <article key={post.title} className="card">
            {post.image_url && <img src={post.image_url} alt={post.title} />}

            <div className="blog-meta">
              <span><i className="fa-regular fa-calendar" /> {post.date}</span>
              <span><i className="fa-regular fa-user" /> {post.author}</span>
            </div>

            <h3 className="blog-title">{post.title}</h3>
            <p className="blog-excerpt">{post.excerpt}</p>

            <a href="#" className="card-link-arrow">
              Keep reading <i className="fa-solid fa-arrow-right" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
