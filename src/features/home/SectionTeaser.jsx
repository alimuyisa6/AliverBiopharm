/* features/home/SectionTeaser.jsx */
import Button from '../../components/Button/Button';

export function SectionTeaser({
  eyebrow,
  title,
  intro,
  imageUrl,
  imageAlt,
  ctaLabel,
  onCtaClick,
  imageSide = 'right',
}) {
  return (
    <section className={`section section-teaser teaser-image-${imageSide}`}>
      <div className="section-teaser-inner">
        <div className="section-teaser-image-wrap">
          <img
            src={imageUrl}
            alt={imageAlt}
            className="section-teaser-image"
            loading="lazy"
          />
        </div>
        <div className="section-teaser-content">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 className="section-teaser-title">{title}</h2>
          {intro && <p className="section-subtitle">{intro}</p>}
          <Button variant="primary" onClick={onCtaClick}>{ctaLabel}</Button>
        </div>
      </div>
    </section>
  );
}
