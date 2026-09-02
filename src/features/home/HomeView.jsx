 /* features/home/HomeView.jsx */
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import ClassSwitcher from '../../components/ClassSwitcher/ClassSwitcher';
import { WhyChooseSection } from './WhyChooseSection';
import { HowItWorksSection } from './HowItWorksSection';
import { StatsGrid } from './StatsGrid';
import { TestimonialSlider } from './TestimonialSlider';
import { ChatWidget } from '../chat/ChatWidget';
import { NewsletterForm } from './NewsletterForm';
import ClassroomTeaser from '../classroom/ClassroomTeaser';
import TutorMarketplaceTeaser from '../tutor-marketplace/TutorMarketplaceTeaser';
import Hero from '../../components/Hero/Hero';
import { useLayout } from '../../contexts/LayoutContext';
import './home.css';

const CONTINUE_ICON = { note: 'book-open', video: 'play', quiz: 'clipboard-check' };

function LearningJourneySection({ navigate, sections }) {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];
  const component = uiComponents.find((item) => item.component_key === 'learning_journey_section');
  const primaryImage = component?.properties?.image_url || '/images/students-learning-happy.jpg';
  const secondaryImage = component?.properties?.secondary_image_url || '/images/students-learning-together.jpg';
  const subtitle = sections?.section_headings?.content_types_subtitle || 'Notes, flashcards, quizzes, past papers and recall — everything you need, all in one place.';

  return (
    <section className="section learning-journey-section">
      <div className="learning-journey-content">
        <span className="eyebrow">Get started</span>
        <h2 className="learning-journey-title">
          Your learning journey starts<br />
          from here
        </h2>
        <img
          src={primaryImage}
          alt="Happy students learning together"
          className="learning-journey-image"
          loading="lazy"
        />
        <p className="section-subtitle">{subtitle}</p>
        <img
          src={secondaryImage}
          alt="Students studying and collaborating"
          className="learning-journey-image"
          loading="lazy"
        />
        <Button variant="primary" onClick={() => navigate('/resources')}>Browse resources</Button>
      </div>
    </section>
  );
}

function SnapshotStats({ userStats }) {
  if (!userStats) return null;
  const { totalXp = 0, xpToday = 0, streak = 0, topicsActive = 0, topicsCompleted = 0, papersTotal = 0, papersAttempted = 0 } = userStats;
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Your learning</span>
          <h2>Learning snapshot</h2>
        </div>
        <Link to="/progress" className="text-link">View progress →</Link>
      </div>
      <div className="dash-strip">
        <div className="dash-cell">
          <div className="dc-label">Total XP</div>
          <div className="dc-value green">{totalXp.toLocaleString()}</div>
          <div className="dc-sub">+{xpToday} today</div>
        </div>
        <div className="dash-cell">
          <div className="dc-label">Day streak</div>
          <div className="dc-value amber">{streak}</div>
          <div className="dc-sub">Keep going</div>
        </div>
        <div className="dash-cell">
          <div className="dc-label">Topics active</div>
          <div className="dc-value">{topicsActive}</div>
          <div className="dc-sub">{topicsCompleted} completed</div>
        </div>
        <div className="dash-cell">
          <div className="dc-label">Past papers</div>
          <div className="dc-value">{papersTotal}</div>
          <div className="dc-sub">{papersAttempted} attempted</div>
        </div>
      </div>
    </section>
  );
}

