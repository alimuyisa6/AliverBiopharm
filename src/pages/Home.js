 import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import HomeView from './HomeView';
import { cachedFetch } from '../utils/DataCache';
import {
  getAllSiteSections,
  getFlashcards,
  getPublicStats,
  getCommunityActivity,
  submitWeeklyChallenge,
  getPdfsByLevel,
  trackPdfPreview,
  trackPdfDownload,
  getNotesStructure,
  getNoteContent,
  getNoteReactions,
  toggleNoteReaction,
  getRecentViews,
  getUserFavorites,
  getUserStreak,
  getUserAchievements,
  submitContact,
  subscribeNewsletter,
  submitMood,
  commentResource,
  getResourceInteractions,
  getKnownFlashcards,
  toggleFlashcardKnown,
  rateFlashcard,
  checkFlashcardAnswer,
  toggleFlashcardBookmark,
  requestChat,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  checkAdminOnline,
  updateUserPresence
} from '../api/client';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sections, setSections] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardDecks, setFlashcardDecks] = useState({});
  const [knownFlashcardIds, setKnownFlashcardIds] = useState([]);
  const [flashcardMode, setFlashcardMode] = useState('study');
  const [flashcardCurrentDeck, setFlashcardCurrentDeck] = useState(null);
  const [flashcardCurrentIndex, setFlashcardCurrentIndex] = useState(0);
  const [flashcardShuffled, setFlashcardShuffled] = useState({});
  const [flashcardSelectedLevel, setFlashcardSelectedLevel] = useState('');
  const [flashcardDeckProgress, setFlashcardDeckProgress] = useState({});
  const [flippedCards, setFlippedCards] = useState({});
  const [pdfs, setPdfs] = useState([]);
  const [pdfLevel, setPdfLevel] = useState('O-Level');
  const [pdfSelectedTopic, setPdfSelectedTopic] = useState(null);
  const [notesStructure, setNotesStructure] = useState([]);
  const [notesSelectedLevel, setNotesSelectedLevel] = useState(null);
  const [notesSelectedTopic, setNotesSelectedTopic] = useState(null);
  const [notesFilterVisible, setNotesFilterVisible] = useState(false);
  const [publicStats, setPublicStats] = useState(null);
  const [communityActivity, setCommunityActivity] = useState([]);
  const [weeklyChallengeAnswer, setWeeklyChallengeAnswer] = useState(null);
  const [moodSelected, setMoodSelected] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [continueLearning, setContinueLearning] = useState({ views: [], favorites: [], streak: 0, achievements: [] });
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const [theme, setTheme] = useState('light');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [notesContent, setNotesContent] = useState(null);
  const [notesReactions, setNotesReactions] = useState(null);
  const [notesComments, setNotesComments] = useState([]);
  const [notesCommentInput, setNotesCommentInput] = useState('');

  const chatBodyRef = useRef(null);
  const chatPollInterval = useRef(null);
  const userPresenceInterval = useRef(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      setTheme('dark');
    }
    fetchAllData();
    return () => {
      if (chatPollInterval.current) clearInterval(chatPollInterval.current);
      if (userPresenceInterval.current) clearInterval(userPresenceInterval.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchContinueLearning();
      const interval = setInterval(() => updateUserPresence(), 30000);
      userPresenceInterval.current = interval;
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const slides = sections?.hero?.slides;
    if (!slides || slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [sections]);

  useEffect(() => {
    if (chatRoomId && chatOpen) {
      if (chatPollInterval.current) clearInterval(chatPollInterval.current);
      chatPollInterval.current = setInterval(fetchChatMessages, 3000);
      fetchChatMessages();
    } else if (chatPollInterval.current) {
      clearInterval(chatPollInterval.current);
    }
  }, [chatRoomId, chatOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
            }
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px -50px 0px' }
      );
      document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
      document.querySelectorAll('.reveal').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add('in');
        }
      });
      return () => observer.disconnect();
    }, 100);
    return () => clearTimeout(timer);
  }, [sections, flashcards]);

  async function fetchAllData() {
    const { data: cachedSections } = cachedFetch(
      'site_sections',
      getAllSiteSections,
      { onUpdate: (fresh) => setSections(fresh) }
    );
    if (cachedSections) {
      setSections(cachedSections);
    } else {
      try {
        const siteSections = await getAllSiteSections();
        setSections(siteSections);
      } catch (err) { console.error(err); }
    }
    fetchFlashcards();
    fetchPublicStats();
    fetchCommunityActivity();
    fetchPdfsByLevel('O-Level');
    fetchNotesStructure();
    fetchAdminOnline();
    if (user) {
      fetchKnownFlashcards();
      fetchFlashcardProgress();
    }
  }

  async function fetchFlashcards() {
    try {
      const data = await getFlashcards();
      setFlashcards(data || []);
      const decks = {};
      (data || []).forEach(card => {
        const cat = card.category || 'General';
        if (!decks[cat]) decks[cat] = [];
        decks[cat].push(card);
      });
      setFlashcardDecks(decks);
      setFlashcardShuffled(decks);
    } catch (err) { console.error(err); }
  }

  async function fetchKnownFlashcards() {
    try {
      const data = await getKnownFlashcards();
      setKnownFlashcardIds(data || []);
    } catch (err) { console.error(err); }
  }

  async function fetchFlashcardProgress() {
    try {
      const progress = {};
      Object.keys(flashcardDecks).forEach(deck => {
        progress[deck] = { reviewed: knownFlashcardIds.length, total: flashcardDecks[deck]?.length || 0 };
      });
      setFlashcardDeckProgress(progress);
    } catch (err) { console.error(err); }
  }

  async function fetchPublicStats() {
    const { data: cachedStats } = cachedFetch(
      'public_stats',
      getPublicStats,
      { onUpdate: (fresh) => setPublicStats(fresh) }
    );
    if (cachedStats) {
      setPublicStats(cachedStats);
    } else {
      try {
        const data = await getPublicStats();
        setPublicStats(data);
      } catch (err) { console.error(err); }
    }
  }

  async function fetchCommunityActivity() {
    try {
      const data = await getCommunityActivity();
      setCommunityActivity(data || []);
    } catch (err) { console.error(err); }
  }

  async function fetchPdfsByLevel(level) {
    try {
      const data = await getPdfsByLevel(level);
      setPdfs(data?.pdfs || []);
    } catch (err) { console.error(err); }
  }

  async function fetchNotesStructure() {
    try {
      const data = await getNotesStructure();
      setNotesStructure(data || []);
    } catch (err) { console.error(err); }
  }

  async function fetchContinueLearning() {
    try {
      const [views, favorites, streak, achievements] = await Promise.all([
        getRecentViews(3).catch(() => []),
        getUserFavorites().catch(() => []),
        getUserStreak().catch(() => ({ count: 0 })),
        getUserAchievements().catch(() => [])
      ]);
      setContinueLearning({ views: views || [], favorites: favorites || [], streak: streak?.count || 0, achievements: achievements || [] });
    } catch (err) { console.error(err); }
  }

  async function handleWeeklyChallengeSubmit(selectedIdx, correctIdx, explanation) {
    if (!user) { alert('Please sign in'); return; }
    const weekStart = sections?.weekly_challenge?.week_start || new Date().toISOString().slice(0,10);
    const isCorrect = selectedIdx === correctIdx;
    setWeeklyChallengeAnswer({ correct: isCorrect, explanation });
    try {
      await submitWeeklyChallenge(weekStart, selectedIdx);
    } catch (err) { console.error(err); }
  }

  async function handleContactSubmit(e) {
    e.preventDefault();
    setContactStatus(null);
    try {
      await submitContact(contactForm);
      setContactStatus({ success: true, message: 'Message sent successfully!' });
      setContactForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setContactStatus(null), 5000);
    } catch (err) {
      setContactStatus({ success: false, message: err.message });
    }
  }

  async function handleNewsletterSubmit(e) {
    e.preventDefault();
    setNewsletterStatus(null);
    try {
      await subscribeNewsletter(newsletterEmail);
      setNewsletterStatus({ success: true, message: 'Subscribed!' });
      setNewsletterEmail('');
      setTimeout(() => setNewsletterStatus(null), 5000);
    } catch (err) {
      setNewsletterStatus({ success: false, message: err.message });
    }
  }

  async function handleMoodSubmit() {
    if (!user) { alert('Sign in to share mood'); return; }
    if (!moodSelected) return;
    try {
      await submitMood(moodSelected, moodMessage);
      setMoodSubmitted(true);
      setTimeout(() => { setMoodSelected(null); setMoodMessage(''); setMoodSubmitted(false); }, 5000);
    } catch (err) { console.error(err); }
  }

  async function fetchAdminOnline() {
    try {
      const data = await checkAdminOnline();
      setAdminOnline(data?.online || false);
    } catch (err) { console.error(err); }
  }

  async function requestChatRoom() {
    if (!user) { alert('Sign in to chat'); return; }
    try {
      const res = await requestChat();
      setChatRoomId(res.room_id);
      setChatOpen(true);
    } catch (err) { console.error(err); }
  }

  async function fetchChatMessages() {
    if (!chatRoomId) return;
    try {
      const msgs = await getChatMessages(chatRoomId);
      setChatMessages(msgs || []);
      if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    } catch (err) { console.error(err); }
  }

  async function sendChat() {
    if (!chatRoomId || !chatInput.trim()) return;
    try {
      await sendChatMessage(chatRoomId, chatInput);
      setChatInput('');
      fetchChatMessages();
    } catch (err) { console.error(err); }
  }

  async function deleteChatMsg(messageId) {
    try {
      await deleteChatMessage(messageId);
      fetchChatMessages();
    } catch (err) { console.error(err); }
  }

  async function handlePdfPreview(pdf) {
    if (!user) { alert('Sign in to preview PDFs'); navigate('/login'); return; }
    try {
      await trackPdfPreview(pdf.id);
      setPreviewPdf(pdf);
      setPdfPreviewOpen(true);
    } catch (err) { alert(err.message); }
  }

  async function handlePdfDownload(pdf) {
    if (!user) { alert('Sign in to download'); navigate('/login'); return; }
    try {
      await trackPdfDownload(pdf.id);
      window.open(pdf.file_url, '_blank');
    } catch (err) { alert(err.message); }
  }

  async function loadNoteContent(subtopicId, level, topic, subtopicName) {
    try {
      const content = await getNoteContent(subtopicId);
      setNotesContent({ ...content, subtopicId, level, topic, subtopicName });
      const reactions = await getNoteReactions(subtopicId);
      setNotesReactions(reactions);
      const interactions = await getResourceInteractions(subtopicId);
      setNotesComments(interactions?.comments || []);
    } catch (err) { console.error(err); }
  }

  async function handleNoteReaction(noteId, reactionType) {
    if (!user) { alert('Sign in to react'); return; }
    try {
      await toggleNoteReaction(noteId, reactionType);
      const updated = await getNoteReactions(noteId);
      setNotesReactions(updated);
    } catch (err) { console.error(err); }
  }

  async function handleNoteComment(noteId) {
    if (!user) { alert('Sign in to comment'); return; }
    if (!notesCommentInput.trim()) return;
    try {
      await commentResource(noteId, notesCommentInput);
      setNotesCommentInput('');
      const interactions = await getResourceInteractions(noteId);
      setNotesComments(interactions?.comments || []);
    } catch (err) { console.error(err); }
  }

  async function toggleKnown(cardId, btn) {
    if (!user) { alert('Sign in to mark known'); return; }
    try {
      const res = await toggleFlashcardKnown(cardId);
      if (res.known) {
        setKnownFlashcardIds(prev => [...prev, cardId]);
        btn.textContent = 'Known';
      } else {
        setKnownFlashcardIds(prev => prev.filter(id => id !== cardId));
        btn.textContent = 'Mark Known';
      }
    } catch (err) { console.error(err); }
  }

  function speakText(text) {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function toggleCardFlip(cardId, deckName, idx) {
    setFlashcardCurrentDeck(deckName);
    setFlashcardCurrentIndex(idx);
    setFlippedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  }

  function shuffleFlashcards() {
    const shuffled = {};
    Object.keys(flashcardDecks).forEach(deck => {
      shuffled[deck] = [...flashcardDecks[deck]].sort(() => Math.random() - 0.5);
    });
    setFlashcardShuffled(shuffled);
    setFlashcardCurrentDeck(null);
    setFlashcardCurrentIndex(0);
    setFlippedCards({});
  }

  function getLevelColor(level) {
    if (level === 'O-Level') return '#e67e22';
    if (level === 'A-Level') return '#b8873a';
    if (level === 'Pharmacy') return '#0ab5b5';
    return '#888';
  }

  const groupedNotes = {};
  notesStructure.forEach(item => {
    if (!groupedNotes[item.level]) groupedNotes[item.level] = {};
    if (!groupedNotes[item.level][item.topic]) groupedNotes[item.level][item.topic] = [];
    groupedNotes[item.level][item.topic].push(item);
  });

  const currentYear = new Date().getFullYear();

  if (!sections) return <div style={{ minHeight: '100vh', background: 'var(--clr-deep-space)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--clr-white)' }}>Loading...</p></div>;

  return (
    <HomeView
      sections={sections}
      flashcards={flashcards}
      flashcardDecks={flashcardDecks}
      flashcardShuffled={flashcardShuffled}
      knownFlashcardIds={knownFlashcardIds}
      flashcardMode={flashcardMode}
      flashcardCurrentDeck={flashcardCurrentDeck}
      flashcardCurrentIndex={flashcardCurrentIndex}
      flippedCards={flippedCards}
      flashcardDeckProgress={flashcardDeckProgress}
      pdfs={pdfs}
      pdfLevel={pdfLevel}
      pdfSelectedTopic={pdfSelectedTopic}
      notesStructure={notesStructure}
      notesSelectedLevel={notesSelectedLevel}
      notesSelectedTopic={notesSelectedTopic}
      notesFilterVisible={notesFilterVisible}
      publicStats={publicStats}
      communityActivity={communityActivity}
      weeklyChallengeAnswer={weeklyChallengeAnswer}
      moodSelected={moodSelected}
      moodMessage={moodMessage}
      moodSubmitted={moodSubmitted}
      continueLearning={continueLearning}
      chatRoomId={chatRoomId}
      chatMessages={chatMessages}
      chatOpen={chatOpen}
      chatInput={chatInput}
      adminOnline={adminOnline}
      theme={theme}
      currentSlide={currentSlide}
      mobileMenuOpen={mobileMenuOpen}
      contactForm={contactForm}
      contactStatus={contactStatus}
      newsletterEmail={newsletterEmail}
      newsletterStatus={newsletterStatus}
      pdfPreviewOpen={pdfPreviewOpen}
      previewPdf={previewPdf}
      notesContent={notesContent}
      notesReactions={notesReactions}
      notesComments={notesComments}
      notesCommentInput={notesCommentInput}
      groupedNotes={groupedNotes}
      getLevelColor={getLevelColor}
      user={user}
      logout={logout}
      navigate={navigate}
      currentYear={currentYear}
      handleWeeklyChallengeSubmit={handleWeeklyChallengeSubmit}
      handleContactSubmit={handleContactSubmit}
      handleNewsletterSubmit={handleNewsletterSubmit}
      handleMoodSubmit={handleMoodSubmit}
      shuffleFlashcards={shuffleFlashcards}
      setFlashcardMode={setFlashcardMode}
      setFlashcardCurrentDeck={setFlashcardCurrentDeck}
      setFlashcardCurrentIndex={setFlashcardCurrentIndex}
      toggleCardFlip={toggleCardFlip}
      setFlashcardSelectedLevel={setFlashcardSelectedLevel}
      fetchPdfsByLevel={fetchPdfsByLevel}
      handlePdfPreview={handlePdfPreview}
      handlePdfDownload={handlePdfDownload}
      loadNoteContent={loadNoteContent}
      handleNoteReaction={handleNoteReaction}
      handleNoteComment={handleNoteComment}
      toggleKnown={toggleKnown}
      speakText={speakText}
      requestChatRoom={requestChatRoom}
      sendChat={sendChat}
      deleteChatMsg={deleteChatMsg}
      setChatOpen={setChatOpen}
      setChatInput={setChatInput}
      setMobileMenuOpen={setMobileMenuOpen}
      setTheme={setTheme}
      setContactForm={setContactForm}
      setNewsletterEmail={setNewsletterEmail}
      setPdfPreviewOpen={setPdfPreviewOpen}
      setNotesSelectedLevel={setNotesSelectedLevel}
      setNotesSelectedTopic={setNotesSelectedTopic}
      setNotesFilterVisible={setNotesFilterVisible}
      setNotesContent={setNotesContent}
      setNotesCommentInput={setNotesCommentInput}
      chatBodyRef={chatBodyRef}
      setPdfSelectedTopic={setPdfSelectedTopic}
      setPdfLevel={setPdfLevel}
    />
  );
}
