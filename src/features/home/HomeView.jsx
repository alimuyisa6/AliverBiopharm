 import { useState } from 'react';
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

const CONTINUE_ICON = { note: 'book-open', video: 'play', quiz: 'clipboard-check' };

const SUBJECT_VARIANT = { biology: 'emerald', pharmacology: 'blue', chemistry: 'green', clinical: 'amber' };
const VARIANT_RING_COLOR = { emerald: 'var(--emerald-600)', blue: 'var(--blue-600)', green: 'var(--green-600)', amber: 'var(--amber-600)', grey: 'var(--grey-500)' };

function ProgressRing({ percent = 0, color = 'var(--emerald-600)', size = 40 }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg width={size} height={size} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--grey-200)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="progress-ring-label">{percent}%</text>
    </svg>
  );
}

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
        <h1 className="learning-journey-title">Your learning journey starts from here</h1>
        <img
          src={primaryImage}
          alt="Happy students learning together"
          className="learning-journey-image"
          loading="lazy"
        />
        <h6 className="section-subtitle">{subtitle}</h6>
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

function CurriculumUnitCard({ unit, locked, navigate }) {
  const [imageFailed, setImageFailed] = useState(false);
  const variant = SUBJECT_VARIANT[unit.subject_key] || 'grey';
  const ringColor = VARIANT_RING_COLOR[variant];
  const percent = unit.progress_percent || 0;
  const totalLessons = unit.lessons_total || 0;
  const doneLessons = unit.lessons_completed || 0;
  const showImage = unit.topic_image_url && !imageFailed;

  return (
    <button
      type="button"
      className={`curriculum-card curriculum-card-${variant}${locked ? ' curriculum-card-locked' : ''}`}
      onClick={() => navigate(locked ? '/upgrade' : `/units/${unit.id}`)}
    >
      <div className="curriculum-card-frame">
        <div className="curriculum-card-media">
          {showImage ? (
            <img
              src={unit.topic_image_url}
              alt=""
              className={locked ? 'curriculum-card-image-blurred' : 'curriculum-card-image'}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="curriculum-card-image-fallback">
              <Icon name={unit.icon || 'flask'} />
            </div>
          )}
        </div>

        {locked ? (
          <div className="curriculum-card-lock">
            <Icon name="lock" />
          </div>
        ) : (
          <div className="curriculum-card-ring">
            <ProgressRing percent={percent} color={ringColor} />
          </div>
        )}
      </div>

      <div className="curriculum-card-caption">
        <strong>{unit.name}</strong>
        <span>{locked ? 'Premium · Upgrade to unlock' : `${doneLessons}/${totalLessons} lessons`}</span>
        {unit.is_hard_topic && !locked && <span className="curriculum-card-pill">Hard topic</span>}
      </div>
    </button>
  );
}

function CurriculumSnapshot({ units, activeLevelName, activeGroupName, canAccessPremium, navigate, sections }) {
  if (!units?.length) return null;
  const description = sections?.section_headings?.curriculum_subtitle || 'Every unit in your syllabus, tracked to how far you\'ve actually gotten.';
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">{activeLevelName}{activeGroupName ? ` · ${activeGroupName}` : ''}</span>
          <h1>Your curriculum</h1>
          <h6 className="section-subtitle">{description}</h6>
        </div>
        <Link to="/curriculum" className="text-link">Full curriculum →</Link>
      </div>
      <div className="curriculum-rail">
        {units.map((unit) => (
          <CurriculumUnitCard
            key={unit.id}
            unit={unit}
            locked={unit.is_premium && !canAccessPremium}
            navigate={navigate}
          />
        ))}
      </div>
    </section>
  );
}

function DailyRecallCard({ recall, onReveal, onStart }) {
  if (!recall) return null;
  const { question_text, meta, score } = recall;
  return (
    <section className="section section-emerald">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Daily active recall</span>
          <h2>{question_text}</h2>
          <p className="section-subtitle">{meta}</p>
        </div>
      </div>
      <div className="card card-lifted row">
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
          navigate={navigate}
          sections={sections}
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
