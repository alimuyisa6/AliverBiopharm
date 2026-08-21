 /* pages/Home.jsx */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import {
  getPublicStats,
  getContinueReading,
  getUserStreak,
  subscribeNewsletter,
  requestChat,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  checkAdminOnline
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
  const [continueLearning, setContinueLearning] = useState([]);
  const [streak, setStreak] = useState(0);
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);

  const currentYear = new Date().getFullYear();

  const activeGroupName = useMemo(() => {
    if (!user?.profile?.active_group_id || !groups?.length) return null;

    const found = groups.find((group) => group.id === user.profile.active_group_id);

    return found ? found.name : null;
  }, [user, groups]);

  useEffect(() => {
    if (level?.id) {
      getSections(level.id).then(setSections).catch(() => {});
    }

    getPublicStats().then(setPublicStats).catch(() => {});
    checkAdminOnline().then((res) => setAdminOnline(res?.online)).catch(() => {});

    if (user) {
      getContinueReading()
        .then((data) => setContinueLearning(Array.isArray(data) ? data : []))
        .catch(() => {});

      getUserStreak()
        .then((res) => setStreak(res?.count || 0))
        .catch(() => {});
    }
  }, [user, level]);

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

  return (
    <HomeView
      sections={sections}
      user={user}
      navigate={navigate}
      activeLevelName={level?.display_name || user?.profile?.track || ''}
      activeGroupName={activeGroupName}
      publicStats={publicStats}
      continueLearning={continueLearning}
      streak={streak}
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
    />
  );
}
