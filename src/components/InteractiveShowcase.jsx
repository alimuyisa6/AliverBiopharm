import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAllSiteSections } from '../api/client';
import './InteractiveShowcase.css';

/**
 * Feature list displayed inside the iPhone mockup.
 * Each entry defines its icon, gradient theme, and the
 * content card shown when the feature is "clicked" by the
 * automated cursor tour.
 */
const FEATURES = [
  {
    id: 'biology-notes',
    label: 'Biology Notes',
    icon: 'fa-dna',
    badgeIcon: 'fa-book-open',
    gradient: 'gradient-teal',
    title: 'Biology Notes',
    description:
      'Comprehensive and well-organized biology notes covering major topics for effective learning and revision.'
  },
  {
    id: 'pdf-library',
    label: 'PDF Library',
    icon: 'fa-file-circle-check',
    badgeIcon: 'fa-file-lines',
    gradient: 'gradient-amber',
    title: 'PDF Library',
    description:
      'Access study materials, revision guides, lecture notes, and downloadable educational resources.'
  },
  {
    id: 'smart-quizzes',
    label: 'Smart Quizzes',
    icon: 'fa-brain',
    badgeIcon: 'fa-square-check',
    gradient: 'gradient-violet',
    title: 'Smart Quizzes',
    description:
      'Test your knowledge with adaptive quizzes designed to reinforce key concepts and track your progress.'
  },
  {
    id: 'past-papers',
    label: 'Past Papers',
    icon: 'fa-file-pen',
    badgeIcon: 'fa-graduation-cap',
    gradient: 'gradient-coral',
    title: 'Past Papers',
    description:
      'Practice with a curated archive of past examination papers to build confidence and exam readiness.'
  },
  {
    id: 'pharmacy-hub',
    label: 'Pharmacy Hub',
    icon: 'fa-capsules',
    badgeIcon: 'fa-mortar-pestle',
    gradient: 'gradient-emerald',
    title: 'Pharmacy Hub',
    description:
      'Explore dedicated pharmacy resources covering pharmacology, dosage forms, and clinical practice essentials.'
  },
  {
    id: 'learning-resources',
    label: 'Learning Resources',
    icon: 'fa-atom',
    badgeIcon: 'fa-microscope',
    gradient: 'gradient-sky',
    title: 'Learning Resources',
    description:
      'A growing library of guides, diagrams, and reference material to support every stage of your studies.'
  }
];

/**
 * Statistic / highlight cards shown on the left column.
 */
const HIGHLIGHTS = [
  { icon: 'fa-book-open-reader', label: 'Extensive Study Notes' },
  { icon: 'fa-square-check', label: 'Interactive Quizzes' },
  { icon: 'fa-file-pen', label: 'Past Papers' },
  { icon: 'fa-layer-group', label: 'Learning Resources' }
];

// Timing constants for the automated guided tour (milliseconds)
const HOVER_DURATION = 1100; // cursor travel + arrival pause before click
const CLICK_DURATION = 1700; // ripple + card reveal hold time
const STEP_DURATION = HOVER_DURATION + CLICK_DURATION;

