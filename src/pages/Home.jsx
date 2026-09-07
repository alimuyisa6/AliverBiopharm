 /* src/pages/Home.jsx */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import {
  getPublicStats,
  subscribeNewsletter,
  requestChat,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  checkAdminOnline,
  getRecentViews,
  getUnits,
  getRecallDashboard,
  getPastPapers,
  switchClass
} from '../api/cachedClient';
import { getSections } from '../api/sections';
import HomeView from '../features/home/HomeView';

function mapContinueLearning(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((item) => ({
    id: item.id ?? item.content_id,
    type: item.content_type ?? item.type ?? 'note',
    title: item.title,
    description: item.description ?? item.excerpt ?? item.summary ?? '',
    subject: item.subject,
    thumbnail_url: item.thumbnail_url ?? item.cover_image_url ?? null,
    progress_percent: item.progress_percent ?? item.percent ?? 0,
    progress_color: (item.progress_percent ?? 0) >= 80 ? 'emerald' : (item.progress_percent ?? 0) >= 40 ? 'blue' : 'amber',
    progress_label: item.progress_label ?? `${item.progress_percent ?? 0}% complete`,
    cta_label: item.content_type === 'video' ? 'Watch' : item.content_type === 'quiz' ? 'Resume' : 'Continue',
    route: item.route ?? item.url ?? '#'
  }));
}

function mapCurriculumUnits(rawUnits) {
  if (!Array.isArray(rawUnits)) return [];
  return rawUnits.map((unit) => ({
    id: unit.id,
    name: unit.name,
    icon: unit.icon,
    topic_image_url: unit.topic_image_url,
    is_premium: !!unit.is_premium,
    is_hard_topic: !!unit.is_hard_topic,
    quiz_question_count: unit.quiz_question_count ?? 0,
    recall_question_count: unit.recall_question_count ?? 0,
    pdf_count: unit.pdf_count ?? 0,
    progress_percent: unit.progress_percent ?? 0
  }));
}

function mapDailyRecall(raw) {
  if (!raw) return null;
  const question = raw.today_question ?? raw.question ?? null;
  const score = raw.today_score ?? raw.score ?? null;
  if (!question) return null;
  return {
    question_text: question.question_text ?? question.text,
    meta: raw.meta ?? `TODAY'S RECALL · ${(raw.subject || 'BIOLOGY').toUpperCase()}`,
    score: score ? {
      completed: score.completed ?? score.answered ?? 0,
      total: score.total ?? score.target ?? 10,
      xp_earned: score.xp_earned ?? score.xp ?? 0
    } : null
  };
}

function mapPastPapers(raw) {
  const list = Array.isArray(raw) ? raw : raw?.papers;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 3).map((paper) => ({
    id: paper.id,
    title: paper.title,
    exam_board: paper.exam_board,
    subject: paper.subject,
    year: paper.year,
    paper_type: paper.paper_type,
    paper_type_short: paper.paper_type?.toLowerCase().includes('full') ? 'FP' : (paper.paper_type?.match(/\d/)?.[0] ? `P${paper.paper_type.match(/\d/)[0]}` : '—')
  }));
}

