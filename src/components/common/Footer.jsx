import { useState, useEffect } from 'react';
import { apiCall } from '../../services/apiService';

function Footer() {
  const [footerData, setFooterData] = useState({ columns: [], social_links: [] });
  const year = new Date().getFullYear();

  useEffect(() => {
    apiCall('get_all_site_sections').then(sections => {
      if (sections?.footer) {
        setFooterData({
          columns: sections.footer.columns || [],
          social_links: sections.footer.social_links || []
        });
      }
    }).catch(() => {});
  }, []);

  return (
    <footer className="footer-fat" role="contentinfo">
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ maxWidth: '260px' }}>
          <a href="/" className="logo-link" aria-label="AliverBiopharm Home">
            <span className="font-display font-bold" style={{ fontSize: '1.25rem', color: 'var(--clr-white)' }}>AliverBiopharm</span>
          </a>
          <p style={{ fontSize: '.85rem', lineHeight: '1.7', color: 'var(--clr-text-dim)' }}>Advancing biology and pharmacy education for every learner on the planet.</p>
          <div className="footer-social" id="footer-social">
            {footerData.social_links.map((s, i) => (
              <a key={i} href={s.url} aria-label={s.platform} target="_blank" rel="noopener noreferrer"><i className={s.icon} aria-hidden="true"></i></a>
            ))}
          </div>
        </div>
        <nav className="footer-grid" aria-label="Footer navigation">
          {footerData.columns.map((col, i) => (
            <div key={i}>
              <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>{col.heading}</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {col.items.map((item, j) => (
                  <li key={j}>
                    <a href={item.href || '#'} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)', textDecoration: 'none' }}>
                      {item.icon && <i className={item.icon} style={{ color: 'var(--clr-magenta)', marginRight: '0.5rem' }}></i>}
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div style={{ maxWidth: 'var(--max-width)', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '.75rem', color: 'var(--clr-text-muted)' }}>&copy; {year} AliverBiopharm. All rights reserved.</p>
        <nav style={{ display: 'flex', gap: '22px' }} aria-label="Legal links">
          <a href="/privacy" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)', textDecoration: 'none' }}>Terms of Use</a>
          <a href="/accessibility" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)', textDecoration: 'none' }}>Accessibility</a>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
