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

        <div className="hero-content">
          <div className="hero-eyebrow">
            Welcome to <span className="hero-eyebrow-accent">AliverBiopharm</span>
          </div>

          <h1 className="hero-title">
            {isAuthenticated && levelName ? (
              <>Master<br />{levelName}</>
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
              <Link to="/register" className="btn btn-primary">Start Learning Free</Link>
              <Link to="/login" className="btn btn-secondary">Sign In</Link>
            </div>
          )}

          {isAuthenticated && resume && resumeAllowed && (
            <div className="hero-actions">
              <Link to={resumeHref(resume)} className="btn btn-primary">
                Continue {MODULE_LABELS[resume.module] || 'Learning'}
              </Link>
            </div>
          )}
        </div>
      </section>

      {featuredVideo && (
        <div className="hero-preview-card hero-preview-card-flat">
          <div className="hero-preview-media hero-preview-media-full">
            <img src={featuredVideo.thumbnail_url} alt="AliverBiopharm" loading="lazy" />
          </div>

          <div className="hero-preview-body">
            <h2 className="hero-preview-title">
              From Ordinary Level to University — all in one platform.
            </h2>
            <p className="hero-preview-text">
              Your success is our happiness, and we're here to give you the best support you need every step of the way.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
