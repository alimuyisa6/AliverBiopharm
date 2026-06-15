  import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import InteractiveShowcase from '../components/InteractiveShowcase';

 function MicrobiomePersona() {
  const [answers, setAnswers] = React.useState({ diet: null, sleep: null, stress: null });
  const [showHypothetical, setShowHypothetical] = React.useState(false);
  const allAnswered = answers.diet && answers.sleep && answers.stress;
  const persona = allAnswered ? computePersona(answers) : null;
  const displayPersona = showHypothetical && persona ? computeHypothetical(persona) : persona;

  return (
    <section style={{ maxWidth: '600px', margin: '40px auto', padding: '30px', background: 'linear-gradient(135deg, #0b1a2f 0%, #122b44 100%)', borderRadius: '24px', border: '1px solid var(--clr-border-glow)', textAlign: 'center' }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(3deg); }
          75% { transform: rotate(-3deg); }
        }
        .bacteria {
          position: absolute;
          animation: float 3s ease-in-out infinite, wobble 4s ease-in-out infinite;
        }
      `}</style>
      <h3 style={{ color: 'var(--clr-cyan)', fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', marginBottom: '8px' }}>
        <span role="img" aria-label="microscope">🔬</span> Your Microbiome Persona
      </h3>
      <p style={{ color: 'var(--clr-text-dim)', marginBottom: '24px', fontSize: '0.9rem' }}>Discover the tiny universe inside you. Answer three quick questions.</p>

      {!allAnswered ? (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--clr-white)', fontWeight: 600, marginBottom: '8px' }}>What does your typical diet look like?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Plant-heavy', 'Mixed', 'Processed/meat-heavy'].map(option => (
                <button key={option} onClick={() => setAnswers(prev => ({ ...prev, diet: option }))} style={{
                  padding: '8px 18px', borderRadius: '20px', border: `2px solid ${answers.diet === option ? '#0ab5b5' : 'var(--clr-border-glow)'}`,
                  background: answers.diet === option ? '#0ab5b5' : 'transparent', color: answers.diet === option ? '#fff' : 'var(--clr-text-dim)',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                }}>{option}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--clr-white)', fontWeight: 600, marginBottom: '8px' }}>How well do you sleep on average?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Great', 'Okay', 'Poorly'].map(option => (
                <button key={option} onClick={() => setAnswers(prev => ({ ...prev, sleep: option }))} style={{
                  padding: '8px 18px', borderRadius: '20px', border: `2px solid ${answers.sleep === option ? '#0ab5b5' : 'var(--clr-border-glow)'}`,
                  background: answers.sleep === option ? '#0ab5b5' : 'transparent', color: answers.sleep === option ? '#fff' : 'var(--clr-text-dim)',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                }}>{option}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--clr-white)', fontWeight: 600, marginBottom: '8px' }}>How would you rate your stress level?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Low', 'Moderate', 'High'].map(option => (
                <button key={option} onClick={() => setAnswers(prev => ({ ...prev, stress: option }))} style={{
                  padding: '8px 18px', borderRadius: '20px', border: `2px solid ${answers.stress === option ? '#0ab5b5' : 'var(--clr-border-glow)'}`,
                  background: answers.stress === option ? '#0ab5b5' : 'transparent', color: answers.stress === option ? '#fff' : 'var(--clr-text-dim)',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                }}>{option}</button>
              ))}
            </div>
          </div>
          <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.8rem' }}>Select all three to reveal your gut profile.</p>
        </div>
      ) : (
        <div>
          <div style={{ width: '160px', height: '260px', margin: '0 auto 24px', border: '3px solid #0ab5b5', borderRadius: '0 0 80px 80px', background: 'linear-gradient(to top, rgba(10,181,181,0.15), rgba(255,255,255,0.05))', position: 'relative', overflow: 'hidden' }}>
            {displayPersona && displayPersona.bacteria.map((b, i) => (
              <div key={i} className="bacteria" style={{
                left: `${b.x}%`, top: `${b.y}%`, width: `${b.size}px`, height: b.shape === 'rod' ? `${b.size * 0.6}px` : `${b.size}px`,
                backgroundColor: b.color, borderRadius: b.shape === 'rod' ? '30% / 50%' : '50%',
                opacity: 0.85, animationDelay: `${i * 0.5}s`
              }}></div>
            ))}
            <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', textAlign: 'center', paddingBottom: '4px', fontSize: '0.65rem', color: 'var(--clr-text-dim)' }}>your inner ecosystem</div>
          </div>
          <h4 style={{ color: 'var(--clr-magenta)', fontSize: '1.2rem', margin: '0 0 4px' }}>{displayPersona.name}</h4>
          <p style={{ color: 'var(--clr-text-dim)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 20px' }}>{displayPersona.description}</p>
          <button onClick={() => setShowHypothetical(!showHypothetical)} style={{
            padding: '10px 24px', borderRadius: '30px', border: '2px solid var(--clr-magenta)', background: showHypothetical ? 'var(--clr-magenta)' : 'transparent',
            color: showHypothetical ? '#fff' : 'var(--clr-magenta)', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s', marginBottom: '12px'
          }}>
            {showHypothetical ? 'Back to my results' : 'What if I ate more fiber?'}
          </button>
          {showHypothetical && <p style={{ color: 'var(--clr-cyan)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>{displayPersona.hypotheticalNote}</p>}
          <button onClick={() => { setAnswers({ diet: null, sleep: null, stress: null }); setShowHypothetical(false); }} style={{
            display: 'block', margin: '24px auto 0', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem'
          }}>Retake Quiz</button>
        </div>
      )}
    </section>
  );

  function computePersona(answers) {
    let score = 0;
    if (answers.diet === 'Plant-heavy') score += 2;
    else if (answers.diet === 'Mixed') score += 1;
    if (answers.sleep === 'Great') score += 2;
    else if (answers.sleep === 'Okay') score += 1;
    if (answers.stress === 'Low') score += 2;
    else if (answers.stress === 'Moderate') score += 1;

    if (score >= 5) {
      return {
        name: 'The Protector',
        description: 'Rich in Bifidobacterium and Lactobacillus — you’re great at fighting off pathogens and supporting immunity.',
        bacteria: [
          { x: 20, y: 70, size: 24, color: '#0ab5b5', shape: 'circle' },
          { x: 60, y: 50, size: 20, color: '#1bc5c5', shape: 'circle' },
          { x: 40, y: 30, size: 28, color: '#0ab5b5', shape: 'rod' },
          { x: 75, y: 65, size: 22, color: '#b8873a', shape: 'rod' },
          { x: 10, y: 40, size: 18, color: '#0ab5b5', shape: 'circle' }
        ]
      };
    } else if (score >= 3) {
      return {
        name: 'The Balancer',
        description: 'A decent mix of good and opportunistic bacteria. A few tweaks could boost your resilience.',
        bacteria: [
          { x: 25, y: 60, size: 22, color: '#0ab5b5', shape: 'circle' },
          { x: 55, y: 45, size: 20, color: '#b8873a', shape: 'rod' },
          { x: 15, y: 20, size: 18, color: '#888888', shape: 'circle' },
          { x: 70, y: 70, size: 24, color: '#0ab5b5', shape: 'rod' },
          { x: 80, y: 30, size: 16, color: '#b8873a', shape: 'circle' }
        ]
      };
    } else {
      return {
        name: 'The Disruptor',
        description: 'Stress and diet may favor less friendly microbes. Small changes can make a big difference.',
        bacteria: [
          { x: 30, y: 50, size: 20, color: '#e74c3c', shape: 'circle' },
          { x: 60, y: 65, size: 18, color: '#e74c3c', shape: 'rod' },
          { x: 45, y: 30, size: 22, color: '#888888', shape: 'circle' },
          { x: 75, y: 45, size: 16, color: '#e74c3c', shape: 'rod' },
          { x: 20, y: 70, size: 20, color: '#888888', shape: 'circle' }
        ]
      };
    }
  }

  function computeHypothetical(persona) {
    return {
      ...persona,
      name: persona.name + ' (with better diet)',
      description: persona.description + ' If you shift to a plant‑heavy diet, your beneficial bacteria could thrive.',
      bacteria: persona.bacteria.map(b => b.color === '#e74c3c' ? { ...b, color: '#0ab5b5', shape: 'circle' } : b),
      hypotheticalNote: 'A fiber‑rich diet feeds Bifidobacterium and Lactobacillus, crowding out harmful species.'
    };
  }
}

export default function HomeView({
  sections,
  flashcards,
  flashcardDecks,
  flashcardShuffled,
  knownFlashcardIds,
  flashcardMode,
  flashcardCurrentDeck,
  flashcardCurrentIndex,
  flippedCards,
  flashcardSelectedLevel,
  flashcardDeckProgress,
  pdfs,
  pdfLevel,
  pdfSelectedTopic,
  notesStructure,
  notesSelectedLevel,
  notesSelectedTopic,
  notesFilterVisible,
  publicStats,
  communityActivity,
  weeklyChallengeAnswer,
  moodSelected,
  setMoodSelected,
  moodMessage,
  setMoodMessage,
  moodSubmitted,
  continueLearning,
  chatRoomId,
  chatMessages,
  chatOpen,
  chatInput,
  adminOnline,
  theme,
  currentSlide,
  mobileMenuOpen,
  contactForm,
  contactStatus,
  newsletterEmail,
  newsletterStatus,
  pdfPreviewOpen,
  previewPdf,
  notesContent,
  notesReactions,
  notesComments,
  notesCommentInput,
  groupedNotes,
  getLevelColor,
  user,
  logout,
  navigate,
  currentYear,
  handleWeeklyChallengeSubmit,
  handleContactSubmit,
  handleNewsletterSubmit,
  handleMoodSubmit,
  shuffleFlashcards,
  setFlashcardMode,
  setFlashcardCurrentDeck,
  setFlashcardCurrentIndex,
  toggleCardFlip,
  setFlashcardSelectedLevel,
  fetchPdfsByLevel,
  handlePdfPreview,
  handlePdfDownload,
  loadNoteContent,
  handleNoteReaction,
  handleNoteComment,
  toggleKnown,
  rateFlashcard,
  checkFlashcardAnswer,
  toggleFlashcardBookmark,
  speakText,
  requestChatRoom,
  sendChat,
  deleteChatMsg,
  setChatOpen,
  setChatInput,
  setMobileMenuOpen,
  setTheme,
  setContactForm,
  setNewsletterEmail,
  setPdfPreviewOpen,
  setNotesSelectedLevel,
  setNotesSelectedTopic,
  setNotesFilterVisible,
  setNotesContent,
  setNotesCommentInput,
  chatBodyRef,
}) {
  return (
    <div className="homepage">
      <header className="site-header" id="site-header">
        <div className="header-container">
          <a href="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
            ) : (
              'AliverBiopharm'
            )}
          </a>
          <nav aria-label="Main navigation">
            <ul className="main-nav" id="main-nav">
              {(sections?.navigation?.links || [{ href: '/', label: 'Home' }, { href: '#courses', label: 'Courses' }, { href: '#contact', label: 'Contact' }]).map(link => (
                <li key={link.href}><a href={link.href}>{link.label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" onClick={() => {
              const dark = document.body.classList.toggle('dark-mode');
              localStorage.setItem('theme', dark ? 'dark' : 'light');
              setTheme(dark ? 'dark' : 'light');
            }} aria-label="Toggle dark mode">
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu">
              <i className="fa-solid fa-bars"></i>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-nav-panel ${mobileMenuOpen ? 'active' : ''}`}>
        <div className="mobile-nav-panel-inner">
          <div className="mobile-nav-header">
            <div className="mobile-nav-header-row">
              <div className="mobile-auth-top">
                {user ? (
                  <button className="mobile-signout-btn" onClick={logout}><i className="fa-solid fa-right-from-bracket"></i> Sign Out</button>
                ) : (
                  <>
                    <a href="#" className="mobile-signin-btn" onClick={() => navigate('/login')}>Sign In</a>
                    <a href="#" className="mobile-signup-btn" onClick={() => navigate('/register')}>Create Account</a>
                  </>
                )}
              </div>
              <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {(sections?.navigation?.links || []).map(link => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>

      <section id="home" className="hero-carousel">
        {(sections?.hero?.slides || []).map((slide, idx) => (
          <div
            key={idx}
            className={`carousel-slide ${idx === currentSlide ? 'active' : ''}`}
            style={{
              backgroundImage: `url(${slide.background_image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <div className="slide-overlay">
              <h1 className="hero-title">{slide.title}</h1>
              <p className="hero-subtitle">{slide.subtitle}</p>
              <a href={slide.cta_link} className="btn-primary"><i className={`fa-solid ${slide.icon || 'fa-arrow-right'}`}></i> {slide.cta_text}</a>
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

      <InteractiveShowcase />

      <section id="stats" className="section reveal">
        <span className="sec-label">IMPACT</span>
        <h2 className="section-title">Our Impact in Numbers</h2>
        <div className="stats-grid">
          <div><div className="stat-number">{publicStats?.resources_count || 0}</div><div className="stat-label">Resources</div></div>
          <div><div className="stat-number">{publicStats?.users_count || 0}</div><div className="stat-label">Learners</div></div>
          <div><div className="stat-number">{publicStats?.downloads_count || 0}</div><div className="stat-label">Downloads</div></div>
          <div><div className="stat-number">{publicStats?.quiz_attempts || 0}</div><div className="stat-label">Quiz Attempts</div></div>
        </div>
      </section>

      <section id="daily-fact" className="section reveal" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
        {sections?.weekly_challenge && sections.weekly_challenge.question && (
          <div className="weekly-challenge-card">
            <div className="challenge-badge">WEEKLY CHALLENGE</div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--clr-cyan)' }}><i className="fa-solid fa-trophy" style={{ color: 'var(--clr-magenta)' }}></i> {sections.weekly_challenge.question}</h3>
            {!weeklyChallengeAnswer ? (
              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                {sections.weekly_challenge.options.map((opt, i) => (
                  <button key={i} className="quiz-option-btn" onClick={() => handleWeeklyChallengeSubmit(i, sections.weekly_challenge.correct, sections.weekly_challenge.explanation)}>
                    {String.fromCharCode(65 + i)}) {opt}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <i className={`fa-solid fa-${weeklyChallengeAnswer.correct ? 'check-circle' : 'times-circle'}`} style={{ color: weeklyChallengeAnswer.correct ? '#0ab5b5' : '#e74c3c' }}></i>
                {weeklyChallengeAnswer.correct ? ' Correct!' : ' Incorrect.'} {String.fromCharCode(65 + sections.weekly_challenge.correct)}) {sections.weekly_challenge.options[sections.weekly_challenge.correct]}
                <br /><small>{weeklyChallengeAnswer.explanation}</small>
              </p>
            )}
          </div>
        )}
        {sections?.daily_facts?.default?.[0] && (
          <div className="daily-fact-card">
            <div className="daily-fact-icon"><i className="fa-solid fa-flask"></i></div>
            <div><p style={{ fontWeight: 700, color: 'var(--clr-cyan)' }}>SCIENCE FACT OF THE DAY</p><p>{sections.daily_facts.default[0].fact}</p></div>
          </div>
        )}
      </section>

      <section id="mood-check" className="section reveal" style={{ paddingTop: '20px', paddingBottom: '20px' }}>
        <div className="mood-section">
          <h3 style={{ textAlign: 'center', color: 'var(--clr-white)' }}><i className="fa-solid fa-face-smile" style={{ color: 'var(--clr-magenta)' }}></i> How are you feeling about your studies?</h3>
          <div className="mood-emojis">
            {['struggling', 'confused', 'okay', 'good', 'great'].map(m => (
              <button key={m} className={`mood-emoji ${moodSelected === m ? 'selected' : ''}`} onClick={() => setMoodSelected(m)}>
                {m === 'struggling' ? '😭' : m === 'confused' ? '🤔' : m === 'okay' ? '😐' : m === 'good' ? '😊' : '🚀'}
              </button>
            ))}
          </div>
          {moodSelected && !moodSubmitted && (
            <div style={{ textAlign: 'center' }}>
              <textarea className="form-input" placeholder="Tell us more (optional)..." value={moodMessage} onChange={e => setMoodMessage(e.target.value)} style={{ width: '100%', maxWidth: '400px' }}></textarea>
              <button className="btn-primary" onClick={handleMoodSubmit}>Submit <i className="fa-solid fa-paper-plane"></i></button>
            </div>
          )}
          {moodSubmitted && <div style={{ textAlign: 'center', color: 'var(--clr-cyan)' }}>Thanks for sharing!</div>}
        </div>
      </section>

      {user && (continueLearning.views.length > 0 || continueLearning.favorites.length > 0 || continueLearning.streak > 0) && (
        <section id="continue-learning" className="section reveal">
          <span className="sec-label">YOUR JOURNEY</span>
          <h2 className="section-title">Continue Learning</h2>
          <div className="continue-learning-grid">
            {continueLearning.streak > 0 && (
              <div className="continue-card"><i className="fa-solid fa-fire" style={{ color: 'var(--clr-magenta)' }}></i> <strong>{continueLearning.streak}-Day Streak</strong><p style={{ fontSize: '0.8rem' }}>Keep it up!</p></div>
            )}
            {continueLearning.views.length > 0 && (
              <div className="continue-card"><strong>Recent Views</strong><ul style={{ listStyle: 'none' }}>{continueLearning.views.map(v => <li key={v.resource_id}><a href="#" style={{ color: 'var(--clr-cyan)' }}>{v.title}</a></li>)}</ul></div>
            )}
            {continueLearning.favorites.length > 0 && (
              <div className="continue-card"><strong>Favorites</strong><ul style={{ listStyle: 'none' }}>{continueLearning.favorites.slice(0,3).map(f => <li key={f.resource_id}>{f.title}</li>)}</ul></div>
            )}
          </div>
        </section>
      )}

      <MicrobiomePersona />
      
      <section id="pdf-library" className="section-wrapper" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label" style={{ textAlign: 'left' }}>PDF RESOURCES</span>
            <h2 className="pdf-section-title" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(2rem,5vw,3rem)', margin: 0, background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textAlign: 'left' }}>Study Materials Library</h2>
            <p className="section-subtitle" style={{ textAlign: 'left' }}>Access comprehensive PDF resources for Biology and Pharmacy. Preview before downloading.</p>
          </div>
          <div className="pdf-main-container">
            <div className="pdf-level-bar">
              {['O-Level', 'A-Level', 'Pharmacy'].map(level => (
                <button key={level} className={`pdf-level-btn ${pdfLevel === level ? 'active' : ''}`} onClick={() => { fetchPdfsByLevel(level); setPdfLevel(level); setPdfSelectedTopic(null); }}>
                  {level}
                </button>
              ))}
            </div>
            <div className="pdf-content-wrapper">
              <div className="pdf-cards-area">
                {pdfs.length === 0 ? (
                  <div className="pdf-loading">No PDFs available for this level.</div>
                ) : (
                  <>
                    {Array.from(new Set(pdfs.map(p => p.topic || 'General'))).map(topic => (
                      <div key={topic} className="pdf-topic-group" style={{ marginBottom: '28px' }}>
                        <h4 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--clr-magenta)', borderLeft: '4px solid var(--clr-cyan)', paddingLeft: '12px', marginBottom: '14px' }}>{topic}</h4>
                        <div className="pdf-cards-grid">
                          {pdfs.filter(p => (p.topic || 'General') === topic).map(pdf => (
                            <div key={pdf.id} className="pdf-card" onClick={() => handlePdfPreview(pdf)}>
                              <div className="pdf-card-icon"><i className="fa-solid fa-file-pdf"></i></div>
                              <div className="pdf-card-title">{pdf.title.length > 45 ? pdf.title.substring(0,42)+'...' : pdf.title}</div>
                              <div className="pdf-card-author">{pdf.author || 'Unknown'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="pdf-subtopics-column">
                <div className="pdf-subtopics-header">Browse Topics</div>
                <div className="pdf-subtopics-list">
                  {Array.from(new Set(pdfs.map(p => p.topic || 'General'))).map(topic => (
                    <div key={topic} className={`pdf-subtopic-item ${pdfSelectedTopic === topic ? 'active' : ''}`} onClick={() => setPdfSelectedTopic(topic)}>
                      <div className="pdf-subtopic-title">{topic}</div>
                      <div className="pdf-subtopic-author">{pdfs.filter(p => (p.topic || 'General') === topic).length} resources</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="flashcards" className="section reveal">
        <span className="sec-label">STUDY TOOLS</span>
        <h2 className="section-title">{sections?.section_headings?.flashcards_title || 'Transform the way you retain complex scientific concepts through active recall and spaced repetition'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.flashcards_subtitle || 'Active recall is the most effective way to retain complex scientific concepts. Flip each card to reveal detailed answers and mark your progress.'}</p>
        <div className="flashcard-filter">
          <i className="fa-solid fa-filter" style={{ color: 'var(--clr-cyan)' }}></i>
          <label htmlFor="level-select">Filter by Level:</label>
          <select id="level-select" value={flashcardSelectedLevel} onChange={e => setFlashcardSelectedLevel(e.target.value)}>
            <option value="">All Levels</option>
            <option value="O-Level">O-Level</option>
            <option value="A-Level">A-Level</option>
            <option value="Pharmacy">Pharmacy</option>
          </select>
          <span id="deck-count" style={{ fontSize: '.8rem', color: 'var(--clr-text-muted)', marginLeft: 'auto' }}></span>
        </div>
        <div className="mode-toggle">
          <button className={`mode-btn ${flashcardMode === 'study' ? 'active' : ''}`} onClick={() => setFlashcardMode('study')}><i className="fa-solid fa-eye"></i> Study Mode</button>
          <button className={`mode-btn ${flashcardMode === 'quiz' ? 'active' : ''}`} onClick={() => setFlashcardMode('quiz')}><i className="fa-solid fa-pen-to-square"></i> Quiz Mode</button>
          <button className="shuffle-btn" onClick={shuffleFlashcards}><i className="fa-solid fa-shuffle"></i> Shuffle</button>
        </div>
        <div id="flashcards-container">
          {Object.entries(flashcardShuffled).map(([deckName, cards]) => (
            <div key={deckName} className="flashcard-category" data-category={deckName}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--clr-magenta)', fontSize: '1.35rem', borderLeft: '4px solid var(--clr-cyan)', paddingLeft: '14px' }}><i className="fa-solid fa-layer-group"></i> {deckName} <span style={{ fontSize: '0.8rem' }}>({cards.length} cards)</span></h3>
                <button className="btn-download" onClick={() => { setFlashcardCurrentDeck(deckName); setFlashcardCurrentIndex(0); }}><i className="fa-solid fa-play"></i> Study</button>
              </div>
              <div className="flashcard-grid">
                {cards.slice(0, flashcardCurrentDeck === deckName ? cards.length : 3).map((card, idx) => (
                  <div key={card.id} className="flashcard-deck" data-id={card.id}>
                    <div
                      className={`flashcard-face ${flippedCards[card.id] ? 'flipped' : ''} ${flashcardCurrentDeck === deckName && flashcardCurrentIndex === idx ? 'active-card' : ''}`}
                      onClick={() => toggleCardFlip(card.id, deckName, idx)}
                    >
                      <div className="front">
                        {card.image_url && <div className="flashcard-image-wrap"><img src={card.image_url} alt="" /></div>}
                        <div className="flashcard-question"><strong>{card.front_text}</strong></div>
                        <button
                          className="speak-btn"
                          onClick={(e) => { e.stopPropagation(); speakText(card.front_text); }}
                          aria-label="Read question aloud"
                        >
                          <i className="fa-solid fa-volume-high"></i>
                        </button>
                      </div>
                      <div className="back">
                        {card.back_text}
                        <button
                          className="speak-btn"
                          onClick={(e) => { e.stopPropagation(); speakText(card.back_text); }}
                          aria-label="Read answer aloud"
                        >
                          <i className="fa-solid fa-volume-high"></i>
                        </button>
                      </div>
                    </div>
                    {flashcardMode === 'quiz' && (
                      <div className="quiz-input-container">
                        <input type="text" className="quiz-answer-input" placeholder="Type your answer..." />
                        <button className="quiz-check-btn" onClick={async (e) => {
                          const input = e.target.previousElementSibling;
                          const result = await checkFlashcardAnswer(card.id, input.value);
                          const resultDiv = e.target.parentElement.nextElementSibling;
                          if (result.correct) {
                            resultDiv.innerHTML = '<i className="fa-solid fa-circle-check"></i> Correct!';
                            resultDiv.className = 'quiz-result correct';
                          } else {
                            resultDiv.innerHTML = `<i className="fa-solid fa-circle-xmark"></i> Incorrect. Correct answer: ${result.correct_answer}`;
                            resultDiv.className = 'quiz-result incorrect';
                          }
                          resultDiv.style.display = 'flex';
                          setTimeout(() => { resultDiv.style.display = 'none'; }, 3000);
                        }}><i className="fa-solid fa-check"></i></button>
                      </div>
                    )}
                    <div className="difficulty-rating">
                      <button className="difficulty-btn easy" onClick={() => rateFlashcard(card.id, 'easy')}>Easy</button>
                      <button className="difficulty-btn medium" onClick={() => rateFlashcard(card.id, 'medium')}>Medium</button>
                      <button className="difficulty-btn hard" onClick={() => rateFlashcard(card.id, 'hard')}>Hard</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <button className={`bookmark-btn ${knownFlashcardIds.includes(card.id) ? 'bookmarked' : ''}`} onClick={() => toggleFlashcardBookmark(card.id)}><i className="fa-solid fa-bookmark"></i></button>
                      <button className="btn-download" onClick={(e) => toggleKnown(card.id, e.target)}>{knownFlashcardIds.includes(card.id) ? 'Known' : 'Mark Known'}</button>
                    </div>
                  </div>
                ))}
                {cards.length > 3 && flashcardCurrentDeck !== deckName && (
                  <div className="flashcard-deck" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => { setFlashcardCurrentDeck(deckName); setFlashcardCurrentIndex(0); }}>
                    <div style={{ textAlign: 'center', color: 'var(--clr-cyan)' }}><i className="fa-solid fa-ellipsis" style={{ fontSize: '2rem' }}></i><p>Show all {cards.length} cards</p></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="keyboard-hint"><i className="fa-regular fa-keyboard"></i> Keyboard: ← → navigate | Space flip | 1-3 rate difficulty</p>
      </section>

      <section id="notes-section" className="section-wrapper" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label" style={{ textAlign: 'left' }}>STUDY NOTES</span>
            <h2 className="pdf-section-title" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(2rem,5vw,3rem)', margin: 0, background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textAlign: 'left' }}>Notes Library</h2>
            <p className="section-subtitle" style={{ textAlign: 'left' }}>Comprehensive study notes for Biology and Pharmacy. Structured by level, topic, and subtopic.</p>
          </div>
          <div style={{ background: 'var(--clr-navy-card)', backdropFilter: 'blur(12px)', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px' }}>
              <button className="btn-primary" onClick={() => setNotesFilterVisible(!notesFilterVisible)} style={{ marginBottom: '20px' }}><i className="fa-solid fa-filter"></i> Browse Notes by Level</button>
              {notesFilterVisible && (
                <div id="notes-filter-area">
                  <div id="notes-level-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {Object.keys(groupedNotes).map(level => (
                      <button key={level} className="level-btn" style={{ background: notesSelectedLevel === level ? 'var(--clr-cyan)' : 'transparent', border: `2px solid ${getLevelColor(level)}`, color: notesSelectedLevel === level ? '#fff' : 'var(--clr-white)', padding: '8px 24px', borderRadius: '50px', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setNotesSelectedLevel(level); setNotesSelectedTopic(null); setNotesContent(null); }}>
                        {level}
                      </button>
                    ))}
                  </div>
                  {notesSelectedLevel && (
                    <div id="notes-topics-container" style={{ marginBottom: '20px' }}>
                      <h4 style={{ color: 'var(--clr-magenta)', marginBottom: '12px' }}><i className="fa-solid fa-folder-tree"></i> Topics</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {Object.keys(groupedNotes[notesSelectedLevel] || {}).map(topic => (
                          <button key={topic} className="topic-btn" style={{ background: notesSelectedTopic === topic ? 'var(--clr-magenta)' : 'rgba(184,135,58,0.15)', border: '1px solid var(--clr-magenta)', color: notesSelectedTopic === topic ? '#fff' : 'var(--clr-magenta)', padding: '6px 18px', borderRadius: '50px', cursor: 'pointer' }} onClick={() => { setNotesSelectedTopic(topic); setNotesContent(null); }}>
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {notesSelectedTopic && (
                    <div id="notes-subtopics-container">
                      <h4 style={{ color: 'var(--clr-cyan)', margin: '16px 0' }}><i className="fa-solid fa-file-lines"></i> Study Notes</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                        {groupedNotes[notesSelectedLevel][notesSelectedTopic].map(item => (
                          <div key={item.subtopic_id} className="subtopic-card" style={{ background: 'var(--clr-navy-card)', borderRadius: '20px', border: '1px solid var(--clr-border-glow)', overflow: 'hidden' }}>
                            <div style={{ padding: '20px' }}>
                              <span className="topic-badge" style={{ background: 'rgba(184,135,58,0.12)', color: 'var(--clr-magenta)', padding: '4px 14px', borderRadius: '30px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-block', marginBottom: '16px' }}>{notesSelectedTopic}</span>
                              <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.3rem', fontWeight: 700, margin: '12px 0 8px', color: 'var(--clr-white)' }}>{item.subtopic_name}</h3>
                              <p className="subtopic-preview" style={{ color: 'var(--clr-text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '20px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.subtopic_preview || 'Comprehensive study notes covering key concepts.'}</p>
                              <button
                                className="read-note-btn"
                                onClick={() => navigate(`/notes/read?id=${item.subtopic_id}`)}
                                style={{ width: '100%', background: 'transparent', border: '2px solid var(--clr-cyan)', color: 'var(--clr-cyan)', padding: '12px 20px', borderRadius: '50px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                <i className="fa-solid fa-book-open-reader"></i> Read This Note
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {notesContent && (
                <div id="notes-content-area" style={{ marginTop: '24px' }}>
                  <div className="notes-content-container">
                    <h1>{notesContent.subtopicName}</h1>
                    <div dangerouslySetInnerHTML={{ __html: notesContent.content || '<p>No content available.</p>' }} />
                    <div className="notes-reaction-bar">
                      <button className={`reaction-btn ${notesReactions?.user_reaction === 'like' ? 'active' : ''}`} onClick={() => handleNoteReaction(notesContent.subtopicId, 'like')}><i className="fa-regular fa-thumbs-up"></i> <span className="reaction-count">{notesReactions?.counts.like || 0}</span></button>
                      <button className={`reaction-btn ${notesReactions?.user_reaction === 'love' ? 'active' : ''}`} onClick={() => handleNoteReaction(notesContent.subtopicId, 'love')}><i className="fa-regular fa-heart"></i> <span>{notesReactions?.counts.love || 0}</span></button>
                      <button className={`reaction-btn ${notesReactions?.user_reaction === 'helpful' ? 'active' : ''}`} onClick={() => handleNoteReaction(notesContent.subtopicId, 'helpful')}><i className="fa-regular fa-lightbulb"></i> <span>{notesReactions?.counts.helpful || 0}</span></button>
                    </div>
                    <div className="comment-section">
                      <div className="comment-input-group">
                        <input type="text" className="form-input" placeholder="Add a comment..." value={notesCommentInput} onChange={e => setNotesCommentInput(e.target.value)} />
                        <button className="btn-primary" onClick={() => handleNoteComment(notesContent.subtopicId)}>Post</button>
                      </div>
                      <div className="comment-list">
                        {notesComments.map(c => (
                          <div key={c.created_at} className="comment-item"><strong>{c.user_name}</strong> <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</span><br />{c.comment}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="team" className="section reveal">
        <span className="sec-label">FACULTY</span>
        <h2 className="section-title">{sections?.section_headings?.team_title || 'Guided by distinguished pharmacologists and molecular biologists'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.team_subtitle || 'Learn from distinguished pharmacologists, molecular biologists, and clinical researchers with decades of combined teaching experience.'}</p>
        <div className="team-scroll-container">
          {(sections?.team?.members || []).map(member => (
            <div key={member.name} className="team-card" style={{ minWidth: '280px' }}>
              <div className="team-avatar">{member.avatar_url ? <img src={member.avatar_url} alt={member.name} /> : <i className="fa-solid fa-user-tie"></i>}</div>
              <h3>{member.name}</h3>
              <div className="team-title">{member.title || 'Faculty Member'}</div>
              <p>{member.bio}</p>
              <div className="team-social">
                {member.linkedin && <a href={member.linkedin} target="_blank"><i className="fa-brands fa-linkedin-in"></i></a>}
                {member.twitter && <a href={member.twitter} target="_blank"><i className="fa-brands fa-x-twitter"></i></a>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="testimonials" className="section alt-bg reveal">
        <span className="sec-label">TESTIMONIALS</span>
        <h2 className="section-title">{sections?.section_headings?.testimonials_title || 'Real stories from learners who mastered biology and pharmacy through our structured approach'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.testimonials_subtitle || 'Hear from students who transformed their understanding of biology and pharmacy through our structured learning approach.'}</p>
        <div className="testimonial-slider">
          {sections?.testimonials?.quotes && sections.testimonials.quotes.length > 0 && (
            <>
              <blockquote className="testimonial-quote">"{sections.testimonials.quotes[0].text}"</blockquote>
              <cite className="testimonial-author">— {sections.testimonials.quotes[0].author}</cite>
            </>
          )}
        </div>
      </section>

      <section id="community" className="section alt-bg reveal">
        <span className="sec-label">COMMUNITY</span>
        <h2 className="section-title">Live Learning Stream</h2>
        <div className="community-stream">
          {communityActivity.map((act, idx) => (
            <div key={idx} className="stream-item"><i className={`fa-solid fa-${act.type === 'download' ? 'download' : 'graduation-cap'}`} style={{ color: 'var(--clr-cyan)' }}></i> <span>{act.message}</span><small style={{ marginLeft: 'auto', color: 'var(--clr-text-muted)' }}>{new Date(act.time).toLocaleDateString()}</small></div>
          ))}
        </div>
      </section>

      <section id="pricing" className="section alt-bg reveal">
        <span className="sec-label">MEMBERSHIP</span>
        <h2 className="section-title">{sections?.section_headings?.pricing_title || 'Invest in your future with flexible plans designed to grow alongside your learning journey'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.pricing_subtitle || 'Choose the plan that fits your learning journey. All plans include access to our complete resource library with regular updates.'}</p>
        <div className="grid-3">
          {(sections?.pricing?.plans || []).map(plan => (
            <div key={plan.name} className={`card pricing-card ${plan.featured ? 'featured' : ''}`}>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="price my-3">{plan.price}<span style={{ fontSize: '1rem' }}>{plan.period}</span></div>
              <ul className="pricing-features">{plan.features?.map(f => <li key={f}><i className="fa-solid fa-check"></i> {f}</li>)}</ul>
              <button className="btn-primary mt-4" style={{ width: 'auto', display: 'inline-flex', margin: '0 auto' }}>{plan.cta_text || 'Subscribe'}</button>
            </div>
          ))}
        </div>
      </section>

      <section id="blog" className="section alt-bg reveal">
        <span className="sec-label">INSIGHTS</span>
        <h2 className="section-title">{sections?.section_headings?.blog_title || 'Deepen your understanding with insights from leading voices in biology, pharmacy, and research'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.blog_subtitle || 'Stay informed with the latest developments in biology, pharmacy, and life sciences from our expert contributors.'}</p>
        <div className="grid-3">
          {(sections?.blog?.posts || []).map(post => (
            <article key={post.title} className="card">
              {post.image_url && <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }} />}
              <div className="flex gap-4 text-xs" style={{ color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}><span><i className="fa-regular fa-calendar"></i> {post.date}</span><span><i className="fa-regular fa-user"></i> {post.author}</span></div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.15rem', color: 'var(--clr-white)' }}>{post.title}</h3>
              <p style={{ fontSize: '0.84rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>{post.excerpt}</p>
              <a href="#" style={{ color: 'var(--clr-magenta)', fontWeight: 600, fontSize: '0.875rem' }}>Read Article <i className="fa-solid fa-arrow-right"></i></a>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="section reveal">
        <span className="sec-label">FAQ</span>
        <h2 className="section-title">{sections?.section_headings?.faq_title || 'Clear answers to the questions learners ask most about our platform and methodology'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.faq_subtitle || 'Quick answers to common questions about our platform, courses, resources, and membership options.'}</p>
        <div className="faq-list">
          {(sections?.faq?.items || []).map((item, idx) => (
            <div key={idx} className="faq-item">
              <button className="faq-question" onClick={e => e.currentTarget.parentElement.classList.toggle('active')}><span>{item.question}</span><span style={{ color: 'var(--clr-cyan)' }}>+</span></button>
              <div className="faq-answer"><p>{item.answer}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="section alt-bg reveal">
        <span className="sec-label">SUPPORT</span>
        <h2 className="section-title">{sections?.section_headings?.contact_title || 'Reach out to our dedicated team who are ready to support your learning goals within 24 hours'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.contact_subtitle || 'Have questions or feedback? Our support team typically responds within 24 hours.'}</p>
        <div className="grid-2">
          <form id="contact-form" onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div><label className="f-label">FULL NAME</label><input type="text" className="f-input" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} required /></div>
            <div><label className="f-label">EMAIL ADDRESS</label><input type="email" className="f-input" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} required /></div>
            <div><label className="f-label">SUBJECT</label><input type="text" className="f-input" value={contactForm.subject} onChange={e => setContactForm({ ...contactForm, subject: e.target.value })} required /></div>
            <div><label className="f-label">MESSAGE</label><textarea className="f-input" rows={4} value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} required></textarea></div>
            <button type="submit" className="f-btn"><i className="fa-solid fa-paper-plane"></i> Send Message</button>
            {contactStatus && <div style={{ color: contactStatus.success ? 'var(--clr-cyan)' : '#e74c3c', textAlign: 'center' }}>{contactStatus.message}</div>}
          </form>
          <aside className="contact-info-card" id="contact-info-card">
            <div className="text-center mb-4"><i className="fa-solid fa-headset text-4xl" style={{ color: 'var(--clr-cyan)' }}></i><h3 style={{ marginTop: '.5rem', fontSize: '1.1rem', fontWeight: 600 }}>24/7 Support</h3></div>
            {(sections?.contact?.info || []).map(info => (
              <div key={info.label} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0', borderBottom: '1px solid var(--clr-border-glow)' }}>
                <div className="contact-icon"><i className={info.icon}></i></div>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{info.label}</div><a href={info.href} style={{ color: 'var(--clr-white)', textDecoration: 'none' }}>{info.value}</a></div>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <section className="section reveal">
        <span className="sec-label">UPDATES</span>
        <h2 className="section-title">Stay Updated</h2>
        <p className="section-subtitle">Join our community of learners. Get weekly insights, study tips, and new resource alerts.</p>
        <form id="newsletter-form" onSubmit={handleNewsletterSubmit}>
          <div className="newsletter-box">
            <input type="email" placeholder="Enter your email address" value={newsletterEmail} onChange={e => setNewsletterEmail(e.target.value)} required />
            <button type="submit">Subscribe <i className="fa-solid fa-paper-plane"></i></button>
          </div>
          {newsletterStatus && <div style={{ textAlign: 'center', marginTop: '8px', color: newsletterStatus.success ? 'var(--clr-cyan)' : '#e74c3c' }}>{newsletterStatus.message}</div>}
        </form>
      </section>

      <footer className="footer-fat">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '260px' }}>
            <a href="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
              {sections?.site_config?.logo_url ? <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} /> : 'AliverBiopharm'}
            </a>
            <p style={{ fontSize: '.85rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>Advancing biology and pharmacy education for every learner.</p>
            <div className="footer-social">
              {(sections?.footer?.social_links || []).map(s => (
                <a key={s.platform} href={s.url} target="_blank"><i className={s.icon}></i></a>
              ))}
            </div>
          </div>
          <div className="footer-grid">
            {(sections?.footer?.columns || []).map(col => (
              <div key={col.heading}>
                <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>{col.heading}</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.items?.map(item => (
                    <li key={item.label}><a href={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>{item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}{item.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 'var(--max-width)', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--clr-text-muted)' }}>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
          <nav style={{ display: 'flex', gap: '22px' }}>
            <a href="/privacy" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Terms of Use</a>
            <a href="/accessibility" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Accessibility</a>
          </nav>
        </div>
      </footer>

      <button className="back-to-top" id="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><i className="fa-solid fa-arrow-up"></i></button>

      <a href="#pricing" className="sticky-cta"><i className="fa-solid fa-rocket"></i> Start Learning</a>

      <div className="chat-widget-container">
        <button className="chat-bubble-btn" onClick={requestChatRoom}>💬</button>
        {chatOpen && (
          <div className="chat-window open">
            <div className="chat-header">
              <span><span className={`admin-dot ${adminOnline ? 'online' : 'offline'}`}></span> Support</span>
              <button className="chat-close-btn" onClick={() => setChatOpen(false)}>✕</button>
            </div>
            <div className="chat-body" ref={chatBodyRef}>
              {chatMessages.map(msg => (
                <div key={msg.id} className={`chat-msg ${msg.sender_type === 'user' ? 'user' : 'admin'}`}>
                  <strong>{msg.sender_type === 'user' ? 'You' : 'Admin'}:</strong> {msg.content}
                  {msg.sender_type === 'user' && <button className="chat-clear-btn" onClick={() => deleteChatMsg(msg.id)}>✖</button>}
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <input type="text" className="chat-input" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendChat()} />
              <button className="chat-send-btn" onClick={sendChat}>Send</button>
            </div>
          </div>
        )}
      </div>

      {pdfPreviewOpen && previewPdf && (
        <div className="pdf-preview-modal active" onClick={() => setPdfPreviewOpen(false)}>
          <div className="pdf-preview-content" onClick={e => e.stopPropagation()}>
            <div className="pdf-preview-header"><h3>{previewPdf.title}</h3><button className="pdf-preview-close" onClick={() => setPdfPreviewOpen(false)}>&times;</button></div>
            <div className="pdf-preview-body"><iframe src={previewPdf.file_url} frameBorder="0" style={{ width: '100%', height: '100%' }}></iframe></div>
            <div className="pdf-preview-footer">
              <button className="pdf-preview-download-btn" onClick={() => handlePdfDownload(previewPdf)}>Download PDF</button>
              <button className="pdf-preview-back-btn" onClick={() => setPdfPreviewOpen(false)}>Back to Library</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
