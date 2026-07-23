 // features/home/HeroCarousel.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export function HeroCarousel({ slides, currentSlide }) {
  if (!slides?.length) return null;

  return (
    <section id="home" className="hero-carousel">
      <div className="carousel-viewport">
        {slides.map((slide, idx) => (
          <div
            key={idx}
            className={`carousel-slide ${idx === currentSlide ? 'active' : ''}`}
            style={{ backgroundImage: `url(${slide.background_image})` }}
          >
            <div className="slide-overlay">
              <div className="hero-content">
                <h1 className="hero-title">{slide.title}</h1>
                <p className="hero-subtitle">{slide.subtitle}</p>
                {slide.cta_link.startsWith('#') || slide.cta_link.startsWith('http') ? (
                  <a href={slide.cta_link} className="btn-primary hero-cta">
                    <i className={`fa-solid ${slide.icon || 'fa-arrow-right'}`}></i> {slide.cta_text}
                  </a>
                ) : (
                  <Link to={slide.cta_link} className="btn-primary hero-cta">
                    <i className={`fa-solid ${slide.icon || 'fa-arrow-right'}`}></i> {slide.cta_text}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
