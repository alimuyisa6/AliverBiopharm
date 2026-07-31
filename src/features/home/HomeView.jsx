 /* features/home/HomeView.jsx */
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import { PlatformCards } from './PlatformCards';
import { StatsGrid } from './StatsGrid';
import { TestimonialSlider } from './TestimonialSlider';
import { ContinueLearningSection } from './ContinueLearningSection';
import { MoodCheckSection } from '../mood/MoodCheckSection';
import { CommunitySection } from '../community/CommunitySection';
import { ContactSection } from '../contact/ContactSection';
import { ChatWidget } from '../chat/ChatWidget';
import { NewsletterForm } from './NewsletterForm';
import Hero from '../../components/Hero/Hero';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers' },
  { key: 'recall', label: 'Recall', description: 'Spaced-repetition for long-term memory', icon: 'brain', route: '/recall' },
];

 function ContentTypeCards({ navigate, user, sections }) {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];

  const CONTENT_TYPES = [
    { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes' },
    { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards' },
    { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs' },
    { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz' },
    { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers' },
    { key: 'recall', label: 'Recall', description: 'Spaced-repetition for long-term memory', icon: 'brain', route: '/recall' },
  ];

  function getImageForKey(key) {
    const comp = uiComponents.find(c => c.component_key === `content_type_${key}`);
    return comp?.properties?.image_url || null;
  }

  return (
    <section className="section reveal">
      <span className="sec-label">Explore</span>
      <h2 className="section-title">
        {sections?.section_headings?.content_types_title || 'Everything You Need to Succeed'}
      </h2>
      <p className="section-subtitle">
        {sections?.section_headings?.content_types_subtitle || 'Pick where you want to start — every resource is tailored to your level.'}
      </p>
      <div className="grid grid-cols-3">
        {CONTENT_TYPES.map((type) => {
          const imageUrl = getImageForKey(type.key);
          return (
            <button
              key={type.key}
              className="card card-clickable"
              onClick={() => navigate(user ? type.route : '/login')}
            >
              {imageUrl ? (
                <img src={imageUrl} alt={type.label} className="card-image" loading="lazy" />
              ) : (
                <div className="card-image-placeholder">
                  <Icon name={type.icon} />
                </div>
              )}
              <div className="card-body">
                <h3 className="card-title">{type.label}</h3>
                <p className="card-text">{type.description}</p>
              </div>
              <div className="card-footer">
                <span className="btn btn-secondary btn-sm">Browse {type.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
             }

export default function HomeView(props) {
  const {
    sections, user, navigate, activeLevelName, activeGroupName,
    publicStats, communityActivity, weeklyChallengeAnswer,
    moodSelected, setMoodSelected, moodMessage, setMoodMessage, moodSubmitted,
    continueLearning, streak, chatOpen, chatMessages, chatInput, adminOnline,
    contactForm, contactStatus, newsletterEmail, newsletterStatus, currentYear,
    handleWeeklyChallengeSubmit, handleContactSubmit, handleNewsletterSubmit,
    handleMoodSubmit, sendChat, deleteChatMsg, setChatOpen, setChatInput,
    setContactForm, setNewsletterEmail, chatBodyRef, requestChatRoom,
  } = props;

  return (
    <div className="home-page">
      <Hero />

      {user && activeLevelName && (
        <section className="section" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-4)' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="sec-label">Your Level</span>
            <h2 className="section-title" style={{ fontSize: 'var(--text-3xl)' }}>
              {activeLevelName}
            </h2>
            {activeGroupName && (
              <p className="section-subtitle" style={{ marginBottom: 0 }}>
                Currently studying <strong>{activeGroupName}</strong>
              </p>
            )}
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

      <ContinueLearningSection continueLearning={continueLearning} user={user} streak={streak} />

      <ContentTypeCards navigate={navigate} user={user} sections={sections} />

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
