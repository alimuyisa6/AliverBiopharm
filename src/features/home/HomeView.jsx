  /* pages/Home.jsx */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import {
  getPublicStats,
  getCommunityActivity,
  getContinueReading,
  getUserStreak,
  submitMood,
  submitContact,
  subscribeNewsletter,
  submitWeeklyChallenge,
  requestChat,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  checkAdminOnline,
} from '../api/cachedClient';
import { getSections } from '../api/sections';
import HomeView from '../features/home/HomeView';

export default function Home() {
  const { user } = useAuth();
  const { level, groups } = useLayout();
  const navigate = useNavigate();
  const chatBodyRef = useRef(null);

  const [sections, setSections] = useState({});
  const [publicStats, setPublicStats] = useState(null);
  const [communityActivity, setCommunityActivity] = useState([]);
  const [moodSelected, setMoodSelected] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [weeklyChallengeAnswer, setWeeklyChallengeAnswer] = useState(null);
  const [continueLearning, setContinueLearning] = useState([]);
  const [streak, setStreak] = useState(0);
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const currentYear = new Date().getFullYear();

  const activeGroupName = useMemo(() => {
    if (!user?.profile?.active_group_id || !groups?.length) return null;
    const found = groups.find(g => g.id === user.profile.active_group_id);
    return found ? found.name : null;
  }, [user, groups]);

  useEffect(() => {
    const levelId = level?.id || 'O-Level';
    getSections(levelId).then(setSections).catch(() => {});
    getPublicStats().then(setPublicStats).catch(() => {});
    getCommunityActivity().then(setCommunityActivity).catch(() => {});
    checkAdminOnline().then(res => setAdminOnline(res?.online)).catch(() => {});

    if (user) {
      getContinueReading()
        .then(data => setContinueLearning(Array.isArray(data) ? data : []))
        .catch(() => {});
      getUserStreak()
        .then(res => setStreak(res?.count || 0))
        .catch(() => {});
    }
  }, [user, level]);

  const handleMoodSubmit = useCallback(async () => {
    if (!moodSelected) return;
    try { await submitMood(moodSelected, moodMessage); setMoodSubmitted(true); } catch {}
  }, [moodSelected, moodMessage]);

  const handleWeeklyChallengeSubmit = useCallback(async (i, correct, explanation) => {
    if (!user) return;
    setWeeklyChallengeAnswer({ correct: i === correct, explanation });
    try { await submitWeeklyChallenge(new Date().toISOString().slice(0, 10), i); } catch {}
  }, [user]);

  const handleContactSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    try {
      await submitContact(contactForm);
      setContactStatus({ success: true, message: 'Message sent!' });
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setContactStatus({ success: false, message: err.message });
    }
  }, [contactForm]);

  const handleNewsletterSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    try {
      await subscribeNewsletter(newsletterEmail);
      setNewsletterStatus({ success: true, message: 'Subscribed!' });
      setNewsletterEmail('');
    } catch (err) {
      setNewsletterStatus({ success: false, message: err.message });
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

  const handleDeleteChatMsg = useCallback(async (msgId) => {
    try {
      await deleteChatMessage(msgId);
      const messages = await getChatMessages(chatRoomId);
      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch {}
  }, [chatRoomId]);

  return (
    <HomeView
      sections={sections}
      user={user}
      navigate={navigate}
      activeLevelName={level?.display_name || user?.profile?.track || ''}
      activeGroupName={activeGroupName}
      publicStats={publicStats}
      communityActivity={communityActivity}
      weeklyChallengeAnswer={weeklyChallengeAnswer}
      moodSelected={moodSelected}
      setMoodSelected={setMoodSelected}
      moodMessage={moodMessage}
      setMoodMessage={setMoodMessage}
      moodSubmitted={moodSubmitted}
      continueLearning={continueLearning}
      streak={streak}
      chatRoomId={chatRoomId}
      chatMessages={chatMessages}
      chatOpen={chatOpen}
      chatInput={chatInput}
      adminOnline={adminOnline}
      contactForm={contactForm}
      contactStatus={contactStatus}
      newsletterEmail={newsletterEmail}
      newsletterStatus={newsletterStatus}
      currentYear={currentYear}
      handleWeeklyChallengeSubmit={handleWeeklyChallengeSubmit}
      handleContactSubmit={handleContactSubmit}
      handleNewsletterSubmit={handleNewsletterSubmit}
      handleMoodSubmit={handleMoodSubmit}
      requestChatRoom={handleRequestChat}
      sendChat={handleSendChat}
      deleteChatMsg={handleDeleteChatMsg}
      setChatOpen={setChatOpen}
      setChatInput={setChatInput}
      setContactForm={setContactForm}
      setNewsletterEmail={setNewsletterEmail}
      chatBodyRef={chatBodyRef}
    />
  );
}
