 import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';

const MODULE_LABELS = {
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  recall: 'Recall',
  notes: 'Notes'
};

const MODULE_ROUTES = {
  quiz: '/quiz',
  flashcards: '/flashcards',
  recall: '/recall',
  notes: '/notes'
};

const MODULE_FEATURE_KEYS = {
  quiz: 'quizzes',
  flashcards: 'flashcards',
  recall: 'recall',
  notes: null
};

function resumeHref(resume) {
  return MODULE_ROUTES[resume?.module] || '/';
}

export default function Hero() {
  const { isAuthenticated } = useAuth();
  const { level, groups, bootstrap, features } = useLayout();
  const [resume, setResume] = useState(null);

  const resumeFeatureKey = resume ? MODULE_FEATURE_KEYS[resume.module] : null;
  const resumeAllowed = !resume || !resumeFeatureKey || (features?.[resumeFeatureKey] ?? true);

  const levelName = level?.display_name || '';
  const groupName = groups?.length > 0 ? groups[0].name : '';

  const uiComponents = bootstrap?.ui_components || [];
  const featuredVideo = uiComponents.find((item) => item.component_key === 'featured_video')?.properties;
  const heroGallery = uiComponents.find((item) => item.component_key === 'hero_gallery')?.properties;
  const galleryImages = heroGallery?.images || [];
  const galleryTitle = heroGallery?.title || 'Major Learning Materials Tailored For You';
  const galleryRowOne = galleryImages.slice(0, 3);
  const galleryRowTwo = galleryImages.slice(3, 6);

  useEffect(() => {
    if (!isAuthenticated) {
      setResume(null);
      return;
    }

    let cancelled = false;

    fetch('/api/server?module=resume&path=get_resume', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setResume(data?.resume || null);
      })
      .catch(() => {
        if (!cancelled) setResume(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <>
      <section className="hero hero-enhanced">
        <div className="hero-image">
          {featuredVideo?.video_url ? (
            <video autoPlay muted loop playsInline poster={featuredVideo.thumbnail_url}>
              <source src={featuredVideo.video_url} type="video/mp4" />
            </video>
          ) : (
            <div className="hero-image-placeholder" />
          )}
        </div>

        <div className="hero-scrim" />

        <div className="hero-content" style={{ paddingTop: 'var(--space-10)' }}>
          <div className="hero-eyebrow" style={{ fontSize: 'var(--text-sm)' }}>
            Welcome to <span className="hero-eyebrow-accent">AliverBiopharm</span>
          </div>

          <h1 className="hero-title">
            {isAuthenticated && levelName ? (
              <>
                Master
                <span className="hero-eyebrow-accent" style={{ marginTop: 'var(--space-2)' }}>{levelName}</span>
              </>
            ) : (
              <>Master Biology<br />and Pharmacy</>
            )}
          </h1>

          <p className="hero-tagline">
            {isAuthenticated && groupName
              ? `Your ${groupName} journey continues. Notes, quizzes, flashcards, and live classrooms, all matched to your level.`
              : 'Structured notes, adaptive quizzes, and spaced repetition flashcards, built for every level you study.'}
          </p>

          {!isAuthenticated && (
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-radius-pill">Start Learning Free</Link>
              <Link to="/login" className="btn btn-secondary btn-radius-pill">Sign In</Link>
            </div>
          )}

          {isAuthenticated && resume && resumeAllowed && (
            <div className="hero-actions">
              <Link to={resumeHref(resume)} className="btn btn-primary btn-radius-pill">
                Continue {MODULE_LABELS[resume.module] || 'Learning'}
              </Link>
            </div>
          )}
        </div>
      </section>

      {galleryImages.length > 0 && (
        <div className="hero-gallery-section">
          <h2 className="hero-gallery-title">{galleryTitle}</h2>

          <div className="hero-gallery-row">
            {galleryRowOne.map((image, index) => (
              <div className="hero-gallery-item" key={image.url || index}>
                <img src={image.url} alt={image.alt || galleryTitle} loading="lazy" />
              </div>
            ))}
          </div>

          <div className="hero-gallery-row">
            {galleryRowTwo.map((image, index) => (
              <div className="hero-gallery-item" key={image.url || index}>
                <img src={image.url} alt={image.alt || galleryTitle} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
