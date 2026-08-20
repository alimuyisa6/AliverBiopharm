 import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllSiteSections } from '../api/client';
import { FaEnvelope, FaLocationDot, FaLinkedinIn, FaXTwitter, FaInstagram, FaGlobe } from 'react-icons/fa6';

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
        className="inline-link"
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
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer" aria-label={platform} className="team-social-link">
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

  useEffect(() => {
    getAllSiteSections().then(setSections);
  }, []);

  if (!sections) return null;

  const page = sections.about;

  return (
    <>
      {page?.hero && (
        <section
          className={`about-hero${page.hero.image_url ? ' about-hero-bg' : ''}`}
          style={page.hero.image_url ? {
            backgroundImage: `url(${page.hero.image_url})`,
            backgroundColor: 'var(--primary)'
          } : undefined}
        >
          <div className="about-hero-content">
            <h1 className="about-hero-title">{page.hero.heading || page.title}</h1>
            {page.hero.subtext && <p className="about-hero-subtext">{page.hero.subtext}</p>}
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
              {page.mission.heading && <h2 className="about-block-heading">{page.mission.heading}</h2>}
              {page.mission.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.vision && (
            <div className="about-block">
              {page.vision.heading && <h2 className="about-block-heading">{page.vision.heading}</h2>}
              {page.vision.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.story && (
            <div className="about-block">
              {page.story.heading && <h2 className="about-block-heading">{page.story.heading}</h2>}
              {page.story.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.why_choose_us && (
            <div className="about-block">
              {page.why_choose_us.heading && <h2 className="about-block-heading">{page.why_choose_us.heading}</h2>}
              {page.why_choose_us.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.learning_philosophy && (
            <div className="about-block">
              {page.learning_philosophy.heading && <h2 className="about-block-heading">{page.learning_philosophy.heading}</h2>}
              {page.learning_philosophy.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.founders && (
            <div className="about-block">
              {page.founders.heading && <h2 className="about-block-heading">{page.founders.heading}</h2>}
              {page.founders.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.values && (
            <div className="about-block">
              {page.values.heading && <h2 className="about-block-heading">{page.values.heading}</h2>}
              {page.values.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.team?.length > 0 && (
            <div className="about-block">
              <h2 className="about-block-heading">{page.team_heading || 'Meet Our Team'}</h2>
              <div className="team-grid">
                {page.team.map((member, idx) => (
                  <TeamCard key={idx} member={member} />
                ))}
              </div>
            </div>
          )}

          {page?.contributors?.length > 0 && (
            <div className="about-block">
              <h2 className="about-block-heading">{page.contributors_heading || 'Contributors & Reviewers'}</h2>
              <div className="contributors-grid">
                {page.contributors.map((contributor, idx) => (
                  <ContributorCard key={idx} contributor={contributor} />
                ))}
              </div>
            </div>
          )}

          {page?.commitment_to_quality && (
            <div className="about-block">
              {page.commitment_to_quality.heading && <h2 className="about-block-heading">{page.commitment_to_quality.heading}</h2>}
              {page.commitment_to_quality.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.future && (
            <div className="about-block">
              {page.future.heading && <h2 className="about-block-heading">{page.future.heading}</h2>}
              {page.future.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.legal && (
            <div className="about-block">
              {page.legal.heading && <h2 className="about-block-heading">{page.legal.heading}</h2>}
              {page.legal.content.split('\n\n').map((para, i) => (
                <p key={i}><RichText text={para} /></p>
              ))}
            </div>
          )}

          {page?.faq && (
            <div className="about-block">
              {page.faq.heading && <h2 className="about-block-heading">{page.faq.heading}</h2>}
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
              {page.contact.heading && <h2 className="about-block-heading">{page.contact.heading}</h2>}
              {page.contact.subtext && <p className="about-contact-subtext"><RichText text={page.contact.subtext} /></p>}
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
            <div className="about-block about-cta">
              <h2 className="about-block-heading">{page.call_to_action.heading || 'Start Your Learning Journey'}</h2>
              {page.call_to_action.content && <p className="about-cta-text"><RichText text={page.call_to_action.content} /></p>}
              {page.call_to_action.button_text && (
                <Link
                  to={page.call_to_action.button_url || '/register'}
                  className="about-cta-button"
                >
                  {page.call_to_action.button_text}
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
