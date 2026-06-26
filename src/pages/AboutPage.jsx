 import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getSections } from '../api/sections';
import { FaEnvelope, FaLocationDot, FaLinkedinIn, FaXTwitter, FaInstagram, FaGlobe } from 'react-icons/fa6';
import '../styles/About.css';

function RichText({ text }) {
  const TOKEN_RE = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})|((https?:\/\/)[^\s<>"']+)/g;
  const parts = [];
  let last = 0;
  let match;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[0];
    const isEmail = !!match[1];
    parts.push(
      <a
        key={match.index}
        href={isEmail ? `mailto:${raw}` : raw}
        target={isEmail ? undefined : '_blank'}
        rel={isEmail ? undefined : 'noopener noreferrer'}
        style={{ color: 'var(--clr-cyan)', textDecoration: 'underline', wordBreak: 'break-all' }}
      >
        {raw}
      </a>
    );
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function TeamCard({ member }) {
  const socialIcons = {
    linkedin: FaLinkedinIn,
    twitter: FaXTwitter,
    instagram: FaInstagram,
    website: FaGlobe
  };
  return (
    <div className="team-card">
      <div className="team-card-image">
        <img
          src={member.image_url || '/placeholder-avatar.svg'}
          alt={member.name}
          loading="lazy"
        />
      </div>
      <div className="team-card-body">
        <h3>{member.name}</h3>
        <p className="team-card-role">{member.role}</p>
        {member.bio && <p className="team-card-bio">{member.bio}</p>}
        {member.social && (
          <div className="team-card-social">
            {Object.entries(member.social).map(([platform, url]) => {
              const Icon = socialIcons[platform] || FaGlobe;
              return (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer" aria-label={platform}>
                  <Icon />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ContributorCard({ contributor }) {
  return (
    <div className="contributor-card">
      <img
        src={contributor.image_url || '/placeholder-avatar.svg'}
        alt={contributor.name}
        loading="lazy"
      />
      <div>
        <strong>{contributor.name}</strong>
        <span>{contributor.role}</span>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const [sections, setSections] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    getSections().then(setSections);
  }, []);

  if (!sections) return <div className="homepage">Loading...</div>;

  const page = sections.about;
  const currentYear = new Date().getFullYear();
  const navLinks = sections?.navigation?.links || [{ href: '/', label: 'Home' }];

  return (
    <div className="homepage">
      <header className="site-header" id="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
            ) : (
              'AliverBiopharm'
            )}
          </Link>
          <nav aria-label="Main navigation">
            <ul className="main-nav" id="main-nav">
              {navLinks.map(link => (
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
            <button
              className="theme-toggle"
              onClick={() => {
                const dark = document.body.classList.toggle('dark-mode');
                localStorage.setItem('theme', dark ? 'dark' : 'light');
                setTheme(dark ? 'dark' : 'light');
              }}
              aria-label="Toggle dark mode"
            >
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu">
              <i className="fa-solid fa-bars"></i>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-nav-panel ${mobileMenuOpen ? 'active' : ''}`}>
        <div className="mobile-nav-panel-inner">
          <div className="mobile-nav-header">
            <div className="mobile-nav-header-row">
              <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {navLinks.map(link =>
              link.href.startsWith('#') || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href}>{link.label}</a>
              ) : (
                <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>{link.label}</Link>
              )
            )}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>

      {page?.hero && (
        <section
          className="about-hero"
          style={page.hero.image_url ? {
            backgroundImage: `linear-gradient(rgba(10,20,35,0.85), rgba(10,20,35,0.9)), url(${page.hero.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          } : {}}
        >
          <div className="about-hero-content">
            <h1>{page.hero.heading || page.title}</h1>
            {page.hero.subtext && <p>{page.hero.subtext}</p>}
          </div>
        </section>
      )}

      <section className="section about-section">
        <div className="about-content-wrap">
          {!page?.hero && (
            <h1 className="about-title">{page?.title || 'About AliverBiopharm'}</h1>
          )}

          {page?.mission && (
            <div className="about-block">
              {page.mission.heading && <h2>{page.mission.heading}</h2>}
              {page.mission.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.vision && (
            <div className="about-block">
              {page.vision.heading && <h2>{page.vision.heading}</h2>}
              {page.vision.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.story && (
            <div className="about-block">
              {page.story.heading && <h2>{page.story.heading}</h2>}
              {page.story.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.why_choose_us && (
            <div className="about-block">
              {page.why_choose_us.heading && <h2>{page.why_choose_us.heading}</h2>}
              {page.why_choose_us.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.learning_philosophy && (
            <div className="about-block">
              {page.learning_philosophy.heading && <h2>{page.learning_philosophy.heading}</h2>}
              {page.learning_philosophy.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.founders && (
            <div className="about-block">
              {page.founders.heading && <h2>{page.founders.heading}</h2>}
              {page.founders.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.values && (
            <div className="about-block">
              {page.values.heading && <h2>{page.values.heading}</h2>}
              {page.values.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.team?.length > 0 && (
            <div className="about-block">
              <h2>{page.team_heading || 'Meet Our Team'}</h2>
              <div className="team-grid">
                {page.team.map((member, idx) => (
                  <TeamCard key={idx} member={member} />
                ))}
              </div>
            </div>
          )}

          {page?.contributors?.length > 0 && (
            <div className="about-block">
              <h2>{page.contributors_heading || 'Contributors & Reviewers'}</h2>
              <div className="contributors-grid">
                {page.contributors.map((contributor, idx) => (
                  <ContributorCard key={idx} contributor={contributor} />
                ))}
              </div>
            </div>
          )}

          {page?.commitment_to_quality && (
            <div className="about-block">
              {page.commitment_to_quality.heading && <h2>{page.commitment_to_quality.heading}</h2>}
              {page.commitment_to_quality.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.future && (
            <div className="about-block">
              {page.future.heading && <h2>{page.future.heading}</h2>}
              {page.future.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.legal && (
            <div className="about-block">
              {page.legal.heading && <h2>{page.legal.heading}</h2>}
              {page.legal.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.faq && (
            <div className="about-block">
              {page.faq.heading && <h2>{page.faq.heading}</h2>}
              <div className="faq-list">
                {(page.faq.questions || []).map((item, idx) => (
                  <details key={idx} className="faq-item">
                    <summary className="faq-question">{item.question}</summary>
                    <p className="faq-answer"><RichText text={item.answer} /></p>
                  </details>
                ))}
              </div>
            </div>
          )}

          {page?.contact && (
            <div className="about-block about-contact">
              {page.contact.heading && <h2>{page.contact.heading}</h2>}
              {page.contact.subtext && <p style={{ marginBottom: '20px' }}><RichText text={page.contact.subtext} /></p>}
              <div className="about-contact-details">
                {page.contact.email && (
                  <a href={`mailto:${page.contact.email}`} className="about-contact-item">
                    <FaEnvelope /> {page.contact.email}
                  </a>
                )}
                {page.contact.phone && (
                  <div className="about-contact-item">
                    <FaEnvelope /> {page.contact.phone}
                  </div>
                )}
                {page.contact.address && (
                  <div className="about-contact-item">
                    <FaLocationDot /> {page.contact.address}
                  </div>
                )}
              </div>
              {page.contact.social_links?.length > 0 && (
                <div className="about-social-links">
                  {page.contact.social_links.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="about-social-link">
                      <i className={s.icon}></i>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {page?.call_to_action && (
            <div className="about-block about-cta" style={{ textAlign: 'center', background: 'var(--clr-navy-card)', border: '1px solid var(--clr-border-glow)', borderRadius: '12px', padding: '40px 20px', marginTop: '40px' }}>
              <h2>{page.call_to_action.heading || 'Start Your Learning Journey'}</h2>
              {page.call_to_action.content && <p style={{ maxWidth: '600px', margin: '16px auto' }}><RichText text={page.call_to_action.content} /></p>}
              {page.call_to_action.button_text && (
                <Link
                  to={page.call_to_action.button_url || '/register'}
                  style={{
                    display: 'inline-block',
                    marginTop: '16px',
                    padding: '14px 32px',
                    background: 'var(--clr-cyan)',
                    color: 'var(--clr-navy)',
                    borderRadius: '8px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '1rem'
                  }}
                >
                  {page.call_to_action.button_text}
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="footer-fat">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '260px' }}>
            <Link to="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
              {sections?.site_config?.logo_url ? (
                <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} />
              ) : (
                'AliverBiopharm'
              )}
            </Link>
            <p style={{ fontSize: '.85rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>
              Advancing biology and pharmacy education for every learner.
            </p>
            <div className="footer-social">
              {(sections?.footer?.social_links || []).map(s => (
                <a key={s.platform} href={s.url} target="_blank" rel="noreferrer">
                  <i className={s.icon}></i>
                </a>
              ))}
            </div>
          </div>
          <div className="footer-grid">
            {(sections?.footer?.columns || []).map(col => (
              <div key={col.heading}>
                <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>
                  {col.heading}
                </h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.items?.map(item => (
                    <li key={item.label}>
                      {item.href.startsWith('#') || item.href.startsWith('http') ? (
                        <a href={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                          {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
                          {item.label}
                        </a>
                      ) : (
                        <Link to={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                          {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 'var(--max-width)', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--clr-text-muted)' }}>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
          <nav style={{ display: 'flex', gap: '22px' }}>
            <Link to="/privacy" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Terms of Use</Link>
            <Link to="/about" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>About Us</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
