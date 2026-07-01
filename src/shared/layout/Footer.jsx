// shared/layout/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export function Footer({ logoUrl, tagline, socialLinks, columns, currentYear }) {
  return (
    <footer className="footer-fat">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link to="/" className="logo-link footer-logo-link">
            {logoUrl ? (
              <img src={logoUrl} alt="AliverBiopharm" className="footer-logo" />
            ) : (
              'AliverBiopharm'
            )}
          </Link>
          <p className="footer-tagline">{tagline}</p>
          <div className="footer-social">
            {(socialLinks || []).filter(Boolean).map(s => (
              <a key={s.platform} href={s.url} target="_blank" rel="noreferrer">
                <i className={s.icon}></i>
              </a>
            ))}
          </div>
        </div>
        <div className="footer-grid">
          {(columns || []).filter(Boolean).map(col => (
            <div key={col.heading}>
              <h4 className="footer-col-heading">{col.heading}</h4>
              <ul className="footer-col-list">
                {(col.items || []).filter(Boolean).map(item => (
                  <li key={item.label}>
                    {item.href.startsWith('#') || item.href.startsWith('http') ? (
                      <a href={item.href} className="footer-col-link">
                        {item.icon && <i className={item.icon}></i>}{item.label}
                      </a>
                    ) : (
                      <Link to={item.href} className="footer-col-link">
                        {item.icon && <i className={item.icon}></i>}{item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
        <nav className="footer-bottom-nav">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Use</Link>
          <Link to="/about">About Us</Link>
        </nav>
      </div>
    </footer>
  );
}
