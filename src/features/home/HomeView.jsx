 import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import { WhyChooseSection } from './WhyChooseSection';
import { HowItWorksSection } from './HowItWorksSection';
import { StatsGrid } from './StatsGrid';
import { TestimonialSlider } from './TestimonialSlider';
import { ContinueLearningSection } from './ContinueLearningSection';
import { ChatWidget } from '../chat/ChatWidget';
import { NewsletterForm } from './NewsletterForm';
import { ClassroomSection } from '../classroom/ClassroomSection';
import TutorMarketplaceSection from '../tutor-marketplace/TutorMarketplaceSection';
import Hero from '../../components/Hero/Hero';
import { useLayout } from '../../contexts/LayoutContext';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes', color: 'blue' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards', color: 'teal' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs', color: 'violet' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz', color: 'amber' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers', color: 'emerald' },
  { key: 'recall', label: 'Recall', description: 'Spaced repetition for lasting memory', icon: 'brain', route: '/recall', color: 'blue' }
];

function ContentTypeCards({ navigate, user, sections }) {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];

  function getImage(key) {
    const component = uiComponents.find((item) => item.component_key === `content_type_${key}`);

    return component?.properties?.image_url || null;
  }

  return (
    <section className="section reveal">
      <span className="sec-label">Inside</span>
      <h2 className="section-title">
        {sections?.section_headings?.content_types_title || 'Everything You Need to Succeed'}
      </h2>
      <p className="section-subtitle">
        {sections?.section_headings?.content_types_subtitle || 'Six resource types, all matched to your syllabus.'}
      </p>

      <div className="grid-frame">
        <div className="grid grid-cols-3">
          {CONTENT_TYPES.map((type) => {
            const imageUrl = getImage(type.key);

            return (
              <div key={type.key} className={`card card-${type.color}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={type.label} className="card-image" loading="lazy" />
                ) : (
                  <div className="card-image-placeholder">
                    <Icon name={type.icon === 'dna' ? 'microscope' : type.icon} />
                  </div>
                )}

                <div className="card-body">
                  <h3 className="card-title">{type.label}</h3>
                  <p className="card-text">{type.description}</p>
                </div>

                <div className="card-footer">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(user ? type.route : '/login')}
                  >
                    Browse {type.label}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
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
    continueLearning,
    streak,
    chatOpen,
    chatMessages,
    chatInput,
    adminOnline,
    newsletterEmail,
    newsletterStatus,
    currentYear,
    handleNewsletterSubmit,
    sendChat,
    deleteChatMsg,
    setChatOpen,
    setChatInput,
    setNewsletterEmail,
    chatBodyRef,
    requestChatRoom
  } = props;

  return (
    <div className="home-page">
      <div className="hero-block">
        <Hero />
      </div>

      <WhyChooseSection />

      <ContentTypeCards navigate={navigate} user={user} sections={sections} />

      <HowItWorksSection />

      <StatsGrid
        stats={{
          resources_count: publicStats?.resources_count || 0,
          users_count: publicStats?.users_count || 0,
          downloads_count: publicStats?.downloads_count || 0,
          quiz_attempts: publicStats?.quiz_attempts || 0
        }}
      />

      <TestimonialSlider quotes={sections?.testimonials?.quotes || []} />

      <ContinueLearningSection continueLearning={continueLearning} user={user} streak={streak} />
      <ClassroomSection user={user} />
      <TutorMarketplaceSection />

      <NewsletterForm
        email={newsletterEmail}
        status={newsletterStatus}
        onChange={(event) => setNewsletterEmail(event.target.value)}
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
