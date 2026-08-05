 import React, { useRef, useEffect, useCallback } from 'react';

const AUTO_SCROLL_SPEED = 0.6;
const RESUME_DELAY_MS = 2500;
const MANUAL_STEP = 300;
const ACCENTS = ['blue', 'teal', 'violet', 'amber', 'emerald'];

export function TeamScroll({ members }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimeoutRef = useRef(null);
  const rafRef = useRef(null);

  const safeMembers = Array.isArray(members) ? members.filter(Boolean) : [];
  const loopMembers = safeMembers.length > 1 ? [...safeMembers, ...safeMembers] : safeMembers;

  useEffect(() => {
    if (!safeMembers.length) return;
    const track = trackRef.current;
    if (!track) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    function step() {
      if (!pausedRef.current && track) {
        track.scrollLeft += AUTO_SCROLL_SPEED;
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0 && track.scrollLeft >= halfWidth) {
          track.scrollLeft -= halfWidth;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, [safeMembers.length]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, RESUME_DELAY_MS);
  }, []);

  const scrollByStep = useCallback((direction) => {
    pause();
    trackRef.current?.scrollBy({ left: direction * MANUAL_STEP, behavior: 'smooth' });
    scheduleResume();
  }, [pause, scheduleResume]);

  if (!safeMembers.length) return null;

  return (
    <section id="team" className="section reveal">
      <span className="sec-label">Faculty</span>
      <h2 className="section-title">Meet the Minds Behind the Platform</h2>
      <p className="section-subtitle">
        Distinguished pharmacologists, molecular biologists, and clinical researchers with decades of combined teaching experience.
      </p>

      <div className="team-scroll-wrap">
        <button
          type="button"
          className="team-scroll-nav prev"
          onClick={() => scrollByStep(-1)}
          aria-label="Scroll faculty left"
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>

        <div
          className="team-scroll-container"
          ref={trackRef}
          onMouseEnter={pause}
          onMouseLeave={scheduleResume}
          onTouchStart={pause}
          onTouchEnd={scheduleResume}
          onPointerDown={pause}
          onPointerUp={scheduleResume}
        >
          {loopMembers.map((member, idx) => {
            const accent = ACCENTS[idx % ACCENTS.length];
            return (
              <div key={`${member.name}-${idx}`} className={`team-card team-card-${accent}`}>
                <i className="fa-solid fa-quote-right team-card-quote"></i>
                <div className="team-avatar">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} />
                  ) : (
                    <i className="fa-solid fa-user-tie" />
                  )}
                </div>
                <h3>{member.name}</h3>
                <div className="team-title">{member.title || 'Faculty Member'}</div>
                <p>{member.bio}</p>
                <div className="team-social">
                  {member.linkedin && (
                    <a href={member.linkedin} target="_blank" rel="noreferrer">
                      <i className="fa-brands fa-linkedin-in" />
                    </a>
                  )}
                  {member.twitter && (
                    <a href={member.twitter} target="_blank" rel="noreferrer">
                      <i className="fa-brands fa-x-twitter" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="team-scroll-nav next"
          onClick={() => scrollByStep(1)}
          aria-label="Scroll faculty right"
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </section>
  );
}
