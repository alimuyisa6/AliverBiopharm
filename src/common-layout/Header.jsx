 // common-layout/Header.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export function Header({ user, logoUrl, navLinks, theme, onToggleTheme, onToggleMobile, children }) {
  return (
    <header className="site-header" id="site-header">
      <div className="header-container">
        <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
          {logoUrl ? (
            <img src={logoUrl} alt="AliverBiopharm" className="header-logo" />
          ) : (
            'AliverBiopharm'
          )}
        </Link>
        <nav aria-label="Main navigation">
          <ul className="main-nav" id="main-nav">
            {(navLinks || []).filter(Boolean).map(link => (
              <li key={link.href}>
                {link.href.startsWith('#') || link.href.startsWith('http') ? (
                  <a href={link.href}>{link.label}</a>
                ) : (
                  <Link to={link.href}>{link.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-actions">
          {children}
          <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle dark mode">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button className="mobile-toggle" onClick={onToggleMobile} aria-label="Open menu">
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
