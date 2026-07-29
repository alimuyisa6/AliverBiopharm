 import React from 'react';
import { PlatformCards } from './PlatformCards';
import { StatsGrid } from './StatsGrid';
import { TestimonialSlider } from './TestimonialSlider';
import { ContinueLearningSection } from './ContinueLearningSection';
import { MoodCheckSection } from '../mood/MoodCheckSection';
import { CommunitySection } from '../community/CommunitySection';
import { ContactSection } from '../contact/ContactSection';
import { ChatWidget } from '../chat/ChatWidget';
import { NewsletterForm } from './NewsletterForm';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Read structured topic notes with diagrams and summaries', icon: 'fa-book-open', route: '/notes' },
  { key: 'flashcards', label: 'Flashcards', description: 'Drill key terms and structures until they stick', icon: 'fa-layer-group', route: '/flashcards' },
  { key: 'pdfs', label: 'PDF Library', description: 'Download printable guides and reference sheets', icon: 'fa-file-pdf', route: '/pdfs' },
  { key: 'quizzes', label: 'Quizzes', description: 'Test yourself block by block across every unit', icon: 'fa-circle-question', route: '/quiz' },
  { key: 'past_papers', label: 'Past Papers', description: 'Practice with real exam papers by year and board', icon: 'fa-file-lines', route: '/past-papers' },
  { key: 'recall', label: 'Recall', description: 'Daily spaced-repetition sessions to build long-term memory', icon: 'fa-brain', route: '/recall' },
];

function ContentTypeCards({ navigate, user, sections }) {
  return (
    <section className="section content-types-section">
      <div className="section-header">
        <h2 className="section-title">{sections?.section_headings?.content_types_title || 'Explore by Content Type'}</h2>
        <p className="section-subtitle">{sections?.section_headings?.content_types_subtitle || 'Pick where you want to start'}</p>
      </div>
      <div className="content-type-grid">
        {CONTENT_TYPES.map((type) => {
          const imageUrl = sections?.content_type_images?.[type.key];
          return (
            <div
              key={type.key}
              className="content-type-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(user ? type.route : '/login')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(user ? type.route : '/login'); } }}
              style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
            >
              <span className="content-type-overlay" />
              <span className="content-type-icon"><i className={`fa-solid ${type.icon}`} /></span>
              <span className="content-type-body">
                <span className="content-type-label">{type.label}</span>
                <span className="content-type-description">{type.description}</span>
              </span>
              <button
                type="button"
                className="btn-primary content-type-btn"
                onClick={(e) => { e.stopPropagation(); navigate(user ? type.route : '/login'); }}
              >
                Browse {type.label}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function HomeView(props) {
  const {
    sections,
    user,
    navigate,
    activeLevelName,
    activeGroupName,
    publicStats,
    communityActivity,
    weeklyChallengeAnswer,
    moodSelected,
    setMoodSelected,
    moodMessage,
    setMoodMessage,
    moodSubmitted,
    continueLearning,
    streak,
    chatOpen,
    chatMessages,
    chatInput,
    adminOnline,
    contactForm,
    contactStatus,
    newsletterEmail,
    newsletterStatus,
    currentYear,
    handleWeeklyChallengeSubmit,
    handleContactSubmit,
    handleNewsletterSubmit,
    handleMoodSubmit,
    sendChat,
    deleteChatMsg,
    setChatOpen,
    setChatInput,
    setContactForm,
    setNewsletterEmail,
    chatBodyRef,
  } = props;

  return (
    <div className="home-page">
      {user ? (
        <section className="section welcome-section">
          <div className="welcome-banner">
            <h1 className="welcome-title">
              Welcome to{activeLevelName && <><br />{activeLevelName}</>}
            </h1>
            {activeGroupName && (
              <p className="welcome-subtitle">
                You are currently studying <strong>{activeGroupName}</strong>
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="section welcome-section">
          <div className="welcome-banner">
            <h1 className="welcome-title">Welcome to<br />AliverBiopharm</h1>
            <p className="welcome-subtitle">
              Explore our comprehensive learning resources across O-Level, A-Level, and Pharmacy.
            </p>
          </div>
        </section>
      )}

      <PlatformCards />

      <StatsGrid stats={{
        resources_count: publicStats?.resources_count || 0,
        users_count: publicStats?.users_count || 0,
        downloads_count: publicStats?.downloads_count || 0,
        quiz_attempts: publicStats?.quiz_attempts || 0,
      }} />

      <ContinueLearningSection
        continueLearning={continueLearning}
        user={user}
        streak={streak}
      />

      <ContentTypeCards navigate={navigate} user={user} sections={sections} />

      <CommunitySection
        activity={communityActivity}
        weeklyChallenge={sections.weekly_challenge}
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

      <TestimonialSlider quotes={sections?.testimonials?.quotes || []} />

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
    </div>
  );
}
