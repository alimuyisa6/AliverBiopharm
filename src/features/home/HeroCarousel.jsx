// features/home/HeroCarousel.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export function HeroCarousel({ slides, currentSlide }) {
  return (
    <section id="home" className="hero-carousel">
      {(slides || []).filter(Boolean).map((slide, idx) => (
        <div
          key={idx}
          className={`carousel-slide ${idx === currentSlide ? 'active' : ''}`}
          style={{ backgroundImage: `url(${slide.background_image})` }}
        >
          <div className="slide-overlay">
            <h1 className="hero-title">{slide.title}</h1>
            <p className="hero-subtitle">{slide.subtitle}</p>
            {slide.cta_link.startsWith('#') || slide.cta_link.startsWith('http') ? (
              <a href={slide.cta_link} className="btn-primary">
                <i className={`fa-solid ${slide.icon || 'fa-arrow-right'}`}></i> {slide.cta_text}
              </a>
            ) : (
              <Link to={slide.cta_link} className="btn-primary">
                <i className={`fa-solid ${slide.icon || 'fa-arrow-right'}`}></i> {slide.cta_text}
              </Link>
            )}
          </div>
        </div>
      ))}
      <div className="dynamic-hero-container" id="hero-title-section">
        <h1 className="dynamic-main-title">
          <span className="title-word magenta-word">Aliver</span>
          <span className="title-word cyan-word">Biopharm</span>
        </h1>
        <div className="title-sub-line">
          <span className="sub-word">Advanced</span>
          <span className="sub-word">Biology</span>
          <span className="sub-word magenta-word">&amp;</span>
          <span className="sub-word cyan-word">Pharmacy</span>
          <span className="sub-word">Learning</span>
          <span className="sub-word">Platform</span>
        </div>
      </div>
    </section>
  );
}
