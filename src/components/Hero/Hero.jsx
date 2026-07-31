 import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';

export default function Hero() {
  const { isAuthenticated } = useAuth();
  const { level, groups, bootstrap } = useLayout();

  const heroImage = bootstrap?.landing?.hero_image_url;
  const levelName = level?.display_name || '';
  const groupName = groups?.length > 0 ? groups[0].name : '';

  return (
    <section className="hero">
      <div className="hero-image">
        {heroImage ? (
          <img src={heroImage} alt="" />
        ) : (
          <div className="hero-image-placeholder" />
        )}
      </div>
      <div className="hero-content">
        <h1 className="hero-title">
          {isAuthenticated && levelName
            ? `Master ${levelName}`
            : 'Master Biology & Pharmacy'}
        </h1>
        <p className="hero-subtitle">
          {isAuthenticated && groupName
            ? `Your ${groupName} learning journey continues. Access notes, quizzes, flashcards, and live classrooms tailored to your level.`
            : 'Structured notes, adaptive quizzes, spaced-repetition flashcards, and live classrooms — everything you need to excel in O-Level, A-Level, and Pharmacy.'}
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
        <div className="hero-border" />
      </div>
    </section>
  );
}
