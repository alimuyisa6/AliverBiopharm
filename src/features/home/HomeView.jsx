 /* features/home/HomeView.jsx */
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
import { useLayout } from '../../contexts/LayoutContext';
import './home.css';

const CONTENT_TYPES = [
  { key: 'notes', label: 'Notes', description: 'Structured topic notes with diagrams and summaries', icon: 'book-open', route: '/notes', color: 'blue' },
  { key: 'flashcards', label: 'Flashcards', description: 'Active recall with flip, typed, and MCQ modes', icon: 'layer-group', route: '/flashcards', color: 'teal' },
  { key: 'pdfs', label: 'PDF Library', description: 'Downloadable guides and reference sheets', icon: 'file-pdf', route: '/pdfs', color: 'grey' },
  { key: 'quizzes', label: 'Quizzes', description: 'Block-by-block testing across every unit', icon: 'clipboard-check', route: '/quiz', color: 'amber' },
  { key: 'past_papers', label: 'Past Papers', description: 'Real exam papers by year and board', icon: 'file-lines', route: '/past-papers', color: 'emerald' },
  { key: 'recall', label: 'Recall', description: 'Spaced repetition for lasting memory', icon: 'brain', route: '/recall', color: 'blue' }
];

const CONTINUE_ICON = { note: 'book-open', video: 'play', quiz: 'clipboard-check' };

function ContentTypeCards({ navigate, user, sections }) {
  const { bootstrap } = useLayout();
  const uiComponents = bootstrap?.ui_components || [];

  function getImage(key) {
    const component = uiComponents.find((item) => item.component_key === `content_type_${key}`);
    return component?.properties?.image_url || null;
  }

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Inside</span>
          <h2>{sections?.section_headings?.content_types_title || 'Everything You Need to Succeed'}</h2>
        </div>
      </div>
      <div className="row-list">
        {CONTENT_TYPES.map((type) => {
          const imageUrl = getImage(type.key);
          return (
            <div key={type.key} className="content-type-row">
              <div className="content-type-thumb">
                {imageUrl ? <img src={imageUrl} alt={type.label} loading="lazy" /> : <Icon name={type.icon === 'dna' ? 'microscope' : type.icon} />}
              </div>
              <div className="content-type-info">
                <div className="content-type-title">{type.label}</div>
                <div className="content-type-desc">{type.description}</div>
              </div>
              <div className="row-actions">
                <Button size="sm" variant="secondary" onClick={() => navigate(user ? type.route : '/login')}>Browse</Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LevelScopeBar({ activeLevelName, activeGroupName, onSwitchScope }) {
  if (!activeLevelName) return null;
  return (
    <button className="level-scope-bar" onClick={onSwitchScope} type="button">
      <span className="level-scope-dot" />
      <span>{activeLevelName}</span>
      {activeGroupName ? (<><span className="level-scope-sep">·</span><span>{activeGroupName}</span></>) : null}
      <Icon name="chevron-down" />
    </button>
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
            <Link to={locked ? '/upgrade' : `/units/${unit.id}`} key={unit.id} className="stat-item">
              {unit.topic_image_url ? (
                <img src={unit.topic_image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 5 }} />
              ) : (
                <div className="row-thumb" style={{ width: '100%', height: 120 }}><Icon name={unit.icon || 'flask'} /></div>
              )}
              <div style={{ marginTop: 8 }}>
                <strong>{unit.name}</strong>
                <span style={{ marginLeft: 8 }}>{locked ? <Icon name="lock" /> : `${unit.progress_percent || 0}%`}</span>
              </div>
              <div className="progress-track" style={{ marginTop: 8 }}>
                <span className={`progress-fill progress-${unit.progress_color || 'blue'}`} style={{ width: `${unit.progress_percent || 0}%` }} />
              </div>
              {unit.is_hard_topic && <span className="tag tag-amber" style={{ marginTop: 6 }}>Hard topic</span>}
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
      <div className="row">
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

function PastPapersList({ papers, navigate }) {
  if (!papers?.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-head-left">
          <span className="eyebrow">Practice</span>
          <h2>Past papers</h2>
        </div>
        <Link to="/past-papers" className="text-link">Browse all papers →</Link>
      </div>
      <div className="row-list">
        {papers.map((paper) => (
          <div className="row" key={paper.id}>
            <div className="row-thumb">{paper.paper_type_short}</div>
            <div className="row-body">
              <div className="row-title">{paper.title}</div>
              <div className="row-meta">{paper.exam_board} · {paper.subject}</div>
            </div>
            <span className="tag tag-grey">{paper.year}</span>
            <span className="tag tag-grey">{paper.paper_type}</span>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/past-papers/${paper.id}`)}>Open</Button>
          </div>
        ))}
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
    pastPapers,
    onSwitchScope,
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
          <LevelScopeBar
            activeLevelName={activeLevelName}
            activeGroupName={activeGroupName}
            onSwitchScope={onSwitchScope}
          />
          <SnapshotStats userStats={userStats} />
          <ContinueLearningRail items={continueLearning} navigate={navigate} />
        </>
      )}

      <WhyChooseSection />
      <ContentTypeCards navigate={navigate} user={user} sections={sections} />

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

      {user && <PastPapersList papers={pastPapers} navigate={navigate} />}

      <TestimonialSlider quotes={sections?.testimonials?.quotes || []} />
      <ClassroomSection user={user} />
      <TutorMarketplaceSection />

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
