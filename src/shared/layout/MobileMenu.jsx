// shared/layout/MobileMenu.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export function MobileMenu({ open, onClose, user, logout, navLinks, navigate }) {
  return (
    <>
      <div className={`mobile-nav-panel ${open ? 'active' : ''}`}>
        <div className="mobile-nav-panel-inner">
          <div className="mobile-nav-header">
            <div className="mobile-nav-header-row">
              <div className="mobile-auth-top">
                {user ? (
                  <button className="mobile-signout-btn" onClick={logout}>
                    <i className="fa-solid fa-right-from-bracket"></i> Sign Out
                  </button>
                ) : (
                  <>
                    <a href="#" className="mobile-signin-btn" onClick={() => navigate('/login')}>Sign In</a>
                    <a href="#" className="mobile-signup-btn" onClick={() => navigate('/register')}>Create Account</a>
                  </>
                )}
              </div>
              <button className="mobile-close-btn" onClick={onClose}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {(navLinks || []).filter(Boolean).map(link => (
              link.href.startsWith('#') || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href}>{link.label}</a>
              ) : (
                <Link key={link.href} to={link.href}>{link.label}</Link>
              )
            ))}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${open ? 'active' : ''}`} onClick={onClose}></div>
    </>
  );
}
