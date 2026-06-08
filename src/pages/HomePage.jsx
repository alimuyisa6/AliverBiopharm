 import useAuth from '../hooks/useAuth';

function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section id="home" className="hero-carousel" aria-label="Hero carousel">
        <div className="carousel-slide active" style={{ background: 'linear-gradient(135deg,#0a4f4f,#0e7070)' }}>
          <div className="slide-overlay">
            <h1 className="font-display font-black text-4xl md:text-6xl mb-4 hero-title">Welcome to AliverBiopharm</h1>
            <p className="text-lg md:text-xl max-w-2xl mb-8 hero-subtitle">Advanced Biology & Pharmacy Learning Platform</p>
            <a href="#courses" className="btn-primary"><i className="fa-solid fa-arrow-right" aria-hidden="true"></i> Explore Resources</a>
          </div>
        </div>
      </section>

      <section id="hero-title-section" className="section reveal" style={{ paddingTop: '20px', paddingBottom: '0' }} aria-label="AliverBiopharm Hero Title">
        <div className="dynamic-hero-container" id="dynamic-hero-container">
          <h1 className="dynamic-main-title" id="dynamic-main-title">
            <span className="title-word magenta-word">Aliver</span>
            <span className="title-word cyan-word">Biopharm</span>
          </h1>
          <div className="title-sub-line" id="title-sub-line">
            <span className="sub-word">Advanced</span>
            <span className="sub-word">Biology</span>
            <span className="sub-word magenta-word">&</span>
            <span className="sub-word cyan-word">Pharmacy</span>
            <span className="sub-word">Learning</span>
            <span className="sub-word">Platform</span>
          </div>
        </div>
      </section>

      <section id="daily-fact" className="section reveal" style={{ paddingTop: '30px', paddingBottom: '30px' }} aria-label="Daily fact and weekly challenge"></section>

      <section id="mood-check" className="section reveal" style={{ paddingTop: '20px', paddingBottom: '20px' }} aria-label="How are you feeling?">
        <div className="mood-section">
          <h3 style={{ textAlign: 'center', color: 'var(--clr-white)', marginBottom: '.5rem' }}><i className="fa-solid fa-face-smile" style={{ color: 'var(--clr-magenta)' }}></i> How are you feeling about your studies?</h3>
          <div className="mood-emojis" id="mood-emojis">
            <button className="mood-emoji" data-mood="struggling" title="Struggling">😭</button>
            <button className="mood-emoji" data-mood="confused" title="Confused">🤔</button>
            <button className="mood-emoji" data-mood="okay" title="Okay">😐</button>
            <button className="mood-emoji" data-mood="good" title="Good">😊</button>
            <button className="mood-emoji" data-mood="great" title="Great!">🚀</button>
          </div>
          <div id="mood-message-form" style={{ display: 'none', textAlign: 'center' }}>
            <textarea id="mood-message" placeholder="Tell us more (optional)..." style={{ width: '100%', maxWidth: '400px', padding: '8px', borderRadius: '10px', border: '1px solid var(--clr-border-glow)', background: 'rgba(10,181,181,.05)', color: 'var(--clr-white)', resize: 'vertical', minHeight: '60px', fontFamily: 'var(--font-body)', fontSize: '.85rem' }}></textarea>
            <br />
            <button className="btn-primary" id="mood-submit-btn" style={{ marginTop: '8px', fontSize: '.8rem', padding: '8px 20px' }}>Submit <i className="fa-solid fa-paper-plane"></i></button>
          </div>
          <div id="mood-response" style={{ textAlign: 'center', color: 'var(--clr-cyan)', marginTop: '8px', display: 'none' }}></div>
        </div>
      </section>

      <section id="continue-learning" className="section reveal" style={{ display: isAuthenticated ? 'block' : 'none' }} aria-label="Continue learning"></section>

      <section id="team" className="section reveal" aria-label="Faculty">
        <span className="sec-label">FACULTY</span>
        <h2 className="section-title">Meet Our Expert Faculty</h2>
        <p className="section-subtitle">Learn from distinguished pharmacologists and molecular biologists.</p>
        <div className="grid-3" id="team-grid"><p style={{ textAlign: 'center', gridColumn: '1/-1', color: 'var(--clr-text-dim)' }}>Loading…</p></div>
      </section>

      <section id="testimonials" className="section alt-bg reveal" aria-label="Testimonials">
        <span className="sec-label">TESTIMONIALS</span>
        <h2 className="section-title">Learner Success Stories</h2>
        <div className="testimonial-slider" id="testimonial-slider">Loading…</div>
      </section>

      <section id="courses" className="section reveal" aria-label="Learning resources">
        <span className="sec-label">LEARNING TOOLS</span>
        <h2 className="section-title">Learning Resources</h2>
        <p className="section-subtitle">Browse our comprehensive library of biology and pharmacy materials.</p>
        <div className="filter-bar">
          <div className="filter-bar-inner">
            <button className="filter-toggle-btn" id="filter-toggle-btn"><i className="fa-solid fa-filter" aria-hidden="true"></i> Filter Resources <i className="fa-solid fa-chevron-down" id="filter-chevron" aria-hidden="true"></i></button>
            <div className="filter-dropdown" id="filter-dropdown" style={{ display: 'none' }}>
              <input type="text" className="f-input" id="resource-search" placeholder="Search resources..." />
              <div className="filter-accordion">
                <button className="filter-accordion-btn" data-filter="level"><span>Level</span><span className="filter-selected" id="selected-level">All Levels</span><i className="fa-solid fa-chevron-down"></i></button>
                <div className="filter-options" id="filter-options-level">
                  <label className="filter-option"><input type="radio" name="level" value="" defaultChecked /> All Levels</label>
                  <label className="filter-option"><input type="radio" name="level" value="O-Level" /> O-Level</label>
                  <label className="filter-option"><input type="radio" name="level" value="A-Level" /> A-Level</label>
                  <label className="filter-option"><input type="radio" name="level" value="Pharmacy" /> Pharmacy</label>
                </div>
              </div>
              <div className="filter-accordion">
                <button className="filter-accordion-btn" data-filter="category"><span>Category</span><span className="filter-selected" id="selected-category">All Categories</span><i className="fa-solid fa-chevron-down"></i></button>
                <div className="filter-options" id="filter-options-category">
                  <label className="filter-option"><input type="radio" name="category" value="" defaultChecked /> All Categories</label>
                </div>
              </div>
              <button className="btn-primary" id="filter-apply">Apply Filters</button>
              <button className="filter-clear-btn" id="filter-clear">Clear All</button>
            </div>
          </div>
        </div>
        <div id="resources-container">Loading resources…</div>
      </section>

      <section id="flashcards" className="section reveal" aria-label="Flashcards">
        <span className="sec-label">STUDY TOOLS</span>
        <h2 className="section-title">Flashcard Decks</h2>
        <div className="flashcard-filter" id="flashcard-filter">
          <i className="fa-solid fa-filter" style={{ color: 'var(--clr-cyan)' }}></i>
          <label htmlFor="level-select">Filter by Level:</label>
          <select id="level-select">
            <option value="">All Levels</option>
            <option value="O-Level">O-Level</option>
            <option value="A-Level">A-Level</option>
            <option value="Pharmacy">Pharmacy</option>
          </select>
          <span id="deck-count"></span>
        </div>
        <div className="mode-toggle" id="mode-toggle">
          <button className="mode-btn active" data-mode="study"><i className="fa-solid fa-eye"></i> Study Mode</button>
          <button className="mode-btn" data-mode="quiz"><i className="fa-solid fa-pen-to-square"></i> Quiz Mode</button>
          <button className="shuffle-btn" id="shuffle-btn"><i className="fa-solid fa-shuffle"></i> Shuffle</button>
        </div>
        <div id="flashcards-container"></div>
        <p className="keyboard-hint"><i className="fa-regular fa-keyboard"></i> Keyboard shortcuts: ← → Space 1-3</p>
      </section>

      <section id="pdf-library" className="section reveal" aria-label="PDF Library" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label" style={{ textAlign: 'left', marginBottom: '8px', display: 'block' }}>PDF RESOURCES</span>
            <h2 className="pdf-section-title" style={{ fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(2rem,5vw,3rem)', margin: 0, background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textAlign: 'left' }}>Study Materials Library</h2>
            <p className="section-subtitle" style={{ textAlign: 'left', margin: '8px 0 0 0', maxWidth: '600px' }}>Access comprehensive PDF resources for Biology and Pharmacy. Preview before downloading.</p>
          </div>
          <div className="pdf-main-container" id="pdf-main-container">
            <div className="pdf-level-bar" id="pdf-level-bar">
              <button className="pdf-level-btn active" data-level="O-Level">O-Level</button>
              <button className="pdf-level-btn" data-level="A-Level">A-Level</button>
              <button className="pdf-level-btn" data-level="Pharmacy">Pharmacy</button>
            </div>
            <div className="pdf-content-wrapper" id="pdf-content-wrapper">
              <div className="pdf-cards-area" id="pdf-cards-area"><div className="pdf-loading">Loading PDFs...</div></div>
              <div className="pdf-subtopics-column" id="pdf-subtopics-column">
                <div className="pdf-subtopics-header">Browse Topics</div>
                <div className="pdf-subtopics-list" id="pdf-subtopics-list"><p className="pdf-subtopics-placeholder">Select a level to view topics</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="pdf-preview-modal" className="pdf-preview-modal">
        <div className="pdf-preview-content">
          <div className="pdf-preview-header"><h3 id="preview-title">Loading...</h3><button className="pdf-preview-close" id="pdf-preview-close">&times;</button></div>
          <div className="pdf-preview-body" id="pdf-preview-body"><iframe id="pdf-preview-iframe" src="about:blank" frameBorder="0"></iframe></div>
          <div className="pdf-preview-footer">
            <button className="pdf-preview-download-btn" id="pdf-preview-download-btn">Download PDF</button>
            <button className="pdf-preview-back-btn" id="pdf-preview-back-btn">Back to Library</button>
          </div>
        </div>
      </div>

      <section id="notes-section" className="section-wrapper" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label" style={{ textAlign: 'left', marginBottom: '8px', display: 'block' }}>STUDY NOTES</span>
            <h2 className="pdf-section-title" style={{ fontFamily: "'Poppins',sans-serif", fontSize: 'clamp(2rem,5vw,3rem)', margin: 0, background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textAlign: 'left' }}>Notes Library</h2>
            <p className="section-subtitle" style={{ textAlign: 'left', margin: '8px 0 0 0', maxWidth: '600px' }}>Comprehensive study notes for Biology and Pharmacy.</p>
          </div>
          <div style={{ background: 'var(--clr-navy-card)', backdropFilter: 'blur(12px)', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px' }}>
              <button id="notes-main-filter-btn" className="btn-primary" style={{ background: 'linear-gradient(135deg, #e67e22, #b8873a, #0ab5b5)', padding: '8px 20px', borderRadius: '50px', fontWeight: '700', fontSize: '0.85rem' }}><i className="fa-solid fa-filter"></i> Browse Notes by Level</button>
              <div id="notes-filter-area" style={{ display: 'none', marginBottom: '20px' }}>
                <div id="notes-level-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}></div>
                <div id="notes-topics-container" style={{ marginBottom: '20px' }}></div>
                <div id="notes-subtopics-container"></div>
              </div>
              <div id="notes-content-area" style={{ minHeight: '300px' }}>
                <div id="notes-container" style={{ maxHeight: '600px', overflowY: 'auto', transition: 'all 0.3s ease' }}>
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--clr-text-dim)' }}>
                    <i className="fa-solid fa-book-open" style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }}></i>
                    Click "Browse Notes by Level" to start learning
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="community" className="section alt-bg reveal" aria-label="Community stream">
        <span className="sec-label">COMMUNITY</span>
        <h2 className="section-title">Live Learning Stream</h2>
        <div className="community-stream" id="community-stream">Loading activity…</div>
      </section>

      <section id="pricing" className="section alt-bg reveal" aria-label="Pricing">
        <span className="sec-label">MEMBERSHIP</span>
        <h2 className="section-title">Membership Plans</h2>
        <p className="section-subtitle">Choose the plan that fits your learning journey.</p>
        <div className="grid-3" id="pricing-grid"></div>
      </section>

      <section id="stats" className="section reveal" aria-label="Statistics">
        <span className="sec-label">IMPACT</span>
        <h2 className="section-title">Our Impact in Numbers</h2>
        <div className="stats-grid" id="stats-grid"></div>
      </section>

      <section id="blog" className="section alt-bg reveal" aria-label="Blog">
        <span className="sec-label">INSIGHTS</span>
        <h2 className="section-title">Latest Articles & Insights</h2>
        <div className="grid-3" id="blog-grid"></div>
      </section>

      <section id="faq" className="section reveal" aria-label="FAQ">
        <span className="sec-label">FAQ</span>
        <h2 className="section-title">Frequently Asked Questions</h2>
        <div className="faq-list" id="faq-list"></div>
      </section>

      <section id="contact" className="section alt-bg reveal" aria-label="Contact">
        <span className="sec-label">SUPPORT</span>
        <h2 className="section-title">Get in Touch</h2>
        <p className="section-subtitle">Have questions or feedback? Our support team typically responds within 24 hours.</p>
        <div className="grid-2">
          <form id="contact-form" noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div><label className="f-label" htmlFor="contact-name">FULL NAME</label><input type="text" className="f-input" id="contact-name" placeholder="Your full name" required autoComplete="name" /></div>
            <div><label className="f-label" htmlFor="contact-email">EMAIL ADDRESS</label><input type="email" className="f-input" id="contact-email" placeholder="you@institution.edu" required autoComplete="email" /></div>
            <div><label className="f-label" htmlFor="contact-subject">SUBJECT</label><input type="text" className="f-input" id="contact-subject" placeholder="Subject" required /></div>
            <div><label className="f-label" htmlFor="contact-message">MESSAGE</label><textarea className="f-input" id="contact-message" placeholder="Your message" style={{ minHeight: '110px', resize: 'vertical' }} required></textarea></div>
            <button type="submit" className="f-btn"><i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send Message</button>
            <div id="form-success" style={{ color: 'var(--clr-cyan)', textAlign: 'center', display: 'none', fontSize: '.875rem' }}></div>
            <div id="form-error" style={{ color: '#e74c3c', textAlign: 'center', display: 'none', fontSize: '.875rem' }}></div>
          </form>
          <aside className="contact-info-card" id="contact-info-card">
            <div className="text-center mb-4">
              <i className="fa-solid fa-headset text-4xl" style={{ color: 'var(--clr-cyan)' }} aria-hidden="true"></i>
              <h3 style={{ color: 'var(--clr-white)', marginTop: '.5rem', fontSize: '1.1rem', fontWeight: '600' }}>24/7 Support</h3>
            </div>
          </aside>
        </div>
      </section>

      <section className="section reveal" aria-label="Newsletter">
        <span className="sec-label">UPDATES</span>
        <h2 className="section-title">Stay Updated</h2>
        <p className="section-subtitle">Join our community of learners. Get weekly insights, study tips, and new resource alerts delivered to your inbox.</p>
        <form id="newsletter-form">
          <div className="newsletter-box">
            <input type="email" placeholder="Enter your email address" required autoComplete="email" aria-label="Email for newsletter" />
            <button type="submit">Subscribe <i className="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
          </div>
        </form>
      </section>

      <button className="back-to-top" id="back-to-top" aria-label="Back to top"><i className="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
      <a href="#pricing" className="sticky-cta"><i className="fa-solid fa-rocket" aria-hidden="true"></i> Start Learning</a>

      <div className="resource-modal-overlay" id="resource-modal-overlay" aria-hidden="true">
        <div className="resource-modal" id="resource-modal" role="dialog" aria-label="Resource details">
          <button className="resource-modal-close" id="resource-modal-close" aria-label="Close modal">✕</button>
          <div id="resource-modal-content"></div>
        </div>
      </div>
    </>
  );
}

export default HomePage;