export default function Home() {
  const { user } = useAuth();
  const { level, groups } = useLayout();
  const navigate = useNavigate();
  const chatBodyRef = useRef(null);

  const [sections, setSections] = useState({});
  const [publicStats, setPublicStats] = useState(null);
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);

  const [continueLearning, setContinueLearning] = useState([]);
  const [curriculumUnits, setCurriculumUnits] = useState([]);
  const [dailyRecall, setDailyRecall] = useState(null);
  const [pastPapers, setPastPapers] = useState([]);

  const currentYear = new Date().getFullYear();

  const activeGroupId = user?.profile?.active_group_id || null;

  const activeGroupName = useMemo(() => {
    if (!activeGroupId || !groups?.length) return null;

    const found = groups.find((group) => group.id === activeGroupId);

    return found ? found.name : null;
  }, [activeGroupId, groups]);

  useEffect(() => {
    if (level?.id) {
      getSections(level.id).then(setSections).catch(() => {});
    }

    getPublicStats().then(setPublicStats).catch(() => {});
    checkAdminOnline().then((res) => setAdminOnline(res?.online)).catch(() => {});
  }, [user, level]);

  useEffect(() => {
    if (!user || !activeGroupId) {
      setContinueLearning([]);
      setCurriculumUnits([]);
      setDailyRecall(null);
      setPastPapers([]);
      return;
    }

    getRecentViews(3).then((res) => setContinueLearning(mapContinueLearning(res))).catch(() => {});
    getUnits({ group_id: activeGroupId }).then((res) => setCurriculumUnits(mapCurriculumUnits(res))).catch(() => {});
    getRecallDashboard().then((res) => setDailyRecall(mapDailyRecall(res))).catch(() => {});
    getPastPapers({ group_id: activeGroupId }).then((res) => setPastPapers(mapPastPapers(res))).catch(() => {});
  }, [user, activeGroupId]);

  const handleNewsletterSubmit = useCallback(async (event) => {
    event.preventDefault();

    if (!newsletterEmail) return;

    try {
      await subscribeNewsletter(newsletterEmail);
      setNewsletterStatus({ success: true, message: 'Subscribed!' });
      setNewsletterEmail('');
    } catch (error) {
      setNewsletterStatus({ success: false, message: error.message });
    }
  }, [newsletterEmail]);

  const handleRequestChat = useCallback(async () => {
    if (!user) return;

    try {
      const res = await requestChat();

      setChatRoomId(res?.room_id);
      setChatOpen(true);

      if (res?.room_id) {
        const messages = await getChatMessages(res.room_id);

        setChatMessages(Array.isArray(messages) ? messages : []);
      }
    } catch {}
  }, [user]);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !chatRoomId) return;

    try {
      await sendChatMessage(chatRoomId, chatInput);
      setChatInput('');

      const messages = await getChatMessages(chatRoomId);

      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch {}
  }, [chatInput, chatRoomId]);

  const handleDeleteChatMsg = useCallback(async (messageId) => {
    try {
      await deleteChatMessage(messageId);

      const messages = await getChatMessages(chatRoomId);

      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch {}
  }, [chatRoomId]);

  const handleSwitchScope = useCallback(() => {
    navigate('/settings/scope');
  }, [navigate]);

  const handleRevealRecall = useCallback(() => {
    navigate('/recall?reveal=1');
  }, [navigate]);

  const handleStartRecall = useCallback(() => {
    navigate('/recall');
  }, [navigate]);

  return (
    <HomeView
      sections={sections}
      user={user}
      navigate={navigate}
      activeLevelName={level?.display_name || user?.profile?.track || ''}
      activeGroupName={activeGroupName}
      publicStats={publicStats}
      chatRoomId={chatRoomId}
      chatMessages={chatMessages}
      chatOpen={chatOpen}
      chatInput={chatInput}
      adminOnline={adminOnline}
      newsletterEmail={newsletterEmail}
      newsletterStatus={newsletterStatus}
      currentYear={currentYear}
      handleNewsletterSubmit={handleNewsletterSubmit}
      requestChatRoom={handleRequestChat}
      sendChat={handleSendChat}
      deleteChatMsg={handleDeleteChatMsg}
      setChatOpen={setChatOpen}
      setChatInput={setChatInput}
      setNewsletterEmail={setNewsletterEmail}
      chatBodyRef={chatBodyRef}
      continueLearning={continueLearning}
      curriculumUnits={curriculumUnits}
      canAccessPremium={!!user?.profile?.is_premium}
      dailyRecall={dailyRecall}
      pastPapers={pastPapers}
      onSwitchScope={handleSwitchScope}
      onRevealRecall={handleRevealRecall}
      onStartRecall={handleStartRecall}
    />
  );
}
