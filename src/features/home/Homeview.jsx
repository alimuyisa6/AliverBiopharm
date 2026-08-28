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

// content_type -> icon fallback when a card has no thumbnail column at all
// (quizzes has no thumbnail_url/cover_image_url in the schema — icon only, by design)
const CONTINUE_ICON = { note: 'book-open', video: 'play', quiz: 'clipboard-check' };

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
                    className="btn-radius-sm"
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

/*
  LevelScopeBar
  ---------------------------------------------------------------
  Renders the user's active scope (curriculum_levels.display_name
  via activeLevelName, curriculum_groups.name via activeGroupName).
  This is the single visible confirmation that everything below —
  snapshot, continue learning, curriculum, recall, past papers —
  is filtered to active_level_id / active_group_id on user_profiles.
  Clicking should reopen the same picker your update_scope endpoint
  already powers post-login.
*/
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

/*
  SnapshotStats
  ---------------------------------------------------------------
  userStats sourced from: user_xp (total_xp), user_daily_activity
  (streak — derive from consecutive activity_date rows), curriculum
  count of curriculum_units WHERE group_id = active_group_id, and
  past_paper_downloads / user_paper_interactions count.
*/
function SnapshotStats({ userStats }) {
  if (!userStats) return null;
  const { totalXp = 0, xpToday = 0, streak = 0, topicsActive = 0, topicsCompleted = 0, papersTotal = 0, papersAttempted = 0 } = userStats;
  return (
    <section className="section reveal snapshot-section">
      <div className="section-head-row">
        <div>
          <span className="sec-label">Your learning</span>
          <h2 className="section-title">Learning snapshot</h2>
        </div>
        <Link to="/progress" className="text-link">View progress →</Link>
      </div>
      <div className="stats-strip">
        <div className="stats-strip-item">
          <div className="stats-strip-value">{totalXp.toLocaleString()}</div>
          <div className="stats-strip-label">Total XP</div>
          <div className="stats-strip-meta positive">+{xpToday} today</div>
        </div>
        <div className="stats-strip-item">
          <div className="stats-strip-value">{streak}</div>
          <div className="stats-strip-label">Day streak</div>
          <div className="stats-strip-meta positive">Keep going</div>
        </div>
        <div className="stats-strip-item">
          <div className="stats-strip-value">{topicsActive}</div>
          <div className="stats-strip-label">Topics active</div>
          <div className="stats-strip-meta">{topicsCompleted} completed</div>
        </div>
        <div className="stats-strip-item">
          <div className="stats-strip-value">{papersTotal}</div>
          <div className="stats-strip-label">Past papers</div>
          <div className="stats-strip-meta">{papersAttempted} attempted</div>
        </div>
      </div>
    </section>
  );
}

