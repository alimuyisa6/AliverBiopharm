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

  const resumeFeatureKey = resume
    ? MODULE_FEATURE_KEYS[resume.module]
    : null;

  const resumeAllowed =
    !resume ||
    !resumeFeatureKey ||
    (features?.[resumeFeatureKey] ?? true);

  /*
   * These remain dynamic.
   * Do NOT hardcode Form 1, A-Level, Pharmacy, etc.
   */
  const levelName = level?.display_name || '';
  const groupName = groups?.length > 0 ? groups[0].name : '';

  const uiComponents = bootstrap?.ui_components || [];

  const featuredVideo = uiComponents.find(
    (item) => item.component_key === 'featured_video'
  )?.properties;

  useEffect(() => {
    if (!isAuthenticated) {
      setResume(null);
      return;
    }

    let cancelled = false;

    fetch('/api/server?module=resume&path=get_resume', {
      credentials: 'include'
    })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setResume(data?.resume || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResume(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <>
      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="hero hero-enhanced">

        {/* Background media */}
        <div className="hero-image" aria-hidden="true">
          {featuredVideo?.video_url ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={featuredVideo.thumbnail_url}
              preload="metadata"
            >
              <source
                src={featuredVideo.video_url}
                type="video/mp4"
              />
            </video>
          ) : featuredVideo?.thumbnail_url ? (
            <img
              src={featuredVideo.thumbnail_url}
              alt=""
            />
          ) : (
            <div className="hero-image-placeholder" />
          )}
        </div>

        {/* Directional darkening layer */}
        <div
          className="hero-scrim"
          aria-hidden="true"
        />

        {/* Hero content */}
        <div className="hero-content">

          {/* Brand / context */}
          <div className="hero-eyebrow">
            <span>AliverBiopharm</span>

            <span
              className="hero-eyebrow-dot"
              aria-hidden="true"
            >
              •
            </span>

            <span className="hero-eyebrow-context">
              Biology &amp; Pharmacy Education
            </span>
          </div>

          {/* Main hero heading */}
          <h1 className="hero-title">
            {isAuthenticated && levelName ? (
              <>
                <span>Master</span>
                <span>{levelName}</span>
              </>
            ) : (
              <>
                <span>Master Biology</span>
                <span>and Pharmacy</span>
              </>
            )}
          </h1>

          {/* Supporting message */}
          <p className="hero-tagline">
            {isAuthenticated && groupName
              ? `Keep progressing through ${groupName} with focused study resources, practice, revision tools, and learning support tailored to your level.`
              : 'Learn Biology and Pharmacy with structured resources, practice, revision tools, and expert learning support — all in one place.'}
          </p>

          {/* =====================================================
              VISITOR ACTIONS
          ===================================================== */}
          {!isAuthenticated && (
            <div className="hero-actions">
              <Link
                to="/register"
                className="btn btn-primary"
              >
                Start Learning Free
              </Link>

              <Link
                to="/login"
                className="btn btn-secondary"
              >
                Sign In
              </Link>
            </div>
          )}

          {/* =====================================================
              AUTHENTICATED USER ACTION
          ===================================================== */}
          {isAuthenticated && resume && resumeAllowed && (
            <div className="hero-actions">
              <Link
                to={resumeHref(resume)}
                className="btn btn-primary"
              >
                Continue {MODULE_LABELS[resume.module] || 'Learning'}
              </Link>
            </div>
          )}

        </div>
      </section>

      {/* =========================================================
          FULL-BLEED HERO PREVIEW
          No floating-card effect.
          No radius.
      ========================================================= */}
      {featuredVideo && (
        <section
          className="hero-preview-card hero-preview-card-flat"
          aria-labelledby="hero-preview-title"
        >

          {/* Full-width media */}
          <div className="hero-preview-media hero-preview-media-full">
            {featuredVideo.thumbnail_url && (
              <img
                src={featuredVideo.thumbnail_url}
                alt="AliverBiopharm learning platform"
                loading="lazy"
              />
            )}
          </div>

          {/* Constrained editorial content */}
          <div className="hero-preview-body">

            <h2
              id="hero-preview-title"
              className="hero-preview-title"
            >
              From Ordinary Level to University — all in one platform.
            </h2>

            <p className="hero-preview-text">
              Your success is our happiness, and we're here to give you
              the best support you need every step of the way.
            </p>

          </div>
        </section>
      )}
    </>
  );
}
