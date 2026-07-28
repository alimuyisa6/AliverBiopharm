import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBrain, FaCheck, FaTrophy, FaFire, FaStar, FaChartLine,
  FaPencil, FaCircleInfo, FaMicroscope, FaDna, FaCapsules,
  FaBookOpen, FaBullseye, FaLeaf, FaFlask, FaTree, FaSeedling,
  FaStarOfLife, FaChartSimple, FaCalendarDay, FaCircleCheck,
  FaLink, FaTriangleExclamation, FaExclamation, FaDownload,
  FaClock, FaVolumeHigh, FaVolumeXmark, FaRotate, FaHouse,
  FaArrowLeft, FaArrowRight, FaSpinner
} from 'react-icons/fa6';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import {
  getRecallSession,
  checkRecallSession,
  getRecallStats,
  getRecallAchievements,
  getRecallDashboard,
  getRecallTopics,
  continueRecallSession,
  submitRecallAnswer,
  completeRecallSession,
  getLeaderboard
} from '../api/cachedClient';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import useLoading from '../loading/useLoading';
import InlineSpinner from '../loading/components/InlineSpinner';

const strengthIcons = {
  excellent: FaStar,
  strong: FaCircleCheck,
  developing: FaRotate
};

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

let audioCtx = null;

async function getAudioContext() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  return audioCtx;
}

