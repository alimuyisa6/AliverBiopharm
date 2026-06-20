import React, { useEffect, useState } from 'react';
import '../styles/Legal.css';
import { getAllSiteSections } from '../api/client';

export default function LegalPage({ type }) {
  const [sections, setSections] = useState(null);

  useEffect(() => {
    async function load() {
      const data = await getAllSiteSections();
      setSections(data);
    }
    load();
  }, []);

  if (!sections) return <div className="legal-page">Loading...</div>;

  const page = sections.legal?.[type];

  return (
    <div className="legal-page">
      <header className="legal-header">
        <a href="/" className="legal-logo">
          {sections.site_config?.logo_url ? (
            <img src={sections.site_config.logo_url} alt="logo" />
          ) : (
            'AliverBiopharm'
          )}
        </a>

        <nav className="legal-nav">
          {(sections.navigation?.links || []).map(link => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="legal-container">
        <h1>{page?.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: page?.content }} />
      </main>

      <footer className="legal-footer">
        <div className="legal-footer-inner">
          <div>
            <img src={sections.site_config?.logo_url} alt="" />
            <p>{sections.footer?.description}</p>
          </div>

          <div>
            <h4>Legal</h4>
            {(sections.footer?.columns || [])
              .find(c => c.heading === 'Legal')
              ?.items?.map(item => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
