 import React from 'react';
import { Link } from 'react-router-dom';
import { HeroCarousel } from './HeroCarousel';
import { StatsGrid } from './StatsGrid';
import { TeamScroll } from './TeamScroll';
import { TestimonialSlider } from './TestimonialSlider';
import { PricingCards } from './PricingCards';
import { BlogGrid } from './BlogGrid';
import { FaqAccordion } from './FaqAccordion';
import { NewsletterForm } from './NewsletterForm';
import { ContinueLearningSection } from './ContinueLearningSection';
import { FlashcardSection } from '../flashcards/FlashcardSection';
import { PdfLibrarySection } from '../pdfs/PdfLibrarySection';
import { PdfPreviewModal } from '../pdfs/PdfPreviewModal';
import { NotesSection } from '../Notes/NotesSection';
import { MoodCheckSection } from '../mood/MoodCheckSection';
import { CommunitySection } from '../community/CommunitySection';
import { ContactSection } from '../contact/ContactSection';
import { ChatWidget } from '../chat/ChatWidget';
import NotificationBell from '../../components/NotificationBell';
import InfoCards from '../../components/InfoCards';
import InteractiveShowcase from '../../components/InteractiveShowcase';
import { ClassroomSection } from '../classroom/ClassroomSection';

export default function HomeView({
  user,
  logout,
  navigate,
  currentYear,
  sections,
  publicStats,
  communityActivity,
  theme,
  currentSlide,
  mobileMenuOpen,
  contactForm,
  contactStatus,
  newsletterEmail,
  newsletterStatus,
  weeklyChallengeAnswer,
  moodSelected,
  moodMessage,
  moodSubmitted,
  continueLearning,
  pdfs,
  pdfLevel,
  pdfSelectedTopic,
  pdfPreviewOpen,
  previewPdf,
  groupedNotes,
  notesSelectedLevel,
  notesSelectedTopic,
  notesFilterVisible,
  notesContent,
  notesReactions,
  notesComments,
  notesCommentInput,
  chatOpen,
  chatMessages,
  chatInput,
  adminOnline,
  chatBodyRef,
  setMoodSelected,
  setMoodMessage,
  setContactForm,
  setNewsletterEmail,
  setTheme,
  setMobileMenuOpen,
  setPdfLevel,
  setPdfSelectedTopic,
  setPdfPreviewOpen,
  setNotesSelectedLevel,
  setNotesSelectedTopic,
  setNotesFilterVisible,
  setNotesContent,
  setNotesCommentInput,
  setChatOpen,
  setChatInput,
  handleMoodSubmit,
  handleContactSubmit,
  handleNewsletterSubmit,
  handleWeeklyChallengeSubmit,
  fetchPdfsByLevel,
  handlePdfPreview,
  handlePdfDownload,
  loadNoteContent,
  handleNoteReaction,
  handleNoteComment,
  requestChatRoom,
  sendChat,
  deleteChatMsg,
}) {
  const navLinks = sections?.navigation?.links || [
    { href: '/', label: 'Home' },
    { href: '#courses', label: 'Courses' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <div className="homepage">
      <header className="site-header" id="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link" aria-label="AliverBiopharm Home">
            {sections?.site_config?.logo_url ? (
              <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '70px', width: 'auto' }} />
            ) : (
              'AliverBiopharm'
            )}
          </Link>
          <nav aria-label="Main navigation">
            <ul className="main-nav" id="main-nav">
              {navLinks.map(link => (
                <li key={link.href}>
                  {link.href.startsWith('#') || link.href.startsWith('http') ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link to={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="nav-actions">
            <NotificationBell user={user} />
            <button
              className="theme-toggle"
              onClick={() => {
                const dark = document.body.classList.toggle('dark-mode');
                localStorage.setItem('theme', dark ? 'dark' : 'light');
                setTheme(dark ? 'dark' : 'light');
              }}
              aria-label="Toggle dark mode"
            >
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
              <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <nav className="mobile-nav-links">
            {navLinks.map(link =>
              link.href.startsWith('#') || link.href.startsWith('http') ? (
                <a key={link.href} href={link.href}>{link.label}</a>
              ) : (
                <Link key={link.href} to={link.href} onClick={() => setMobileMenuOpen(false)}>{link.label}</Link>
              )
            )}
          </nav>
        </div>
      </div>
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>

      <HeroCarousel
        slides={sections?.hero?.slides || []}
        currentSlide={currentSlide}
      />

      <InteractiveShowcase />

      <InfoCards />

      <ClassroomSection user={user} />

      <StatsGrid stats={{
        resources_count: publicStats?.resources_count || 0,
        users_count: publicStats?.users_count || 0,
        downloads_count: publicStats?.downloads_count || 0,
        quiz_attempts: publicStats?.quiz_attempts || 0,
      }} />

      <ContinueLearningSection
        continueLearning={continueLearning}
        user={user}
      />

      <FlashcardSection
        headingTitle={sections?.section_headings?.flashcards_title}
        headingSubtitle={sections?.section_headings?.flashcards_subtitle}
        onStartStudy={() => user ? navigate('/flashcards') : navigate('/login')}
        onBrowseDecks={() => navigate('/flashcards')}
        user={user}
      />

      <PdfLibrarySection
        pdfs={pdfs}
        pdfLevel={pdfLevel}
        pdfSelectedTopic={pdfSelectedTopic}
        onLevelChange={(level) => { fetchPdfsByLevel(level); setPdfLevel(level); setPdfSelectedTopic(null); }}
        onTopicSelect={setPdfSelectedTopic}
        onPreview={handlePdfPreview}
        onDownload={handlePdfDownload}
      />

      <NotesSection
        groupedNotes={groupedNotes}
        notesSelectedLevel={notesSelectedLevel}
        notesSelectedTopic={notesSelectedTopic}
        notesFilterVisible={notesFilterVisible}
        notesContent={notesContent}
        notesReactions={notesReactions}
        notesComments={notesComments}
        notesCommentInput={notesCommentInput}
        onSelectLevel={(level) => { setNotesSelectedLevel(level); setNotesSelectedTopic(null); setNotesContent(null); }}
        onSelectTopic={(topic) => { setNotesSelectedTopic(topic); setNotesContent(null); }}
        onToggleFilter={() => setNotesFilterVisible(!notesFilterVisible)}
        onReadNote={(id) => navigate(`/notes/read?id=${id}`)}
        onReaction={handleNoteReaction}
        onComment={handleNoteComment}
        onCommentInputChange={setNotesCommentInput}
      />

      <CommunitySection
        activity={communityActivity}
        weeklyChallenge={sections?.weekly_challenge}
        weeklyChallengeAnswer={weeklyChallengeAnswer}
        onWeeklySubmit={handleWeeklyChallengeSubmit}
      />

      <MoodCheckSection
        moodSelected={moodSelected}
        moodMessage={moodMessage}
        moodSubmitted={moodSubmitted}
        onMoodSelect={setMoodSelected}
        onMessageChange={setMoodMessage}
        onSubmit={handleMoodSubmit}
      />

      <TeamScroll members={sections?.team?.members || []} />

      <TestimonialSlider quotes={sections?.testimonials?.quotes || []} />

      <PricingCards plans={sections?.pricing?.plans || []} />

      <BlogGrid posts={sections?.blog?.posts || []} />

      <FaqAccordion items={sections?.faq?.items || []} />

      <ContactSection
        contactForm={contactForm}
        contactStatus={contactStatus}
        contactInfo={sections?.contact?.info || []}
        onChange={setContactForm}
        onSubmit={handleContactSubmit}
      />

      <NewsletterForm
        email={newsletterEmail}
        status={newsletterStatus}
        onChange={(e) => setNewsletterEmail(e.target.value)}
        onSubmit={handleNewsletterSubmit}
      />

      <footer className="footer-fat">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '260px' }}>
            <Link to="/" className="logo-link" style={{ marginBottom: '14px', display: 'inline-flex' }}>
              {sections?.site_config?.logo_url ? (
                <img src={sections.site_config.logo_url} alt="AliverBiopharm" style={{ height: '50px' }} />
              ) : (
                'AliverBiopharm'
              )}
            </Link>
            <p style={{ fontSize: '.85rem', lineHeight: 1.7, color: 'var(--clr-text-dim)' }}>
              Advancing biology and pharmacy education for every learner.
            </p>
            <div className="footer-social">
              {(sections?.footer?.social_links || []).map(s => (
                <a key={s.platform} href={s.url} target="_blank" rel="noreferrer">
                  <i className={s.icon}></i>
                </a>
              ))}
            </div>
          </div>
          <div className="footer-grid">
            {(sections?.footer?.columns || []).map(col => (
              <div key={col.heading}>
                <h4 style={{ fontWeight: 700, color: 'var(--clr-white)', fontSize: '0.9rem', marginBottom: '16px' }}>
                  {col.heading}
                </h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.items?.map(item => (
                    <li key={item.label}>
                      {item.href.startsWith('#') || item.href.startsWith('http') ? (
                        <a href={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                          {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
                          {item.label}
                        </a>
                      ) : (
                        <Link to={item.href} style={{ fontSize: '0.875rem', color: 'var(--clr-text-dim)' }}>
                          {item.icon && <i className={item.icon} style={{ marginRight: '0.5rem' }}></i>}
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 'var(--max-width)', margin: '2rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid var(--clr-border-glow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--clr-text-muted)' }}>&copy; {currentYear} AliverBiopharm. All rights reserved.</p>
          <nav style={{ display: 'flex', gap: '22px' }}>
            <Link to="/privacy" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>Terms of Use</Link>
            <Link to="/about" style={{ fontSize: '.875rem', color: 'var(--clr-text-dim)' }}>About Us</Link>
          </nav>
        </div>
      </footer>

      <button className="back-to-top" id="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <i className="fa-solid fa-arrow-up"></i>
      </button>

      <ChatWidget
        chatOpen={chatOpen}
        chatMessages={chatMessages}
        chatInput={chatInput}
        adminOnline={adminOnline}
        onToggle={() => setChatOpen(!chatOpen)}
        onSend={sendChat}
        onInputChange={setChatInput}
        onDeleteMsg={deleteChatMsg}
        chatBodyRef={chatBodyRef}
      />

      {pdfPreviewOpen && (
        <PdfPreviewModal
          pdf={previewPdf}
          onClose={() => setPdfPreviewOpen(false)}
          onDownload={handlePdfDownload}
        />
      )}
    </div>
  );
}