function ContinueLearningRail({ items, navigate }) {
  if (!items?.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Pick up where you stopped</span>
          <h2>Continue learning</h2>
        </div>
        <Link to="/activity" className="text-link">See all activity →</Link>
      </div>
      <div className="row-list">
        {items.map((item) => (
          <div key={item.id} className="row">
            <div className="row-thumb">
              {item.thumbnail_url ? <img src={item.thumbnail_url} alt={item.title} /> : <Icon name={CONTINUE_ICON[item.type] || 'book-open'} />}
            </div>
            <div className="row-body">
              <div className="row-title">{item.title}</div>
              <div className="row-meta">
                <span>{item.type} · {item.subject || 'Biology'}</span>
                <span className="progress-track" style={{ width: 120 }}>
                  <span className={`progress-fill progress-${item.progress_color || 'blue'}`} style={{ width: `${item.progress_percent}%` }} />
                </span>
              </div>
            </div>
            <div className="row-actions">
              <span>{item.progress_label}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(item.route)}>{item.cta_label} →</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CurriculumSnapshot({ units, activeLevelName, activeGroupName, canAccessPremium }) {
  if (!units?.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">{activeLevelName}{activeGroupName ? ` · ${activeGroupName}` : ''}</span>
          <h2>Your curriculum</h2>
        </div>
        <Link to="/curriculum" className="text-link">Full curriculum →</Link>
      </div>
      <div className="grid grid-cols-4">
        {units.map((unit) => {
          const locked = unit.is_premium && !canAccessPremium;
          return (
            <Link to={locked ? '/upgrade' : `/units/${unit.id}`} key={unit.id} className="card card-lifted topic-card">
              {unit.topic_image_url ? (
                <img src={unit.topic_image_url} alt="" className="topic-card-image" />
              ) : (
                <div className="row-thumb topic-card-image-placeholder"><Icon name={unit.icon || 'flask'} /></div>
              )}
              <div className="topic-card-row">
                <strong>{unit.name}</strong>
                <span>{locked ? <Icon name="lock" /> : `${unit.progress_percent || 0}%`}</span>
              </div>
              <div className="progress-track" style={{ marginTop: 8 }}>
                <span className={`progress-fill progress-${unit.progress_color || 'blue'}`} style={{ width: `${unit.progress_percent || 0}%` }} />
              </div>
              {unit.is_hard_topic && <span className="tag tag-amber" style={{ marginTop: 8 }}>Hard topic</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DailyRecallCard({ recall, onReveal, onStart }) {
  if (!recall) return null;
  const { question_text, meta, score } = recall;
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Daily active recall</span>
          <h2>{question_text}</h2>
          <p className="section-subtitle">{meta}</p>
        </div>
      </div>
      <div className="emerald-card row">
        <div className="row-body">
          {score && (
            <div>
              <span>Today's recall</span>
              <strong>{score.completed} / {score.total}</strong>
              <span> · +{score.xp_earned} XP</span>
              <div className="progress-track" style={{ marginTop: 8 }}>
                <span className="progress-fill emerald" style={{ width: `${(score.completed / score.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="row-actions">
          <Button variant="primary" onClick={onReveal}>Reveal answer</Button>
          <Button variant="secondary" onClick={onStart}>Start recall</Button>
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
    requestChatRoom,
    userStats,
    continueLearning,
    curriculumUnits,
    canAccessPremium,
    dailyRecall,
    onRevealRecall,
    onStartRecall
  } = props;

  return (
    <div className="home-page">
      <div className="hero-block">
        <Hero />
      </div>

      {user && (
        <>
          <ClassSwitcher className="home-scope-switcher" />
          <SnapshotStats userStats={userStats} />
          <ContinueLearningRail items={continueLearning} navigate={navigate} />
        </>
      )}

      <WhyChooseSection />
      <LearningJourneySection navigate={navigate} sections={sections} />

      {user && (
        <CurriculumSnapshot
          units={curriculumUnits}
          activeLevelName={activeLevelName}
          activeGroupName={activeGroupName}
          canAccessPremium={canAccessPremium}
        />
      )}

      {user && <DailyRecallCard recall={dailyRecall} onReveal={onRevealRecall} onStart={onStartRecall} />}

      <HowItWorksSection />
      <StatsGrid stats={{ resources_count: publicStats?.resources_count || 0, users_count: publicStats?.users_count || 0, downloads_count: publicStats?.downloads_count || 0, quiz_attempts: publicStats?.quiz_attempts || 0 }} />

      <TestimonialSlider quotes={sections?.testimonials?.quotes || []} />
      <ClassroomTeaser />
      <TutorMarketplaceTeaser />

      <NewsletterForm email={newsletterEmail} status={newsletterStatus} onChange={(event) => setNewsletterEmail(event.target.value)} onSubmit={handleNewsletterSubmit} />

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