/*
  ContinueLearningRail
  ---------------------------------------------------------------
  items sourced from user_interactions / reading_progress joined to
  notes.cover_image_url, videos.thumbnail_url — WHERE unit.group_id
  = active_group_id, ORDER BY last interacted DESC LIMIT 3.
  Quizzes have no image column in the schema — icon placeholder is
  the permanent state there, not a temporary gap.
*/
function ContinueLearningRail({ items, navigate }) {
  if (!items?.length) return null;
  return (
    <section className="section reveal">
      <div className="section-head-row">
        <div>
          <span className="sec-label">Pick up where you stopped</span>
          <h2 className="section-title">Continue learning</h2>
        </div>
        <Link to="/activity" className="text-link">See all activity →</Link>
      </div>
      <div className="grid grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="card continue-card">
            <div className="card-image-slot">
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt={item.title} className="card-image" loading="lazy" />
              ) : (
                <div className="card-image-placeholder"><Icon name={CONTINUE_ICON[item.type] || 'book-open'} /></div>
              )}
            </div>
            <div className="card-body">
              <div className="card-tag">{item.type} · {item.subject || 'Biology'}</div>
              <h3 className="card-title">{item.title}</h3>
              <p className="card-text">{item.description}</p>
              <div className="progress-track">
                <span className={`progress-fill progress-${item.progress_color || 'blue'}`} style={{ width: `${item.progress_percent}%` }} />
              </div>
            </div>
            <div className="card-footer between">
              <span>{item.progress_label}</span>
              <button className="text-link" onClick={() => navigate(item.route)}>{item.cta_label} →</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/*
  CurriculumSnapshot
  ---------------------------------------------------------------
  units: curriculum_units WHERE group_id = active_group_id
  ORDER BY display_order. percent computed from user_topic_stats
  (xp / target) or user_topic_completion, scoped to the SAME
  group_id — never carry a percent computed under a different
  group into this view after a level/group switch.
  is_premium / is_hard_topic drive the locked/badge states.
*/
function CurriculumSnapshot({ units, activeLevelName, activeGroupName, canAccessPremium }) {
  if (!units?.length) return null;
  return (
    <section className="section reveal curriculum-section">
      <div className="section-head-row">
        <div>
          <span className="sec-label">{activeLevelName}{activeGroupName ? ` · ${activeGroupName}` : ''}</span>
          <h2 className="section-title">Your curriculum</h2>
          <p className="section-subtitle">Topics and learning progress within your current level and group.</p>
        </div>
        <Link to="/curriculum" className="text-link">Full curriculum →</Link>
      </div>
      <div className="grid grid-cols-4 curriculum-grid">
        {units.map((unit) => {
          const locked = unit.is_premium && !canAccessPremium;
          return (
            <Link
              to={locked ? '/upgrade' : `/units/${unit.id}`}
              key={unit.id}
              className={`topic-tile${locked ? ' locked' : ''}`}
            >
              {unit.topic_image_url ? (
                <img src={unit.topic_image_url} alt="" className="topic-tile-image" loading="lazy" />
              ) : (
                <div className="topic-tile-icon"><Icon name={unit.icon || 'flask'} /></div>
              )}
              <div className="topic-tile-top">
                <strong>{unit.name}</strong>
                <span className="topic-tile-percent">{locked ? <Icon name="lock" /> : `${unit.progress_percent || 0}%`}</span>
              </div>
              <div className="progress-track">
                <span className={`progress-fill progress-${unit.progress_color || 'blue'}`} style={{ width: `${unit.progress_percent || 0}%` }} />
              </div>
              {unit.is_hard_topic && <span className="topic-tile-flag">Hard topic</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/*
  DailyRecallCard
  ---------------------------------------------------------------
  question sourced from recall_questions_bank WHERE unit_id IN
  (units for active_group_id), not previously answered today by
  this user. score block from recall_sessions / user_recall_stats
  for today's activity_date.
*/
function DailyRecallCard({ recall, onReveal, onStart }) {
  if (!recall) return null;
  const { question_text, meta, score } = recall;
  return (
    <section className="section reveal">
      <div className="daily-recall-panel">
        <div>
          <span className="sec-label recall-eyebrow">Daily active recall</span>
          <h2 className="recall-question">{question_text}</h2>
          <div className="recall-meta">{meta}</div>
          <div className="recall-actions">
            <Button variant="primary" onClick={onReveal}>Reveal answer</Button>
            <Button variant="secondary" onClick={onStart}>Start recall</Button>
          </div>
        </div>
        {score && (
          <div className="recall-score-card">
            <span>Today's recall</span>
            <strong>{score.completed} / {score.total}</strong>
            <span>Questions completed · +{score.xp_earned} XP earned</span>
            <div className="progress-track dark">
              <span className="progress-fill progress-emerald" style={{ width: `${(score.completed / score.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/*
  PastPapersList
  ---------------------------------------------------------------
  past_papers WHERE unit_id IN (units for active_group_id)
  ORDER BY year DESC. paper_type drives the badge shown in place
  of an icon (P1 / P2 / Full paper) — no image column exists on
  this table, so this is a permanent icon-badge state.
*/
function PastPapersList({ papers, navigate }) {
  if (!papers?.length) return null;
  return (
    <section className="section reveal">
      <div className="section-head-row">
        <div><span className="sec-label">Practice</span><h2 className="section-title">Past papers</h2></div>
        <Link to="/past-papers" className="text-link">Browse all papers →</Link>
      </div>
      <div className="paper-list">
        {papers.map((paper) => (
          <div className="paper-row" key={paper.id}>
            <div className="paper-badge">{paper.paper_type_short}</div>
            <div className="paper-info">
              <strong>{paper.title}</strong>
              <small>{paper.exam_board} · {paper.subject}</small>
            </div>
            <span className="paper-year">{paper.year}</span>
            <span className="paper-type">{paper.paper_type}</span>
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
    // new props — see notes above each section for the query each one needs
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

      {user && (
        <DailyRecallCard recall={dailyRecall} onReveal={onRevealRecall} onStart={onStartRecall} />
      )}

      <HowItWorksSection />

      <StatsGrid
        stats={{
          resources_count: publicStats?.resources_count || 0,
          users_count: publicStats?.users_count || 0,
          downloads_count: publicStats?.downloads_count || 0,
          quiz_attempts: publicStats?.quiz_attempts || 0
        }}
      />

      {user && <PastPapersList papers={pastPapers} navigate={navigate} />}

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
