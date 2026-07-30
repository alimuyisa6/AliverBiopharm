 import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeView from '../features/home/HomeView';
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

export default function Home() {
  const { user } = useAuth();
  const { level, groups } = useLayout();
  const navigate = useNavigate();

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
  const chatBodyRef = useRef(null);
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

  async function handleMoodSubmit() {
    if (!moodSelected) return;
    try { await submitMood(moodSelected, moodMessage); setMoodSubmitted(true); } catch (e) {}
  }

  async function handleWeeklyChallengeSubmit(i, correct, explanation) {
    if (!user) return;
    setWeeklyChallengeAnswer({ correct: i === correct, explanation });
    try { await submitWeeklyChallenge(new Date().toISOString().slice(0, 10), i); } catch (e) {}
  }

  async function handleContactSubmit(e) {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    try {
      await submitContact(contactForm);
      setContactStatus({ success: true, message: 'Message sent!' });
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (e) { setContactStatus({ success: false, message: e.message }); }
  }

  async function handleNewsletterSubmit(e) {
    e.preventDefault();
    if (!newsletterEmail) return;
    try {
      await subscribeNewsletter(newsletterEmail);
      setNewsletterStatus({ success: true, message: 'Subscribed!' });
      setNewsletterEmail('');
    } catch (e) { setNewsletterStatus({ success: false, message: e.message }); }
  }

  async function requestChatRoom() {
    if (!user) return;
    try {
      const res = await requestChat();
      setChatRoomId(res?.room_id);
      setChatOpen(true);
      if (res?.room_id) {
        const messages = await getChatMessages(res.room_id);
        setChatMessages(Array.isArray(messages) ? messages : []);
      }
    } catch (e) {}
  }

  async function sendChat() {
    if (!chatInput.trim() || !chatRoomId) return;
    try {
      await sendChatMessage(chatRoomId, chatInput);
      setChatInput('');
      const messages = await getChatMessages(chatRoomId);
      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch (e) {}
  }

  async function deleteChatMsg(msgId) {
    try {
      await deleteChatMessage(msgId);
      const messages = await getChatMessages(chatRoomId);
      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch (e) {}
  }

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
      requestChatRoom={requestChatRoom}
      sendChat={sendChat}
      deleteChatMsg={deleteChatMsg}
      setChatOpen={setChatOpen}
      setChatInput={setChatInput}
      setContactForm={setContactForm}
      setNewsletterEmail={setNewsletterEmail}
      chatBodyRef={chatBodyRef}
    />
  );
}