export default function InteractiveShowcase() {
  const [logoUrl, setLogoUrl] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isClicking, setIsClicking] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const sectionRef = useRef(null);
  const featureRefs = useRef([]);

  // Fetch site settings once to display the dynamic logo, matching
  // the same data source used across the rest of the project.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const sections = await getAllSiteSections();
        if (isMounted) {
          setLogoUrl(sections?.site_config?.logo_url || null);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Scroll reveal animation, consistent with the ".reveal" pattern
  // used elsewhere in the project.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(node);

    // Handle case where section is already in view on mount
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight) setRevealed(true);

    return () => observer.disconnect();
  }, []);

  // Automated guided-tour loop: cursor moves to the next feature,
  // "clicks" it (triggering ripple + click animation), then the
  // content card fades in. Cycle repeats infinitely.
  useEffect(() => {
    let arriveTimer;
    let clickTimer;
    let nextTimer;

    function runStep() {
      setCardVisible(false);
      setIsClicking(false);

      // Cursor arrives at target, then performs the click
      arriveTimer = setTimeout(() => {
        setIsClicking(true);
        setCardVisible(true);

        // Reset click animation state shortly after triggering it
        clickTimer = setTimeout(() => setIsClicking(false), 350);
      }, HOVER_DURATION);

      // Advance to the next feature after the full step duration
      nextTimer = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % FEATURES.length);
      }, STEP_DURATION);
    }

    runStep();

    return () => {
      clearTimeout(arriveTimer);
      clearTimeout(clickTimer);
      clearTimeout(nextTimer);
    };
  }, [activeIndex]);

  // Compute cursor position (relative to the feature list container)
  // by reading the target feature's bounding box once rendered.
  const getCursorPosition = useCallback(() => {
    const target = featureRefs.current[activeIndex];
    if (!target) return { top: 0, left: 0 };
    return {
      top: target.offsetTop + target.offsetHeight / 2,
      left: target.offsetLeft + target.offsetWidth - 28
    };
  }, [activeIndex]);

  const cursorPos = getCursorPosition();
  const activeFeature = FEATURES[activeIndex];

  return (
    <section
      id="showcase"
      ref={sectionRef}
      className={`showcase-section reveal ${revealed ? 'in' : ''}`}
      aria-label="AliverBiopharm platform showcase"
    >
      <div className="showcase-grid">

        {/* LEFT COLUMN: headline, supporting copy, highlight cards */}
        <div className="showcase-content">
          <span className="sec-label">PLATFORM OVERVIEW</span>
          <h2 className="showcase-title">
            Everything You Need to Excel in Biology &amp; Pharmacy
          </h2>
          <p className="showcase-subtitle">
            AliverBiopharm brings together comprehensive notes, interactive quizzes,
            past papers, downloadable PDFs, and curated learning resources, all in one
            place, so you can study smarter and feel confident going into every exam.
          </p>

          <div className="showcase-highlights" role="list">
            {HIGHLIGHTS.map((item) => (
              <div className="highlight-card" role="listitem" key={item.label}>
                <div className="highlight-icon" aria-hidden="true">
                  <i className={`fa-solid ${item.icon}`}></i>
                </div>
                <span className="highlight-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: iPhone mockup with animated guided tour */}
        <div className="showcase-phone-wrap">
          <div className="phone-mockup" role="img" aria-label="Preview of the AliverBiopharm mobile experience">
            <div className="phone-notch"></div>

            <div className="phone-screen">

              {/* Top bar with dynamic logo and site name */}
              <div className="phone-topbar">
                <div className="phone-logo">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" />
                  ) : (
                    <i className="fa-solid fa-flask" aria-hidden="true"></i>
                  )}
                </div>
                <span className="phone-site-name">AliverBiopharm</span>
              </div>

              {/* Feature list with animated guided cursor */}
              <div className="phone-feature-list">
                {FEATURES.map((feature, idx) => (
                  <div
                    key={feature.id}
                    ref={(el) => (featureRefs.current[idx] = el)}
                    className={`phone-feature-item ${idx === activeIndex ? 'active' : ''}`}
                  >
                    <div className={`feature-icon ${feature.gradient}`} aria-hidden="true">
                      <i className={`fa-solid ${feature.icon} feature-icon-main`}></i>
                      <i className={`fa-solid ${feature.badgeIcon} feature-icon-badge`}></i>
                    </div>
                    <span className="feature-label">{feature.label}</span>
                    <i className="fa-solid fa-chevron-right feature-chevron" aria-hidden="true"></i>
                  </div>
                ))}

                {/* Animated content card revealed on "click" */}
                <div className={`phone-content-card ${cardVisible ? 'visible' : ''}`} aria-live="polite">
                  <div className={`content-card-icon ${activeFeature.gradient}`} aria-hidden="true">
                    <i className={`fa-solid ${activeFeature.icon} feature-icon-main`}></i>
                    <i className={`fa-solid ${activeFeature.badgeIcon} feature-icon-badge`}></i>
                  </div>
                  <h4 className="content-card-title">{activeFeature.title}</h4>
                  <p className="content-card-description">{activeFeature.description}</p>
                </div>

                {/* Simulated mouse cursor performing the guided tour */}
                <div
                  className="phone-cursor"
                  style={{ top: `${cursorPos.top}px`, left: `${cursorPos.left}px` }}
                  aria-hidden="true"
                >
                  <i className="fa-solid fa-arrow-pointer"></i>
                  <span className={`cursor-ripple ${isClicking ? 'active' : ''}`}></span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
