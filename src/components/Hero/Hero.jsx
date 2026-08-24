 import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';

export default function Hero() {
  const { isAuthenticated } = useAuth();
  const { level, groups, bootstrap } = useLayout();

  const heroImage = bootstrap?.landing?.hero_image_url;
  const levelName = level?.display_name || '';
  const groupName = groups?.length > 0 ? groups[0].name : '';

  const uiComponents = bootstrap?.ui_components || [];
  const featuredVideo = uiComponents.find((item) => item.component_key === 'featured_video')?.properties;

  return (
    <>
      <section className="hero hero-enhanced">
        <div className="hero-image">
          {heroImage ? (
            <img src={heroImage} alt="" />
          ) : (
            <div className="hero-image-placeholder" />
          )}
        </div>

        <div className="hero-scrim" />

        <div className="hero-content">
          <div className="hero-eyebrow">Welcome to AliverBiopharm</div>

          <h1 className="hero-title">
            {isAuthenticated && levelName ? (
              <>Master<br />{levelName}</>
            ) : (
              <>Master Biology<br />and Pharmacy</>
            )}
          </h1>

          <p className="hero-tagline">
            {isAuthenticated && groupName
              ? `Your ${groupName} journey continues — notes, quizzes, flashcards, and live classrooms, all matched to your level.`
              : 'Structured notes, adaptive quizzes, and spaced repetition flashcards — built for O-Level, A-Level, and Pharmacy.'}
          </p>

          <div className="hero-actions">
            {isAuthenticated ? (
              <>
                <Link to="/quiz" className="btn btn-primary">Continue Learning</Link>
                <Link to="/notes" className="btn btn-secondary">Browse Notes</Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary">Start Learning Free</Link>
                <Link to="/login" className="btn btn-secondary">Sign In</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {featuredVideo && (
        <div className="hero-preview-card">
          <div className="hero-preview-media">
            <img src={featuredVideo.thumbnail_url} alt={featuredVideo.title} loading="lazy" />
          </div>

          <div className="hero-preview-body">
            <span className="hero-preview-category">Videos</span>
            <h2 className="hero-preview-title">{featuredVideo.title}</h2>
            <a
              href={featuredVideo.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary hero-preview-btn"
            >
              Watch Now
            </a>
          </div>
        </div>
      )}
    </>
  );
}
