 import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import { WhyChooseSection } from './WhyChooseSection';
import { HowItWorksSection } from './HowItWorksSection';
import { StatsGrid } from './StatsGrid';
import { TestimonialSlider } from './TestimonialSlider';
import { ChatWidget } from '../chat/ChatWidget';
import { NewsletterForm } from './NewsletterForm';
import { ClassroomSection } from '../classroom/ClassroomSection';
import TutorMarketplaceSection from '../tutor-marketplace/TutorMarketplaceSection';
import Hero from '../../components/Hero/Hero';
import ContentFlipSection from '../../components/ContentFlipSection/ContentFlipSection';
import { useLayout } from '../../contexts/LayoutContext';

export default function HomeView(props) {
  const {
    sections,
    user,
    navigate,
    activeLevelName,
    activeGroupName,
    publicStats,
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

      <ContentFlipSection sections={sections} navigate={navigate} user={user} />

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