async function playTone(type) {
  try {
    const ctx = await getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, now);
    switch (type) {
      case 'excellent':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      case 'strong':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'developing':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(294, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'achievement':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        osc.frequency.setValueAtTime(1046.5, now + 0.36);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      default:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
  } catch {}
}

export default function BioRecall() {
  const { user } = useAuth();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll } = useLevelFilter();

  // ... (state declarations unchanged)
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [userAnswersRecord, setUserAnswersRecord] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [masteryTopics, setMasteryTopics] = useState({});
  const [topicXpMap, setTopicXpMap] = useState({});
  const [topicStreakMap, setTopicStreakMap] = useState({});
  const [brainEnergy, setBrainEnergy] = useState(100);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [sessionReport, setSessionReport] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [achievementsList, setAchievementsList] = useState([]);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicList, setTopicList] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [debugLog, setDebugLog] = useState([]);
  const countdownRef = useRef(null);
  const answerInputRef = useRef(null);
  const [countdown, setCountdown] = useState(8);
  const [spinnerMessage, setSpinnerMessage] = useState('');
  const [floatingCards, setFloatingCards] = useState(false);
  const [floatingConcepts, setFloatingConcepts] = useState([]);
  const { show, hide } = useLoading();
  const [leaderboard, setLeaderboard] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiCanvasRef = useRef(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [rankTitle, setRankTitle] = useState('Beginner');
  const [xpProgress, setXpProgress] = useState({ level: 1, xpIntoLevel: 0, xpToNext: 100, progressPercent: 0 });
  const [masteryAverage, setMasteryAverage] = useState(0);
  const [spinMessages, setSpinMessages] = useState(['Checking...', 'Reviewing...', 'Feedback ready']);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('bioRecall_sound') !== 'off'; } catch { return true; }
  });
  const isMounted = useRef(true);

  // … all useEffect, callbacks, handlers remain identical as before (no style changes inside them)

  // Rendering helper functions now use global CSS classes

  const renderHeatmap = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 365);
    const days = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }
    const heatmapMap = {};
    heatmap.forEach(h => { heatmapMap[h.date] = h; });
    return (
      <div className="heatmap-container">
        <div className="heatmap-grid">
          {days.map(date => {
            const entry = heatmapMap[date];
            const intensity = entry?.intensity || 0;
            const count = entry?.count || 0;
            return (
              <div
                key={date}
                className={`heatmap-cell heatmap-level-${intensity}`}
                title={`${date}: ${count} questions`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (!leaderboard.length) return null;
    return (
      <div className="leaderboard-panel">
        <h3 className="leaderboard-title"><FaTrophy className="leaderboard-icon" /> Leaderboard</h3>
        <table className="leaderboard-table">
          <thead>
            <tr><th>Rank</th><th>User</th><th>XP</th><th>Level</th></tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{escapeHtml(entry.username || entry.email || 'Anonymous')}</td>
                <td>{entry.total_xp}</td>
                <td>{entry.recall_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDashboard = () => {
    if (!dashboardData) return null;
    const topicEntries = Object.entries(masteryTopics).filter(([t]) => t && t !== 'null').slice(0, 6);
    const daily = dashboardData.dailyChallenge || {};
    const isQuestComplete = daily.isCompleted || (daily.completed >= daily.target);
    return (
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-title">
            <FaBullseye className={`dashboard-icon ${isQuestComplete ? 'quest-complete' : ''}`} />
            Daily Challenge
            {isQuestComplete && <FaCheck className="quest-check" />}
          </div>
          <div>{isQuestComplete ? 'Quest Complete!' : `Complete ${daily.target || 10} Recall Questions`}</div>
          <div>Progress: {daily.completed || 0} / {daily.target || 10}</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ '--progress-width': `${Math.min(daily.progressPercent || 0, 100)}%` }} />
          </div>
          <div>Reward: +50 XP</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaChartSimple className="dashboard-icon" /> XP Progress</div>
          <div>Level {xpProgress.level} · <span className="rank-label">{rankTitle}</span></div>
          <div className="xp-progress">{xpProgress.xpIntoLevel} / 100 XP to next level</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ '--progress-width': `${xpProgress.progressPercent}%` }} />
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaTrophy className="dashboard-icon trophy-icon" /> Achievements</div>
          <div className="achievement-grid">
            {achievementsList.map((ach) => (
              <div key={ach.key} className={`achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`}>
                <i className={`fa-solid ${ach.icon} achievement-icon`}></i>
                <div className="achievement-title">{ach.title}</div>
              </div>
            ))}
          </div>
        </div>
        {dashboardData.dueForReview > 0 && (
          <div className="dashboard-card">
            <div className="card-title"><FaClock className="dashboard-icon review-icon" /> Spaced Repetition</div>
            <div>{dashboardData.dueForReview} items due for review today</div>
          </div>
        )}
        <div className="dashboard-card">
          <div className="card-title"><FaBrain className="dashboard-icon brain-icon" /> Brain Energy</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ '--progress-width': `${brainEnergy}%` }} />
          </div>
          <div>{brainEnergy}% energy remaining</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaLeaf className="dashboard-icon leaf-icon" /> Memory Garden</div>
          <div className="memory-garden">
            {dashboardData.gardenStage === 'tree' ? <FaTree className="garden-tree" /> : <FaSeedling className="garden-seedling" />}
          </div>
          <div>{dashboardData.streak} day streak</div>
        </div>
        <div className="dashboard-card dashboard-card-clickable" onClick={toggleSound}>
          <div className="card-title">
            {soundEnabled ? <FaVolumeHigh className="dashboard-icon sound-on" /> : <FaVolumeXmark className="dashboard-icon sound-off" />}
            Sound Effects
          </div>
          <div>{soundEnabled ? 'On' : 'Off'} (click to toggle)</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaFlask className="dashboard-icon flask-icon" /> Subject</div>
          <div className="subject-illustration"><i className={`fa-solid ${dashboardData.subjectIllustration}`}></i></div>
          <div>{level}{effectiveClassName ? ` · ${effectiveClassName}` : ''}</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaStarOfLife className="dashboard-icon star-icon" /> Topic Mastery</div>
          <div className="topic-icon-grid">
            {topicEntries.map(([topic, mastery]) => (
              <div key={topic} className="topic-icon-card">
                <div className="topic-big-icon"><FaBookOpen /></div>
                <div className="topic-name">{escapeHtml(topic)}</div>
                <div className="topic-mastery">{Math.round(mastery)}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaBookOpen className="dashboard-icon book-icon" /> Quote</div>
          <div className="quote-text">{dashboardData.quote}</div>
        </div>
        <div className="dashboard-card">
          <div className="card-title"><FaCalendarDay className="dashboard-icon calendar-icon" /> Activity Heatmap</div>
          {renderHeatmap()}
        </div>
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedbackResult) return null;
    const { strength, xp, matched, feedback, common_mistake_explanation, study_note, diff, strength_meaning } = feedbackResult;
    const strengthClass = strength === 'excellent' ? 'strength-excellent' : strength === 'strong' ? 'strength-strong' : 'strength-developing';
    const Icon = strengthIcons[strength] || FaCircleInfo;
    const label = strength_meaning?.label || strength;
    const description = strength_meaning?.description || '';
    const colorClass = `feedback-${strength}`;
    return (
      <div className="feedback-area">
        <div className={`recall-strength ${strengthClass}`}>
          <Icon className={`strength-icon ${colorClass}`} />
          <div>
            <div className={`strength-label ${colorClass}`}>{label}</div>
            <div className="strength-description">{description}</div>
          </div>
        </div>
        <div className="feedback-matched">Matched: <strong>{escapeHtml(matched)}</strong></div>
        <div className="feedback-xp"><FaTrophy className="xp-icon" /> +{xp} XP</div>
        {diff && diff.your_answer && (
          <div className="feedback-comparison">
            <h4><FaExclamation className="comparison-warning" /> Answer Comparison</h4>
            <div className="comparison-row">
              <div>Your answer: <span className="comparison-wrong">{escapeHtml(diff.your_answer)}</span></div>
              <div>Correct answer: <span className="comparison-correct">{escapeHtml(diff.correct_answer)}</span></div>
              {diff.was_common_mistake && <div className="common-mistake-tag">This is a common mistake. See explanation below.</div>}
            </div>
          </div>
        )}
        {feedback?.answer_explanation && (
          <div className="feedback-section">
            <h4><FaBookOpen className="feedback-explanation-icon" /> Explanation</h4>
            <div>{feedback.answer_explanation}</div>
          </div>
        )}
        {feedback?.related_concepts?.length > 0 && (
          <div className="feedback-section">
            <h4><FaLink className="feedback-link-icon" /> Related Concepts</h4>
            <ul className="concept-list">
              {feedback.related_concepts.map((c, i) => <li key={i}><strong>{escapeHtml(c)}</strong></li>)}
            </ul>
          </div>
        )}
        {common_mistake_explanation && (
          <div className="feedback-section">
            <h4><FaTriangleExclamation className="feedback-mistake-icon" /> Common Confusion</h4>
            <div>{escapeHtml(common_mistake_explanation)}</div>
          </div>
        )}
        {study_note && <div className="study-note"><FaCircleInfo className="study-note-icon" /> Study Note: {escapeHtml(study_note)}</div>}
      </div>
    );
  };

  const renderFloatingCards = () => {
    if (!floatingCards) return null;
    const items = floatingConcepts.length ? floatingConcepts : ['Cell', 'DNA', 'Enzyme'];
    const icon = level === 'O-Level' ? <FaMicroscope /> : level === 'A-Level' ? <FaDna /> : <FaCapsules />;
    const cards = Array.from({ length: 12 }, (_, i) => {
      const text = items[Math.floor(Math.random() * items.length)];
      return (
        <div key={i} className="float-card" style={{ top: `${Math.random() * 70 + 10}%`, left: '-100px' }}>
          {icon} <span>{text}</span>
        </div>
      );
    });
    return <div className="floating-cards-area">{cards}</div>;
  };

  // … the rest of the file stays the same (session logic, loadUserProgress, etc.)

  if (!isReady || access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (!access.canAccess) {
    return <div className="recall-access-denied">Access restricted. Please contact support.</div>;
  }

  if (loading) {
    return (
      <div className="recall-loading">
        <div className="spinner-colors">
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
          <div className="spinner-dot-color"></div>
        </div>
        <div className="recall-loading-text">Preparing your session...</div>
      </div>
    );
  }

  return (
    <>
      {renderConfettiCanvas()}
      <div className="recall-container">
        <div className="breadcrumb">
          <Link to="/"><FaHouse className="breadcrumb-icon" /> Home</Link>
          <span>›</span>
          <span>Recall Practice</span>
        </div>

        <div className="recall-header">
          <h1>{level === 'Pharmacy' ? 'RecallRx' : `BioRecall ${level || ''}`}</h1>
          {level && <span className="level-badge">{level}{effectiveClassName ? ` · ${effectiveClassName}` : ''}</span>}
        </div>

        <div className="main-layout">
          <div className="main-content">
            {!sessionActive && !showReport && (
              <div className="entrance-screen">
                <div className="recall-card">
                  <FaBrain className="brain-icon" />
                  <button className="continue-btn" onClick={openTopicModal}>Continue to Topics</button>
                  <p className="recall-streak-info"><FaFire className="streak-fire" /> {streakDays} Day Recall Streak</p>
                  <p className="recall-xp-info"><FaStar className="xp-star" /> Level {xpProgress.level} · {xpTotal} XP · {rankTitle}</p>
                  {message && <div className={`user-message ${message.type}`}>{message.text}</div>}
                </div>
                {renderWeakTopicAlert()}
                {renderDashboard()}
              </div>
            )}
            {sessionActive && (
              <div className="session-screen">
                <div className="recall-card">{renderQuestion()}</div>
                <div className="analytics-row">
                  <div className="stat-card">
                    <FaChartLine className="stat-icon" />
                    <span>E:{userAnswersRecord.filter(r => r.strength === 'excellent').length} S:{userAnswersRecord.filter(r => r.strength === 'strong').length} D:{userAnswersRecord.filter(r => r.strength === 'developing').length}</span>
                  </div>
                  <div className="stat-card">
                    <FaTrophy className="stat-icon trophy" />
                    Mastery: <span>{masteryAverage}%</span>
                  </div>
                  <div className="stat-card">
                    <FaFire className="stat-icon fire" />
                    Streak: <span>{streakDays} days</span>
                  </div>
                </div>
              </div>
            )}
            {showReport && renderReport()}
          </div>
          <div className="sidebar">
            {!sessionActive && !showReport && <>{renderLeaderboard()}</>}
          </div>
        </div>

        {topicModalOpen && renderTopicModal()}
        {renderFloatingCards()}
        {showConfirm && renderConfirm()}
      </div>
    </>
  );
}
