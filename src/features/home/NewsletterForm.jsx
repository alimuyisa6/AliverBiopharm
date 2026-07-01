// features/home/NewsletterForm.jsx
import React from 'react';

export function NewsletterForm({ email, status, onChange, onSubmit }) {
  return (
    <section className="section reveal">
      <span className="sec-label">Updates</span>
      <h2 className="section-title">Never Miss a Resource or Update</h2>
      <p className="section-subtitle">
        Join our growing community. Weekly study tips, new content alerts, and platform news straight to your inbox.
      </p>
      <form id="newsletter-form" onSubmit={onSubmit}>
        <div className="newsletter-box">
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={onChange}
            required
          />
          <button type="submit">Subscribe <i className="fa-solid fa-paper-plane"></i></button>
        </div>
        {status && (
          <div className={`newsletter-status ${status.success ? 'newsletter-status-success' : 'newsletter-status-error'}`}>
            {status.message}
          </div>
        )}
      </form>
    </section>
  );
}
