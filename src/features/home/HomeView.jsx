 // features/home/HomeView.jsx
import React from 'react';
import { Header } from '../../common-layout/Header';
import { Footer } from '../../common-layout/Footer';
import { MobileMenu } from '../../common-layout/MobileMenu';
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
import { InteractiveShowcase } from '../lab/InteractiveShowcase';
import { NotificationBell } from '../notifications/NotificationBell';
import { InfoCards } from '../info/InfoCards';

export default function HomeView({
  user,
  logout,
  navigate,
  currentYear,
  sections,
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
  return (
    <div className="homepage">
      <Header
        user={user}
        logoUrl={sections?.site_config?.logo_url}
        navLinks={sections?.navigation?.links || [
          { href: '/', label: 'Home' },
          { href: '#courses', label: 'Courses' },
          { href: '#contact', label: 'Contact' },
        ]}
        theme={theme}
        onToggleTheme={() => {
          const dark = document.body.classList.toggle('dark-mode');
          localStorage.setItem('theme', dark ? 'dark' : 'light');
          setTheme(dark ? 'dark' : 'light');
        }}
        onToggleMobile={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <NotificationBell user={user} />
      </Header>

      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        onLogout={logout}
        navLinks={sections?.navigation?.links || []}
        onNavigate={navigate}
      />

      <HeroCarousel
        slides={sections?.hero?.slides || []}
        currentSlide={currentSlide}
      />

      <InteractiveShowcase />

      <InfoCards />

      <StatsGrid stats={{
        resources_count: sections?.public_stats?.resources_count || 0,
        users_count: sections?.public_stats?.users_count || 0,
        downloads_count: sections?.public_stats?.downloads_count || 0,
        quiz_attempts: sections?.public_stats?.quiz_attempts || 0,
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
        activity={[]}
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

      <Footer
        logoUrl={sections?.site_config?.logo_url}
        tagline="Advancing Biology and Pharmacy education for every learner."
        socialLinks={sections?.footer?.social_links || []}
        columns={sections?.footer?.columns || []}
        currentYear={currentYear}
      />

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
