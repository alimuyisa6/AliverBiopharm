 import React from 'react';
import '../../pages/legal/legal.css';

export default function LegalLayout({ title, lastUpdated, children }) {
  const currentYear = new Date().getFullYear();
  
  return (
    <div className="legal-page">
      <h1>{title}</h1>
      <div className="last-updated">Last updated: {lastUpdated}</div>
      <div>{children}</div>
      <div className="footer-copyright">
        © {currentYear} AliverBiopharm. All rights reserved.<br />
        Registered in Uganda
      </div>
    </div>
  );
}
